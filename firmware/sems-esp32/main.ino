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

#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <PZEM004Tv30.h>
PZEM004Tv30 pzem(Serial2, 16, 17);
#include <HTTPClient.h>
#include <Preferences.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WiFiManager.h> // Install via Arduino Library Manager
#include <WiFiUdp.h>
#include <Wire.h>
#include <time.h>

// ---------- WiFi / Backend Config ----------
char SERVER_HOST[64] =
    "http://smartenergy.local:4000"; // Loaded from NVS, default mDNS address

const char *READINGS_POST_PATH = "/api/readings";
const char *READINGS_GET_PATH = "/api/readings?limit=1";
const char *BUDGET_PATH = "/api/budget";
const char *STATE_PATH = "/api/appliances/state";

// Flag to track config changes from WiFiManager portal
bool shouldSaveConfig = false;

// Callback for WiFiManager config saving
void saveConfigCallback() {
  Serial.println("[WiFiManager] Config needs saving");
  shouldSaveConfig = true;
}

// ---------- NTP ----------
const char *NTP_SERVER = "pool.ntp.org";
const long GMT_OFFSET_SEC = 0; // Ghana is UTC+0
const int DAYLIGHT_OFFSET = 0;

// ---------- Hardware ----------
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE);

const byte relayPins[4] = {25, 26, 27, 14};   
const byte buttonPins[4] = {32, 33, 19, 18};
const byte buzzerPin = 13;
// PZEM-004T UART pins (RX2=GPIO16, TX2=GPIO17)
// No analog current pin needed

// ---------- Measurement Constants ----------
const float mainsVoltage = 230.0f;   // V
const float sensitivity = 0.100f;    // V/A  (ACS712-20A)
const float zeroVoltage = 2.5f;      // V  at 0 A
const float RATE_GHS_PER_KWH = 1.5f; // for OLED cost display only
extern float energykWh;
extern float cost;
// ---------- Poll / Post Intervals ----------
const unsigned long BACKEND_POST_MS =
    2000; // POST reading every 2 s (prevents DB congestion)
const unsigned long BUDGET_FETCH_MS = 60000; // re-sync budget every 60 s
const unsigned long STATE_POLL_MS = 5000;    // relay state poll every 5 s
const unsigned long NVS_SAVE_MS = 300000;    // NVS energy save every 5 min
extern bool relayState[4];
void updateDisplay(float voltage, float current, float power, float freq, float pf) {
  // Clear buffer and set font
  display.clearBuffer();
  display.setFont(u8g2_font_6x12_tr);

  char buf[64];
  // Title
  display.drawStr(0, 10, "SMART ENERGY");

  // Relay pairs (first line)
  snprintf(buf, sizeof(buf), "R1:%s  R2:%s",
           relayState[0] ? "ON" : "OFF",
           relayState[1] ? "ON" : "OFF");
  display.drawStr(0, 22, buf);

  // Relay pairs (second line)
  snprintf(buf, sizeof(buf), "R3:%s  R4:%s",
           relayState[2] ? "ON" : "OFF",
           relayState[3] ? "ON" : "OFF");
  display.drawStr(0, 34, buf);

  // Current (A) and Power (W)
  snprintf(buf, sizeof(buf), "I:%.2fA  P:%.1fW", current, power);
  display.drawStr(0, 46, buf);

  // Energy and Cost
  snprintf(buf, sizeof(buf), "E:%.2fkWh Cost:GH₵%.2f", energykWh, cost);
  display.drawStr(0, 58, buf);

  // Send buffer to OLED
  display.sendBuffer();
}


// ---------- Runtime State ----------
bool relayState[4] = {false, false, false, false};
bool lastBtn[4] = {true, true, true, true};

// ---------- Non-blocking Button 1 hold detection ----------
unsigned long btn0PressStart = 0;   // millis() when Button 1 was pressed
bool btn0WaitingForRelease = false; // true while Button 1 is held down

// ---------- Deferred relay HTTP post queue (Fix #2) ----------
// Set true on button press; HTTP call fires at end of that loop iteration.
bool pendingRelayPost[4] = {false, false, false, false};

// ---------- Relay change timestamps (Fix #4) ----------
// Used to give a 10s grace window before syncRelayStates() can overwrite
// a locally-toggled relay (prevents poll from reverting a failed PUT).
unsigned long relayChangedAt[4] = {0, 0, 0, 0};

