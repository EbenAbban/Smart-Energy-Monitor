#include "network_task.h"

void discoverBackendIP() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (millis() - lastSubnetScan < 15000 && lastSubnetScan > 0) return;
  lastSubnetScan = millis();

  HTTPClient checkHttp;
  checkHttp.setTimeout(1000);
  checkHttp.begin(String(SERVER_HOST) + "/api/health");
  int checkCode = checkHttp.GET();
  checkHttp.end();
  if (checkCode == 200) {
    serverHealthy = true;
    return;
  }

  Serial.printf("[AutoScan] Host unreachable (%d). Scanning subnet...\n", checkCode);
  IPAddress local = WiFi.localIP();
  if (local[0] == 0) return;

  IPAddress target = local;
  WiFiClient client;

  for (int i = 1; i < 255; i++) {
    if (i == local[3]) continue;
    target[3] = i;
    if (client.connect(target, 4000, 80)) {
      client.stop();
      String candidate = "http://" + target.toString() + ":4000";

      HTTPClient http;
      http.setTimeout(1500);
      http.begin(candidate + "/api/health");
      int code = http.GET();
      http.end();

      if (code == 200) {
        if (takeStateLock()) {
          candidate.toCharArray(SERVER_HOST, 64);
          serverHealthy = true;
          giveStateLock();
        }
        Serial.printf("[AutoScan] Backend verified -> %s\n", SERVER_HOST);
        prefs.begin("config", false);
        prefs.putString("server_host", SERVER_HOST);
        prefs.end();
        return;
      }
    }
  }
}

void handleUdpDiscovery() {
  int packetSize = udp.parsePacket();
  if (packetSize <= 0) return;

  int len = udp.read(incomingPacket, 127);
  if (len > 0) incomingPacket[len] = 0;

  if (serverHealthy) return;

  String msg = String(incomingPacket);
  if (!msg.startsWith("SMART_ENERGY_MONITOR_BACKEND:")) return;

  String newHost = msg.substring(29);
  if (newHost.length() == 0 || newHost.length() >= 64) return;
  if (newHost.equals(SERVER_HOST)) return;

  Serial.printf("[Discovery] Server down — verifying UDP candidate %s...\n", newHost.c_str());

  HTTPClient candCheck;
  candCheck.setTimeout(1500);
  candCheck.begin(newHost + "/api/health");
  int candCode = candCheck.GET();
  candCheck.end();

  if (candCode == 200) {
    if (takeStateLock()) {
      newHost.toCharArray(SERVER_HOST, 64);
      serverHealthy = true;
      giveStateLock();
    }
    Serial.printf("[Discovery] Candidate verified -> %s\n", SERVER_HOST);
    prefs.begin("config", false);
    prefs.putString("server_host", SERVER_HOST);
    prefs.end();
    triggerShortBeep(2000, 100);
  }
}

void seedEnergyFromBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    prefs.begin("energy", true);
    energykWh = prefs.getFloat("kwh", 0.0f);
    prefs.end();
    return;
  }

  HTTPClient http;
  http.setTimeout(3000);
  http.begin(String(SERVER_HOST) + BUDGET_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      if (takeStateLock()) {
        if (doc.containsKey("currentUsage")) energykWh = doc["currentUsage"].as<float>();
        if (doc.containsKey("maximumEnergy")) budgetMaxKWh = doc["maximumEnergy"].as<float>();
        giveStateLock();
      }
      Serial.printf("[Seed] Resumed from backend: %.4f kWh\n", energykWh);
    }
  }
  http.end();
}

void fetchBudget() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(3000);
  http.begin(String(SERVER_HOST) + BUDGET_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      float maxKWh = doc["maximumEnergy"].as<float>();
      if (maxKWh > 0.0f) {
        if (takeStateLock()) {
          budgetMaxKWh = maxKWh;
          giveStateLock();
        }
      }
    }
  }
  http.end();
  lastBudgetFetch = millis();
}

void syncRelayStates() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(3000);
  http.begin(String(SERVER_HOST) + STATE_PATH);
  int code = http.GET();

  if (code == 200) {
    serverHealthy = true;
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body) && doc.is<JsonArray>()) {
      if (takeStateLock()) {
        for (JsonObject obj : doc.as<JsonArray>()) {
          int relay = obj["relayNumber"].as<int>();
          bool desired = obj["status"].as<bool>();
          if (relay == 1) {
            // Grace window: 5 seconds after any local toggle — never let poll override a fresh toggle
            if (millis() - relayChangedAt < 5000) continue;

            if (relayState != desired) {
              relayState = desired;
              digitalWrite(RELAY_PIN, desired ? MAINS_ON : MAINS_OFF); // Physical pin drive INSIDE lock
              relayChangedAt = millis(); // Reset grace to prevent immediate flip-back
              displayNeedsUpdate = true;
              triggerDoubleBeep();
              Serial.printf("[Relay] R1 -> %s (from web poll)\n", desired ? "ON" : "OFF");
            }
          }
        }
        giveStateLock();
      }
    }
  }
  http.end();
  lastStatePoll = millis();
}

