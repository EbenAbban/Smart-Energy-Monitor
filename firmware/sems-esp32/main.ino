// =============================================================================
// Smart Energy Monitor — ESP32 Firmware (WiFiManager Edition)
// =============================================================================
// Features:
//   1. Dynamic WiFi Setup: Uses WiFiManager to start an Access Point
//      ("Smart-Energy-AP") if it cannot connect to saved credentials.
//   2. Dynamic Server Host: The backend address (SERVER_HOST) can be input via
//      the config portal and is persisted in NVS Preferences.
//   3. Config Reset: Hold Button 1 (GPIO 32) on boot to clear saved WiFi
//      credentials and reset the backend server address.
//   4. Relay sync: Polls backend status every 5 s to control relay states.
//   5. Energy re-seeding: Restores cumulative energy (kWh) from DB or NVS.
//   6. NTP Clock: Syncs time on boot to provide accurate timestamps to DB.
// =============================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include <time.h>
#include <WiFiManager.h>   // Install via Arduino Library Manager

// ---------- WiFi / Backend Config ----------
char SERVER_HOST[64] = "http://10.57.236.171:4000"; // Loaded from NVS, default PC IP

const char* READINGS_POST_PATH = "/api/readings";
const char* READINGS_GET_PATH  = "/api/readings?limit=1";
const char* BUDGET_PATH        = "/api/budget";
const char* STATE_PATH         = "/api/appliances/state";

// Flag to track config changes from WiFiManager portal
bool shouldSaveConfig = false;

// Callback for WiFiManager config saving
void saveConfigCallback() {
  Serial.println("[WiFiManager] Config needs saving");
  shouldSaveConfig = true;
}

// ---------- NTP ----------
const char* NTP_SERVER       = "pool.ntp.org";
const long  GMT_OFFSET_SEC   = 0;    // Ghana is UTC+0
const int   DAYLIGHT_OFFSET  = 0;

// ---------- Hardware ----------
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE);

const byte relayPins[4]  = {25, 26, 27, 14};
const byte buttonPins[4] = {32, 33, 18, 19};
const byte buzzerPin     = 13;
const byte currentPin    = 34;  // ACS712 analogue output

// ---------- Measurement Constants ----------
const float mainsVoltage     = 230.0f;   // V
const float sensitivity      = 0.100f;   // V/A  (ACS712-20A)
const float zeroVoltage      = 2.5f;     // V  at 0 A
const float RATE_GHS_PER_KWH = 1.5f;    // for OLED cost display only

// ---------- Poll / Post Intervals ----------
const unsigned long BACKEND_POST_MS  = 2000;    // POST reading every 2 s (prevents DB congestion)
const unsigned long BUDGET_FETCH_MS  = 60000;   // re-sync budget every 60 s
const unsigned long STATE_POLL_MS    = 5000;    // relay state poll every 5 s
const unsigned long NVS_SAVE_MS      = 300000;  // NVS energy save every 5 min

// ---------- Runtime State ----------
bool relayState[4] = {false, false, false, false};
bool lastBtn[4]    = {true,  true,  true,  true};

float energykWh    = 0.0f;
float cost         = 0.0f;
float budgetMaxKWh = 5.0f; // Default, overwritten by server
float lastPostedKWh = 0.0f; // Tracks last successfully POSTed kWh to compute delta

unsigned long lastEnergy      = 0;
unsigned long lastBackendPost = 0;
unsigned long lastBudgetFetch = 0;
unsigned long lastStatePoll   = 0;
unsigned long lastNvsSave     = 0;

// ---------- Budget Alert State ----------
bool budgetExceededAlarmFired = false; // ensures 5s alarm runs only once per budget event
bool nearBudgetWarning        = false; // tracks 98% warning state for pulsed beep
float         lastSavedKWh    = -1.0f;

Preferences prefs;

// =============================================================================
// Sensor
// =============================================================================

float readCurrent() {
  long s = 0;
  for (int i = 0; i < 500; i++) s += analogRead(currentPin);
  float adc = s / 500.0f;
  float v   = adc * 3.3f / 4095.0f;
  float c   = (v - zeroVoltage) / sensitivity;
  return (c < 0.0f) ? -c : c;
}

// =============================================================================
// Display
// =============================================================================

