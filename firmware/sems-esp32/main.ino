// =============================================================================
// Smart Energy Monitor — ESP32 Firmware (Single-Channel Modular Edition)
// =============================================================================

#include "config.h"
#include "display_manager.h"
#include "wifi_manager_helper.h"
#include "network_task.h"
#include "hardware_controls.h"

// =============================================================================
// API & Timing Constants Definitions
// =============================================================================

const char *READINGS_POST_PATH = "/api/readings";
const char *READINGS_GET_PATH  = "/api/readings?limit=1";
const char *BUDGET_PATH        = "/api/budget";
const char *STATE_PATH         = "/api/appliances/state";

const char *NTP_SERVER     = "pool.ntp.org";
const long  GMT_OFFSET_SEC  = 0;
const int   DAYLIGHT_OFFSET = 0;

const float RATE_GHS_PER_KWH = 1.5f;

const unsigned long BACKEND_POST_MS = 3000UL;  // 3s interval for sensor readings
const unsigned long BUDGET_FETCH_MS = 60000UL; // 60s budget sync
const unsigned long STATE_POLL_MS   = 1000UL;  // 1s dashboard sync poll
const unsigned long NVS_SAVE_MS     = 300000UL;

const unsigned long LONG_PRESS_MS   = 1000UL;  // 1s threshold for relay toggle
const unsigned long PORTAL_PRESS_MS = 5000UL;  // 5s threshold for WiFi Portal

const unsigned int localUdpPort = 4001;

// =============================================================================
// Hardware Instances Definitions
// =============================================================================

PZEM004Tv30 pzem(PZEM_SERIAL, PZEM_RX_PIN, PZEM_TX_PIN);
U8G2_SH1106_128X64_NONAME_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE);
Preferences prefs;
WiFiUDP udp;

// =============================================================================
// Global Thread-Safe State Definitions
// =============================================================================

SemaphoreHandle_t stateMutex = NULL;

char SERVER_HOST[64] = "http://smartenergy.local:4000";
bool shouldSaveConfig = false;
volatile bool serverHealthy = true;
volatile bool displayNeedsUpdate = true;

bool relayState           = true;  // Default MAINS_ON
bool pendingRelayPost     = false;
unsigned long relayChangedAt = 0;

int currentScreen = 0; // 0 = Main Diagnostics, 1 = Extended Parameters

unsigned long btnPressStart        = 0;
bool          btnWaitingForRelease = false;

float energykWh     = 0.0f;
float cost          = 0.0f;
float budgetMaxKWh   = 5.0f;
float lastPostedKWh  = 0.0f;

float latestVoltage = 230.0f;
float latestCurrent = 0.0f;
float latestPower   = 0.0f;
float latestFreq    = 50.0f;
float latestPf      = 1.0f;

unsigned long lastBackendPost = 0;
unsigned long lastBudgetFetch = 0;
unsigned long lastStatePoll   = 0;
unsigned long lastNvsSave     = 0;
unsigned long lastDisplayUpdate = 0;

bool  budgetExceededAlarmFired = false;
float lastSavedKWh             = -1.0f;

char incomingPacket[128];
unsigned long lastSubnetScan = 0;

// =============================================================================
// Thread Synchronization Lock Helpers
// =============================================================================

bool takeStateLock(TickType_t waitTicks) {
  if (stateMutex == NULL) return true;
  return (xSemaphoreTake(stateMutex, waitTicks) == pdTRUE);
}

void giveStateLock() {
  if (stateMutex != NULL) {
    xSemaphoreGive(stateMutex);
  }
}

// =============================================================================
// setup() Entrypoint
// =============================================================================

void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  digitalWrite(RELAY_PIN, relayState ? MAINS_ON : MAINS_OFF);
  digitalWrite(BUZZER_PIN, LOW);

  initDisplay();

  // Boot Chime
  triggerShortBeep();
  delay(80);
  triggerShortBeep();

  // Create state mutex for thread synchronization
  stateMutex = xSemaphoreCreateMutex();

  // Load saved backend host from NVS
  prefs.begin("config", false);
  String savedHost = prefs.getString("server_host", "http://10.57.236.171:4000");
  savedHost.toCharArray(SERVER_HOST, 64);
  prefs.end();
  Serial.printf("[Config] Loaded Server Host: %s\n", SERVER_HOST);

  // Boot hold on Button -> factory wipe
  delay(100);
  if (digitalRead(BUTTON_PIN) == LOW) {
    Serial.println("[Config] Button held on boot — clearing settings...");
    tone(BUZZER_PIN, 1000);
    delay(500);
    noTone(BUZZER_PIN);

    WiFiManager wm;
    wm.resetSettings();
    prefs.begin("config", false);
    prefs.remove("server_host");
    prefs.end();
    strcpy(SERVER_HOST, "http://172.20.10.5:4000");
    delay(1000);
    ESP.restart();
  }

  connectWiFi();

  // NTP sync
  if (WiFi.status() == WL_CONNECTED) {
    configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET, NTP_SERVER);
    time_t epoch = 0;
    unsigned long start = millis();
    while (epoch < 1000000000L && millis() - start < 5000) {
      delay(200);
      time(&epoch);
    }
  }

  // mDNS & UDP setup
  if (WiFi.status() == WL_CONNECTED) {
    MDNS.begin("smartenergy");
    udp.begin(localUdpPort);
  }

  seedEnergyFromBackend();
  lastPostedKWh = energykWh;

  // Start background network task on Core 0
  xTaskCreatePinnedToCore(
      networkTask,   // Task function
      "NetworkTask", // Task name
      8192,          // Stack size
      NULL,          // Parameter
      1,             // Priority
      NULL,          // Task handle
      0              // Core 0
  );
}