float energykWh = 0.0f;
float cost = 0.0f;
float budgetMaxKWh = 5.0f; // Default, overwritten by server
float lastPostedKWh =
    0.0f; // Tracks last successfully POSTed kWh to compute delta

unsigned long lastEnergy = 0;
unsigned long lastBackendPost = 0;
unsigned long lastBudgetFetch = 0;
unsigned long lastStatePoll = 0;
unsigned long lastNvsSave = 0;

// ---------- Budget Alert State ----------
bool budgetExceededAlarmFired =
    false; // ensures 5s alarm runs only once per budget event
bool nearBudgetWarning = false; // tracks 98% warning state for pulsed beep
float lastSavedKWh = -1.0f;

Preferences prefs;

// ---------- UDP Discovery ----------
WiFiUDP udp;
const unsigned int localUdpPort = 4001;
char incomingPacket[128];

// =============================================================================
// Sensor
// =============================================================================

// PZEM provides current directly; no manual read function required

// =============================================================================
// Display
// =============================================================================

// =============================================================================
// WiFi Management (WiFiManager)
// =============================================================================

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);

  // Add custom parameter for backend host URL to the captive portal
  WiFiManagerParameter custom_server_host(
      "server", "Backend Host URL (e.g. http://192.168.100.5:4000)",
      SERVER_HOST, 64);
  wm.addParameter(&custom_server_host);

  // Set timeout of 3 minutes (180s) to configure WiFi, else restarts
  wm.setConfigPortalTimeout(180);

  // Set connection attempt timeout to 10 seconds so it starts config AP quickly
  // if offline
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
  if (WiFi.status() == WL_CONNECTED)
    return;
  Serial.println("[WiFi] Connection lost. Reconnecting in background...");
  WiFi.disconnect();
  WiFi.begin(); // Connects to saved credentials automatically on ESP32
  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 5000)
    delay(200);
}

// =============================================================================
// Backend helpers — GET & Auto-Discovery
// =============================================================================

unsigned long lastSubnetScan = 0;

bool discoverBackendIP() {
  if (WiFi.status() != WL_CONNECTED)
    return false;
  if (millis() - lastSubnetScan < 15000 && lastSubnetScan > 0)
    return false; // Rate-limit scans to once per 15s
  lastSubnetScan = millis();

  // First check if current SERVER_HOST is already healthy
  HTTPClient checkHttp;
  checkHttp.setTimeout(1000);
  checkHttp.begin(String(SERVER_HOST) + "/api/health");
  int checkCode = checkHttp.GET();
  checkHttp.end();

  if (checkCode == 200) {
    return true;
  }

  Serial.printf("[AutoScan] Host %s unreachable. Scanning local Wi-Fi subnet "
                "for backend on port 4000...\n",
                SERVER_HOST);

  IPAddress local = WiFi.localIP();
  if (local[0] == 0)
    return false;

  IPAddress target = local;
  WiFiClient client;

  for (int i = 1; i < 255; i++) {
    if (i == local[3])
      continue; // Skip self

    target[3] = i;
    // Fast TCP connect test on port 4000 (100ms timeout)
    if (client.connect(target, 4000, 100)) {
      client.stop();
      String candidate = "http://" + target.toString() + ":4000";
      Serial.printf(
          "[AutoScan] Found open port 4000 at %s! Verifying health...\n",
          candidate.c_str());

      HTTPClient http;
      http.setTimeout(1500);
      http.begin(candidate + "/api/health");
      int code = http.GET();
      http.end();

      if (code == 200) {
        candidate.toCharArray(SERVER_HOST, 64);
        Serial.printf("[AutoScan] SUCCESS! Backend verified & updated "
                      "SERVER_HOST to: %s\n",
                      SERVER_HOST);

        prefs.begin("config", false);
        prefs.putString("server_host", SERVER_HOST);
        prefs.end();

        return true;
      }
    }
  }

  Serial.println(
      "[AutoScan] Subnet scan finished — backend not found on this subnet.");
  return false;
}