void updateDisplay(float current, float power) {
  display.clearBuffer();
  display.setFont(u8g2_font_6x12_tr);
  display.drawStr(0, 10, "SMART ENERGY");

  for (int i = 0; i < 4; i++) {
    char b[24];
    sprintf(b, "R%d:%s", i + 1, relayState[i] ? "ON" : "OFF");
    display.drawStr((i < 2) ? 0 : 64, (i % 2) ? 34 : 22, b);
  }

  char l[32];
  sprintf(l, "I:%.2fA",    current);   display.drawStr(0,  46, l);
  sprintf(l, "P:%.1fW",    power);     display.drawStr(64, 46, l);
  sprintf(l, "E:%.3fkWh",  energykWh); display.drawStr(0,  58, l);
  sprintf(l, "C:GHS%.2f",  cost);      display.drawStr(64, 58, l);
  display.sendBuffer();
}

// =============================================================================
// WiFi Management (WiFiManager)
// =============================================================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);

  // Add custom parameter for backend host URL to the captive portal
  WiFiManagerParameter custom_server_host("server", "Backend Host URL (e.g. http://192.168.100.5:4000)", SERVER_HOST, 64);
  wm.addParameter(&custom_server_host);

  // Set timeout of 3 minutes (180s) to configure WiFi, else restarts
  wm.setConfigPortalTimeout(180);
  
  // Set connection attempt timeout to 10 seconds so it starts config AP quickly if offline
  wm.setConnectTimeout(10);

  Serial.println("[WiFiManager] Starting connection attempt...");
  if (!wm.autoConnect("Smart-Energy-AP", "12345678")) {
    Serial.println("[WiFiManager] Failed to connect/configure. Rebooting...");
    delay(3000);
    ESP.restart();
  }

  Serial.println("[WiFiManager] Connected successfully!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  // Save new backend host if modified in config portal
  if (shouldSaveConfig) {
    strcpy(SERVER_HOST, custom_server_host.getValue());
    Serial.printf("[Config] Saving new Server Host: %s\n", SERVER_HOST);
    prefs.begin("config", false);
    prefs.putString("server_host", SERVER_HOST);
    prefs.end();
  }
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("[WiFi] Connection lost. Reconnecting in background...");
  WiFi.disconnect();
  WiFi.begin(); // Connects to saved credentials automatically on ESP32
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 5000)
    delay(200);
}

// =============================================================================
// Backend helpers — GET
// =============================================================================

void seedEnergyFromBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    prefs.begin("energy", true);
    energykWh = prefs.getFloat("kwh", 0.0f);
    prefs.end();
    Serial.printf("[Seed] No WiFi — using NVS value: %.4f kWh\n", energykWh);
    return;
  }

  HTTPClient http;
  http.begin(String(SERVER_HOST) + BUDGET_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      if (doc.containsKey("currentUsage")) {
        energykWh = doc["currentUsage"].as<float>();
        Serial.printf("[Seed] Resumed cumulative energy from backend budget: %.4f kWh\n", energykWh);
      }
      if (doc.containsKey("maximumEnergy")) {
        budgetMaxKWh = doc["maximumEnergy"].as<float>();
      }
    }
  } else {
    prefs.begin("energy", true);
    energykWh = prefs.getFloat("kwh", 0.0f);
    prefs.end();
    Serial.printf("[Seed] Backend error %d — using NVS: %.4f kWh\n", code, energykWh);
  }
  http.end();
}

void fetchBudget() {
  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(SERVER_HOST) + BUDGET_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      float maxKWh = doc["maximumEnergy"].as<float>();
      if (maxKWh > 0.0f) {
        budgetMaxKWh = maxKWh;
        Serial.printf("[Budget] Synced: %.4f kWh\n", budgetMaxKWh);
      }
    }
  }
  http.end();
  lastBudgetFetch = millis();
}

void syncRelayStates() {
  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(String(SERVER_HOST) + STATE_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body) && doc.is<JsonArray>()) {
      for (JsonObject obj : doc.as<JsonArray>()) {
        int  relay  = obj["relayNumber"].as<int>();
        bool desired = obj["status"].as<bool>();
        if (relay < 1 || relay > 4) continue;
        int idx = relay - 1;
        if (relayState[idx] != desired) {
          relayState[idx] = desired;
          digitalWrite(relayPins[idx], desired ? LOW : HIGH); // Active-low relays
          Serial.printf("[Relay] R%d → %s\n", relay, desired ? "ON" : "OFF");
        }
      }
    }
  }
  http.end();
  lastStatePoll = millis();
}