// =============================================================================
// loop() Main Loop — Core 1 (~50Hz Execution)
// =============================================================================

void loop() {
  // 1. Physical button (Instant 10ms sampling, zero network lag)
  handleButtons();

  // Enforce GPIO output level to physically match relayState at all times
  digitalWrite(RELAY_PIN, relayState ? MAINS_ON : MAINS_OFF);

  // 2. Direct Sensor Reading from PZEM-004T v3
  float rawVoltage = pzem.voltage();
  float rawCurrent = pzem.current();
  float rawPower   = pzem.power();
  float rawFreq    = pzem.frequency();
  float rawPf      = pzem.pf();
  float rawEnergy  = pzem.energy();

  float voltage = (!isnan(rawVoltage) && rawVoltage >= 0.0f) ? rawVoltage : 0.0f;
  float current = (!isnan(rawCurrent) && rawCurrent >= 0.0f) ? rawCurrent : 0.0f;
  float power   = (!isnan(rawPower)   && rawPower   >= 0.0f) ? rawPower   : 0.0f;
  float freq    = (!isnan(rawFreq)    && rawFreq    >= 0.0f) ? rawFreq    : 0.0f;
  float pf      = (!isnan(rawPf)      && rawPf      >= 0.0f) ? rawPf      : 0.0f;

  // HARDWARE CIRCUIT COUPLING:
  // If Relay is OFF, physical AC circuit is OPEN -> zero current & power
  if (!relayState) {
    current = 0.0f;
    power   = 0.0f;
  }

  if (takeStateLock()) {
    if (!isnan(rawEnergy) && rawEnergy >= 0.0f) {
      energykWh = rawEnergy;
    }
    latestVoltage = voltage;
    latestCurrent = current;
    latestPower   = power;
    latestFreq    = freq;
    latestPf      = pf;
    cost          = energykWh * RATE_GHS_PER_KWH;
    giveStateLock();
  }

  // 3. Safety Energy Threshold & Over Budget Check
  bool overBudget = (energykWh >= budgetMaxKWh);
  bool nearBudget = (!overBudget && budgetMaxKWh > 0.0f &&
                     (energykWh / budgetMaxKWh) >= 0.98f);

  if (overBudget) {
    if (!budgetExceededAlarmFired) {
      budgetExceededAlarmFired = true;
      if (takeStateLock()) {
        relayState = false;
        digitalWrite(RELAY_PIN, MAINS_OFF);
        pendingRelayPost = true;
        displayNeedsUpdate = true;
        giveStateLock();
      }
    }
    // Alarm Beeping during trip state
    static unsigned long lastBeepTime = 0;
    if (millis() - lastBeepTime > 500) {
      digitalWrite(BUZZER_PIN, !digitalRead(BUZZER_PIN));
      lastBeepTime = millis();
    }
  } 
  else if (nearBudget) {
    budgetExceededAlarmFired = false;
    unsigned long phase = millis() % 1500UL;
    if (phase < 1000UL) tone(BUZZER_PIN, 1500); else noTone(BUZZER_PIN);
  } 
  else {
    budgetExceededAlarmFired = false;
    digitalWrite(BUZZER_PIN, LOW);
  }

  // 4. OLED Display update (Instant refresh if state/page changed, or every 500ms)
  if (displayNeedsUpdate || millis() - lastDisplayUpdate >= 500) {
    updateDisplay(voltage, current, power, freq, pf);
    displayNeedsUpdate = false;
    lastDisplayUpdate = millis();
  }

  // 5. NVS energy persistence
  maybeSaveEnergyToNVS();

  // Fast 20ms loop delay (50Hz refresh rate)
  delay(20);
}