void seedEnergyFromBackend() {
  if (WiFi.status() != WL_CONNECTED) {
    prefs.begin("energy", true);
    energykWh = prefs.getFloat("kwh", 0.0f);
    prefs.end();
    Serial.printf("[Seed] No WiFi — using NVS value: %.4f kWh\n", energykWh);
    return;
  }

  HTTPClient http;
  http.setTimeout(5000);
  http.begin(String(SERVER_HOST) + BUDGET_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body)) {
      if (doc.containsKey("currentUsage")) {
        energykWh = doc["currentUsage"].as<float>();
        Serial.printf(
            "[Seed] Resumed cumulative energy from backend budget: %.4f kWh\n",
            energykWh);
      }
      if (doc.containsKey("maximumEnergy")) {
        budgetMaxKWh = doc["maximumEnergy"].as<float>();
      }
    }
  } else {
    prefs.begin("energy", true);
    energykWh = prefs.getFloat("kwh", 0.0f);
    prefs.end();
    Serial.printf("[Seed] Backend error %d — using NVS: %.4f kWh\n", code,
                  energykWh);
  }
  http.end();
}

void fetchBudget() {
  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED)
    return;

  HTTPClient http;
  http.setTimeout(5000);
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
  if (WiFi.status() != WL_CONNECTED)
    return;

  HTTPClient http;
  http.setTimeout(5000);
  http.begin(String(SERVER_HOST) + STATE_PATH);
  int code = http.GET();

  if (code == 200) {
    String body = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, body) && doc.is<JsonArray>()) {
      for (JsonObject obj : doc.as<JsonArray>()) {
        int relay = obj["relayNumber"].as<int>();
        bool desired = obj["status"].as<bool>();
        if (relay < 1 || relay > 4)
          continue;
        int idx = relay - 1;
        // Fix #4: Skip if this relay was toggled locally within the last 10s.
        // This prevents the poll from reverting a button press whose HTTP PUT
        // hasn't reached the DB yet.
        if (millis() - relayChangedAt[idx] < 10000) {
          Serial.printf("[Relay] R%d grace window active — skipping poll overwrite\n", relay);
          continue;
        }
        if (relayState[idx] != desired) {
          relayState[idx] = desired;
          digitalWrite(relayPins[idx],
                       desired ? LOW : HIGH); // Active-low relays
          Serial.printf("[Relay] R%d → %s (from poll)\n", relay, desired ? "ON" : "OFF");
        }
      }
    }
  }
  http.end();
  lastStatePoll = millis();
}

void postRelayStatusToBackend(int relayNumber, bool status) {
  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED)
    return;

  HTTPClient http;
  http.setTimeout(3000); // Fix #2: reduced from 5s — fail faster, loop stays responsive
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
    Serial.printf("[Relay] Pushed physical button state R%d → %s to backend\n",
                  relayNumber, status ? "ON" : "OFF");
  } else {
    Serial.printf("[Relay] Failed to push R%d status to backend: %d\n",
                  relayNumber, code);
  }
  http.end();
}

// =============================================================================
// Backend POST
// =============================================================================

void postToBackend(float voltage, float current, float power, float freq, float pf, bool alert) {
  if (millis() - lastBackendPost < BACKEND_POST_MS)
    return;
  lastBackendPost = millis();

  ensureWiFi();
  if (WiFi.status() != WL_CONNECTED)
    return;

  // Send only the energy delta since the last POST, not the cumulative total.
  // This prevents the backend from adding the full running total to the budget
  // on every reading insert.
  float deltaKWh = energykWh - lastPostedKWh;
  if (deltaKWh < 0.0f)
    deltaKWh = 0.0f; // guard against rollback

  StaticJsonDocument<256> req;
  // Send only the delta energy used since last POST
  // removed duplicate deltaKWh declaration
  req["energyUsed"] = deltaKWh;
  req["budget"] = budgetMaxKWh;
  req["remaining"] = budgetMaxKWh - energykWh;
  req["alert"] = alert;
  // New measurement fields from PZEM
  req["voltage"] = voltage;
  req["current"] = current;
  req["power"] = power;
  req["frequency"] = freq;
  req["powerFactor"] = pf;
  // Also include cumulative energy for completeness
  req["energy"] = energykWh;

  time_t epoch;
  time(&epoch);
  if (epoch > 1000000000L) {
    req["timestamp"] = (double)epoch * 1000.0;
  }
  String payload;
  serializeJson(req, payload);

  HTTPClient http;
  http.setTimeout(15000);

  bool success = false;
  // Try up to 3 attempts with exponential backoff
  // Fix #3: Removed redundant GET /api/health before every POST.
  // The retry loop handles failures via HTTP response code — no pre-check needed.
  for (int attempt = 0; attempt < 3 && !success; attempt++) {
    http.begin(String(SERVER_HOST) + READINGS_POST_PATH);
    http.addHeader("Content-Type", "application/json");
    int code = http.POST(payload);
    if (code == 201) {
      lastPostedKWh = energykWh;
      String body = http.getString();
      StaticJsonDocument<768> res;
      if (!deserializeJson(res, body)) {
        float maxKWh = res["budgetMaxKWh"].as<float>();
        if (maxKWh > 0.0f) budgetMaxKWh = maxKWh;
      }
      success = true;
      Serial.printf("[POST] Success on attempt %d, code %d\n", attempt + 1, code);
    } else {
      Serial.printf("[POST] Failed (code %d) on attempt %d\n", code, attempt + 1);
      // Backoff before next attempt
      delay(500 * (attempt + 1));
    }
    http.end();
  }
  if (!success) {
    Serial.println("[POST] All attempts failed – invoking backend auto-discovery");
    discoverBackendIP();
  }
}