void postRelayStatusToBackend(int relayNumber, bool status) {
  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  String url = String(SERVER_HOST) + "/api/appliances/relay/" + String(relayNumber) + "/status";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<128> doc;
  doc["status"] = status;

  String payload;
  serializeJson(doc, payload);

  int code = http.PUT(payload);
  if (code == 200) {
    Serial.printf("[Relay] Pushed physical button state R%d → %s to backend\n", relayNumber, status ? "ON" : "OFF");
  } else {
    Serial.printf("[Relay] Failed to push R%d status to backend: %d\n", relayNumber, code);
  }
  http.end();
}


// =============================================================================
// Backend POST
// =============================================================================

void postToBackend(float current, float power, bool alert) {
  if (millis() - lastBackendPost < BACKEND_POST_MS) return;
  lastBackendPost = millis();

  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED) return;

  // Send only the energy delta since the last POST, not the cumulative total.
  // This prevents the backend from adding the full running total to the budget
  // on every reading insert.
  float deltaKWh = energykWh - lastPostedKWh;
  if (deltaKWh < 0.0f) deltaKWh = 0.0f; // guard against rollback

  StaticJsonDocument<256> req;
  req["energyUsed"] = deltaKWh;
  req["budget"]     = budgetMaxKWh;
  req["remaining"]  = budgetMaxKWh - energykWh;
  req["alert"]      = alert;
  req["voltage"]    = mainsVoltage;
  req["current"]    = current;
  req["power"]      = power;

  time_t epoch;
  time(&epoch);
  if (epoch > 1000000000L) {
    req["timestamp"] = (double)epoch * 1000.0;
  }

  String payload;
  serializeJson(req, payload);

  HTTPClient http;
  http.setTimeout(15000); // 15s — covers Neon cold-start wake (~5-10s)
  http.begin(String(SERVER_HOST) + READINGS_POST_PATH);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(payload);

  if (code == 201) {
    // Only advance the baseline on confirmed success
    lastPostedKWh = energykWh;
    String body = http.getString();
    StaticJsonDocument<768> res;
    if (!deserializeJson(res, body)) {
      float maxKWh = res["budgetMaxKWh"].as<float>();
      if (maxKWh > 0.0f) {
        budgetMaxKWh = maxKWh;
      }
    }
  } else if (code > 0) {
    Serial.printf("[POST] HTTP %d\n", code);
  } else {
    Serial.printf("[POST] Failed: %s\n", http.errorToString(code).c_str());
  }
  http.end();
}

void maybeSaveEnergyToNVS() {
  bool valueMoved    = (energykWh - lastSavedKWh) > 0.001f;
  bool timerExpired  = (millis() - lastNvsSave) >= NVS_SAVE_MS;
  if (!valueMoved && !timerExpired) return;

  prefs.begin("energy", false);
  prefs.putFloat("kwh", energykWh);
  prefs.end();
  lastSavedKWh = energykWh;
  lastNvsSave  = millis();
}

// =============================================================================
// setup / loop
// =============================================================================