void postRelayStatusToBackend(int relayNumber, bool status) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.setTimeout(3000);
  String url = String(SERVER_HOST) + "/api/appliances/relay/" +
               String(relayNumber) + "/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["status"] = status;
  String payload;
  serializeJson(doc, payload);

  int code = http.PUT(payload);
  if (code == 200) {
    Serial.printf("[Relay] R%d -> %s confirmed by backend\n", relayNumber, status ? "ON" : "OFF");
    // NOTE: Do NOT reset relayChangedAt here — it must stay set long enough
    // so syncRelayStates() does not immediately re-poll and overwrite the new state.
    // It expires naturally after 5 seconds.
  } else {
    Serial.printf("[Relay] R%d push failed (code %d)\n", relayNumber, code);
  }
  http.end();
}

void postToBackend(float voltage, float current, float power,
                   float freq, float pf, bool alert) {
  if (millis() - lastBackendPost < BACKEND_POST_MS) return;
  lastBackendPost = millis();

  if (WiFi.status() != WL_CONNECTED) return;

  float curKWh = 0.0f, curBudget = 5.0f;
  if (takeStateLock()) {
    curKWh = energykWh;
    curBudget = budgetMaxKWh;
    giveStateLock();
  }

  float deltaKWh = curKWh - lastPostedKWh;
  if (deltaKWh < 0.0f) deltaKWh = 0.0f;

  StaticJsonDocument<256> req;
  req["energyUsed"]  = deltaKWh;
  req["budget"]      = curBudget;
  req["remaining"]   = curBudget - curKWh;
  req["alert"]       = alert;
  req["voltage"]     = voltage;
  req["current"]     = current;
  req["power"]       = power;
  req["frequency"]   = freq;
  req["powerFactor"] = pf;
  req["energy"]      = curKWh;

  time_t epoch;
  time(&epoch);
  if (epoch > 1000000000L)
    req["timestamp"] = (double)epoch * 1000.0;

  String payload;
  serializeJson(req, payload);

  HTTPClient http;
  http.setTimeout(4000);
  http.begin(String(SERVER_HOST) + READINGS_POST_PATH);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  if (code == 201) {
    lastPostedKWh = curKWh;
    serverHealthy = true;
    String body = http.getString();
    StaticJsonDocument<768> res;
    if (!deserializeJson(res, body)) {
      float maxKWh = res["budgetMaxKWh"].as<float>();
      if (maxKWh > 0.0f) {
        if (takeStateLock()) {
          budgetMaxKWh = maxKWh;
          giveStateLock();
        }
      }
    }
  } else {
    Serial.printf("[POST] Failed code %d\n", code);
    static int failCount = 0;
    failCount++;
    if (failCount >= 3) {
      serverHealthy = false;
      failCount = 0;
    }
  }
  http.end();
}

void networkTask(void *pvParameters) {
  Serial.println("[FreeRTOS] Background network task active on Core 0");

  for (;;) {
    if (WiFi.status() == WL_CONNECTED) {
      // 1. Dispatch pending relay HTTP PUT
      bool shouldPost = false;
      bool status = false;
      if (takeStateLock()) {
        if (pendingRelayPost) {
          pendingRelayPost = false;
          shouldPost = true;
          status = relayState;
        }
        giveStateLock();
      }
      if (shouldPost) {
        postRelayStatusToBackend(1, status);
      }

      // 2. Poll relay state from backend
      if (millis() - lastStatePoll >= STATE_POLL_MS) {
        syncRelayStates();
      }

      // 3. Post sensor readings to backend
      if (millis() - lastBackendPost >= BACKEND_POST_MS) {
        float v = 230.0f, c = 0.0f, p = 0.0f, f = 50.0f, pf = 1.0f;
        bool over = false;
        if (takeStateLock()) {
          v = latestVoltage;
          c = latestCurrent;
          p = latestPower;
          f = latestFreq;
          pf = latestPf;
          over = budgetExceededAlarmFired;
          giveStateLock();
        }
        postToBackend(v, c, p, f, pf, over);
      }

      // 4. Periodic budget fetch
      if (millis() - lastBudgetFetch >= BUDGET_FETCH_MS) {
        fetchBudget();
      }

      // 5. UDP discovery if server connection lost
      handleUdpDiscovery();
    } else {
      ensureWiFi();
    }

    vTaskDelay(pdMS_TO_TICKS(100)); // 100ms non-blocking loop delay
  }
}