void maybeSaveEnergyToNVS() {
  bool valueMoved = (energykWh - lastSavedKWh) > 0.001f;
  bool timerExpired = (millis() - lastNvsSave) >= NVS_SAVE_MS;
  if (!valueMoved && !timerExpired)
    return;

  prefs.begin("energy", false);
  prefs.putFloat("kwh", energykWh);
  prefs.end();
  lastSavedKWh = energykWh;
  lastNvsSave = millis();
}

// =============================================================================
// setup / loop
// =============================================================================

void setup() {
  Serial.begin(115200);
  display.begin();

  pinMode(buzzerPin, OUTPUT);
  digitalWrite(buzzerPin, LOW);

  // Initialize UART for PZEM (RX2=GPIO16, TX2=GPIO17)
  Serial2.begin(9600, SERIAL_8N1, 16, 17);
  // Instantiate PZEM (global scope) will be used later

  for (int i = 0; i < 4; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH); // HIGH = relay OFF
    pinMode(buttonPins[i], INPUT_PULLUP);
  }

  // Load custom server host config
  prefs.begin("config", false);
  String savedHost =
      prefs.getString("server_host", "http://10.57.236.171:4000");
  if (savedHost.indexOf("172.20.10.5") != -1 ||
      savedHost.indexOf("127.0.0.1") != -1) {
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

  // mDNS responder to support resolving .local hostnames
  if (WiFi.status() == WL_CONNECTED) {
    if (MDNS.begin("smartenergy")) {
      Serial.println("[mDNS] Responder started: http://smartenergy.local");
    } else {
      Serial.println("[mDNS] Error setting up responder!");
    }

    // Start UDP auto-discovery listener
    udp.begin(localUdpPort);
    Serial.printf("[UDP] Listening on port %d for auto-discovery...\n",
                  localUdpPort);
  }

  discoverBackendIP();
  seedEnergyFromBackend();
  lastPostedKWh =
      energykWh; // baseline so first POST sends delta=0, not full history
  fetchBudget();

  lastEnergy = millis();
}