void setup() {
  Serial.begin(115200);
  display.begin();

  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  for (int i = 0; i < 4; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH);  // HIGH = relay OFF
    pinMode(buttonPins[i], INPUT_PULLUP);
  }

  // Load custom server host config
  prefs.begin("config", false);
  String savedHost = prefs.getString("server_host", "http://10.57.236.171:4000");
  if (savedHost.indexOf("172.20.10.5") != -1 || savedHost.indexOf("127.0.0.1") != -1) {
    savedHost = "http://10.57.236.171:4000";
    prefs.putString("server_host", savedHost);
  }
  savedHost.toCharArray(SERVER_HOST, 64);
  prefs.end();
  Serial.printf("[Config] Loaded Server Host: %s\n", SERVER_HOST);

  // Force reset configuration if Button 1 (GPIO 32) is held on startup
  delay(100);
  if (digitalRead(buttonPins[0]) == LOW) {
    Serial.println("[Config] Button 1 held on boot! Clearing settings...");
    
    // Buzz to notify user of reset initiation
    tone(buzzerPin, 1000);
    delay(500);
    noTone(buzzerPin);
    
    WiFiManager wm;
    wm.resetSettings(); // Wipes SSID/Password
    
    prefs.begin("config", false);
    prefs.remove("server_host"); // Wipes custom server IP
    prefs.end();
    
    strcpy(SERVER_HOST, "http://172.20.10.5:4000");
    Serial.println("[Config] Settings wiped. Restarting ESP32...");
    delay(1000);
    ESP.restart();
  }

  connectWiFi();

  // NTP Time Sync
  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET, NTP_SERVER);
    Serial.print("Waiting for NTP");
    time_t epoch = 0;
    unsigned long start = millis();
    while (epoch < 1000000000L && millis() - start < 5000) {
      delay(200);
      time(&epoch);
      Serial.print(".");
    }
    Serial.println();
    if (epoch > 1000000000L)
      Serial.printf("NTP OK — epoch: %ld\n", (long)epoch);
    else
      Serial.println("NTP timed out — using server clock.");
  }

  seedEnergyFromBackend();
  lastPostedKWh = energykWh; // baseline so first POST sends delta=0, not full history
  fetchBudget();

  lastEnergy = millis();
}

void loop() {
  // Physical buttons — toggle relay and push state to backend
  for (int i = 0; i < 4; i++) {
    bool r = digitalRead(buttonPins[i]);
    if (lastBtn[i] && !r) {
      relayState[i] = !relayState[i];
      digitalWrite(relayPins[i], relayState[i] ? LOW : HIGH);
      delay(150);
      // Notify backend so dashboard stays in sync and syncRelayStates()
      // does not revert this physical button press on the next poll.
      int relayNumber = i + 1;
      postRelayStatusToBackend(relayNumber, relayState[i]);
    }
    lastBtn[i] = r;
  }

  // Energy
  float current = readCurrent();
  float power   = current * mainsVoltage;
  unsigned long now = millis();
  float hrs = (now - lastEnergy) / 3600000.0f;
  energykWh += (power * hrs) / 1000.0f;
  lastEnergy = now;
  cost = energykWh * RATE_GHS_PER_KWH;

  // ── Alerts & Safety ──────────────────────────────────────────────────────
  bool overBudget  = (energykWh >= budgetMaxKWh);
  bool nearBudget  = (!overBudget && budgetMaxKWh > 0.0f &&
                      (energykWh / budgetMaxKWh) >= 0.98f);

  if (overBudget) {
    if (!budgetExceededAlarmFired) {
      // ── First time budget is exceeded: 5-second continuous alarm ──
      budgetExceededAlarmFired = true;
      Serial.println("[Alert] Budget exceeded — sounding 5 s alarm and cutting all relays!");

      tone(buzzerPin, 2000);
      delay(5000);
      noTone(buzzerPin);

      // Cut all relays and report to backend
      for (int i = 0; i < 4; i++) {
        relayState[i] = false;
        digitalWrite(relayPins[i], HIGH); // Active-low: HIGH = OFF
        postRelayStatusToBackend(i + 1, false);
      }
      Serial.println("[Alert] All appliances turned OFF.");
    }
    // Silence buzzer once alarm has fired (relays already cut)
    noTone(buzzerPin);

  } else if (nearBudget) {
    // ── 98% warning: pulsed beep — 1 s ON, 0.5 s OFF ──
    budgetExceededAlarmFired = false; // reset if budget is reset/reduced
    unsigned long t = millis();
    unsigned long phase = t % 1500UL; // 1000 ms ON + 500 ms OFF = 1500 ms cycle
    if (phase < 1000UL) {
      tone(buzzerPin, 1500);
    } else {
      noTone(buzzerPin);
    }

  } else {
    // ── Safe zone: silence everything and reset alarm guard ──
    budgetExceededAlarmFired = false;
    noTone(buzzerPin);
  }

  // Display & send
  updateDisplay(current, power);
  postToBackend(current, power, overBudget);

  // Sync tasks
  if (millis() - lastBudgetFetch >= BUDGET_FETCH_MS) fetchBudget();   // 60 s
  if (millis() - lastStatePoll   >= STATE_POLL_MS)   syncRelayStates(); // 5 s

  maybeSaveEnergyToNVS();

  delay(100);
}