void loop() {
  // Check for auto-discovery broadcast
  int packetSize = udp.parsePacket();
  if (packetSize > 0) {
    int len = udp.read(incomingPacket, 127);
    if (len > 0) {
      incomingPacket[len] = 0;
    }
    String msg = String(incomingPacket);
    if (msg.startsWith("SMART_ENERGY_MONITOR_BACKEND:")) {
      String newHost =
          msg.substring(29); // Length of "SMART_ENERGY_MONITOR_BACKEND:" is 29
      if (newHost.length() > 0 && newHost.length() < 64 &&
          !newHost.equals(SERVER_HOST)) {
        newHost.toCharArray(SERVER_HOST, 64);
        Serial.printf("[Discovery] Automatically updated SERVER_HOST to: %s\n",
                      SERVER_HOST);

        // Save to preferences so it persists
        prefs.begin("config", false);
        prefs.putString("server_host", SERVER_HOST);
        prefs.end();

        // Flash buzzer briefly to indicate auto-discovery success
        tone(buzzerPin, 2000, 100);
      }
    }
  }

  // ── Physical buttons — toggle relay immediately, queue HTTP post ──────────
  //
  // Fix #1: Button 1 uses a non-blocking state machine so the loop does NOT
  // freeze for 3 seconds. The relay pin changes on the falling edge (press).
  // If the button is released within 3s → short press (toggle relay).
  // If still held at 3s → long press (launch config portal, revert relay).
  //
  // Fix #2: All buttons set pendingRelayPost[i] instead of calling
  // postRelayStatusToBackend() inline. The HTTP PUT fires at the bottom of
  // the loop after sensor reads, so the relay hardware reacts instantly.

  // ── Buttons 2, 3, 4 — simple toggle on falling edge ──────────────────────
  for (int i = 1; i < 4; i++) {
    bool r = digitalRead(buttonPins[i]);
    if (lastBtn[i] && !r) {  // falling edge
      relayState[i] = !relayState[i];
      digitalWrite(relayPins[i], relayState[i] ? LOW : HIGH); // instant hardware
      relayChangedAt[i] = millis();  // mark for grace-window in syncRelayStates
      pendingRelayPost[i] = true;    // queue HTTP PUT
      Serial.printf("[Button] B%d pressed → R%d %s (queued)\n",
                    i + 1, i + 1, relayState[i] ? "ON" : "OFF");
    }
    lastBtn[i] = r;
  }

  // ── Button 1 — non-blocking hold detection ────────────────────────────────
  {
    bool btn0 = digitalRead(buttonPins[0]);

    if (lastBtn[0] && !btn0) {  // falling edge: button just pressed
      btn0PressStart = millis();
      btn0WaitingForRelease = true;
      // Toggle relay hardware IMMEDIATELY — don't wait for hold result.
      // If this turns out to be a long press we revert it before config portal.
      relayState[0] = !relayState[0];
      digitalWrite(relayPins[0], relayState[0] ? LOW : HIGH);
      relayChangedAt[0] = millis();
      Serial.printf("[Button] B1 pressed → R1 %s (waiting for release)\n",
                    relayState[0] ? "ON" : "OFF");
    }

    if (!btn0 && btn0WaitingForRelease) {
      unsigned long held = millis() - btn0PressStart;
      if (held > 2500) {
        tone(buzzerPin, 1500, 100); // warning beep at 2.5s, non-blocking
      }
      if (held >= 3000) {
        // Long press confirmed — revert the relay toggle and open config portal
        btn0WaitingForRelease = false;
        relayState[0] = !relayState[0];  // revert
        digitalWrite(relayPins[0], relayState[0] ? LOW : HIGH);
        Serial.println("[Config] Button 1 held 3s. Reverting relay and launching Config Portal...");

        tone(buzzerPin, 1000);
        delay(500);
        noTone(buzzerPin);

        display.clearBuffer();
        display.setFont(u8g2_font_6x12_tr);
        display.drawStr(0, 10, "CONFIG PORTAL");
        display.drawStr(0, 25, "AP: Smart-Energy-AP");
        display.drawStr(0, 40, "Pass: 12345678");
        display.drawStr(0, 55, "Go to 192.168.4.1");
        display.sendBuffer();

        WiFiManager wm;
        wm.setSaveConfigCallback(saveConfigCallback);
        WiFiManagerParameter custom_server_host(
            "server", "Backend Host URL (e.g. http://192.168.100.5:4000)",
            SERVER_HOST, 64);
        wm.addParameter(&custom_server_host);
        wm.setConfigPortalTimeout(180);

        if (wm.startConfigPortal("Smart-Energy-AP", "12345678")) {
          if (shouldSaveConfig) {
            strcpy(SERVER_HOST, custom_server_host.getValue());
            Serial.printf("[Config] Saving new Server Host: %s\n", SERVER_HOST);
            prefs.begin("config", false);
            prefs.putString("server_host", SERVER_HOST);
            prefs.end();
            shouldSaveConfig = false;
          }
          Serial.println("[Config] Config Portal closed successfully.");
        } else {
          Serial.println("[Config] Config Portal timeout.");
        }

        seedEnergyFromBackend();
        fetchBudget();
      }
    }

    if (btn0 && btn0WaitingForRelease) {  // rising edge: button released
      btn0WaitingForRelease = false;
      unsigned long held = millis() - btn0PressStart;
      if (held < 3000) {
        // Short press confirmed — queue the HTTP PUT
        pendingRelayPost[0] = true;
        Serial.printf("[Button] B1 short press confirmed → R1 %s (queued)\n",
                      relayState[0] ? "ON" : "OFF");
      }
    }

    lastBtn[0] = btn0;
  }

  // Read raw measurements from PZEM hardware
  float rawVoltage = pzem.voltage();
  float rawCurrent = pzem.current();
  float rawPower = pzem.power();
  float rawFreq = pzem.frequency();
  float rawPf = pzem.pf();
  float rawEnergy = pzem.energy();

  bool hasRealLoad = (!isnan(rawCurrent) && rawCurrent > 0.05f);

  float voltage = 230.0f;
  float current = 0.0f;
  float power = 0.0f;
  float freq = 50.0f;
  float pf = 1.0f;

  if (hasRealLoad) {
    // ── Real Hardware Mode: Use actual PZEM measurements ──
    voltage = (!isnan(rawVoltage) && rawVoltage > 0.0f) ? rawVoltage : 230.0f;
    current = rawCurrent;
    power = (!isnan(rawPower) && rawPower >= 0.0f) ? rawPower : (current * voltage * (rawPf > 0 ? rawPf : 1.0f));
    freq = (!isnan(rawFreq) && rawFreq > 0.0f) ? rawFreq : 50.0f;
    pf = (!isnan(rawPf) && rawPf > 0.0f) ? rawPf : 1.0f;
    if (!isnan(rawEnergy) && rawEnergy >= 0.0f) energykWh = rawEnergy;
  } else {
    // ── Simulation Mode: Active when relays are ON but no physical load is connected ──
    bool anyRelayOn = relayState[0] || relayState[1] || relayState[2] || relayState[3];
    if (anyRelayOn) {
      voltage = 228.0f + (random(-15, 15) / 10.0f);
      float baseCurrent = 0.0f;
      if (relayState[0]) baseCurrent += 0.45f; // ~100W Appliance
      if (relayState[1]) baseCurrent += 0.85f; // ~200W Appliance
      if (relayState[2]) baseCurrent += 1.20f; // ~275W Appliance
      if (relayState[3]) baseCurrent += 0.30f; // ~70W Appliance

      current = baseCurrent + (random(-5, 5) / 100.0f);
      if (current < 0.05f) current = 0.05f;
      pf = 0.95f + (random(-2, 2) / 100.0f);
      freq = 50.0f + (random(-10, 10) / 100.0f);
      power = voltage * current * pf;

      // Accumulate energy (kWh) over interval
      float deltaHours = 0.100f / 3600.0f; // 100ms loop interval
      energykWh += (power / 1000.0f) * deltaHours;
    } else {
      voltage = 230.0f + (random(-10, 10) / 10.0f);
      current = 0.0f;
      power = 0.0f;
      freq = 50.0f;
      pf = 1.0f;
    }
  }

  // Update local state
  cost = energykWh * RATE_GHS_PER_KWH;
  // Store additional metrics for display and POST
  // (frequency and power factor stored in local vars)
  // Note: mainsVoltage not used for calculations now

  // ── Alerts & Safety ──────────────────────────────────────────────────────
  bool overBudget = (energykWh >= budgetMaxKWh);
  bool nearBudget = (!overBudget && budgetMaxKWh > 0.0f &&
                     (energykWh / budgetMaxKWh) >= 0.98f);

  if (overBudget) {
    if (!budgetExceededAlarmFired) {
      // ── First time budget is exceeded: 5-second continuous alarm ──
      budgetExceededAlarmFired = true;
      Serial.println("[Alert] Budget exceeded — sounding 5 s alarm and cutting "
                     "all relays!");

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
  updateDisplay(voltage, current, power, freq, pf);
  postToBackend(voltage, current, power, freq, pf, overBudget);

  // Sync tasks
  if (millis() - lastBudgetFetch >= BUDGET_FETCH_MS)
    fetchBudget(); // 60 s
  if (millis() - lastStatePoll >= STATE_POLL_MS)
    syncRelayStates(); // 5 s

  maybeSaveEnergyToNVS();

  // ── Fix #2: Dispatch one pending relay HTTP PUT per loop cycle ────────────
  // The relay hardware already toggled instantly on the button press.
  // This fires the backend update after all sensor work, keeping the loop
  // responsive and decoupling hardware latency from network latency.
  for (int i = 0; i < 4; i++) {
    if (pendingRelayPost[i]) {
      pendingRelayPost[i] = false;
      postRelayStatusToBackend(i + 1, relayState[i]);
      break; // one per loop cycle to avoid back-to-back blocking
    }
  }

  delay(100);
}