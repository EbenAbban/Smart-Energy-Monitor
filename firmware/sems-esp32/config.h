#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESPmDNS.h>
#include <PZEM004Tv30.h>
#include <HTTPClient.h>
#include <Preferences.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <time.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/semphr.h>

// =============================================================================
// Peripheral Pin Allocations
// =============================================================================

#define BUTTON_PIN 17
#define BUZZER_PIN 18
#define RELAY_PIN  19

#define PZEM_RX_PIN 32
#define PZEM_TX_PIN 33
#define PZEM_SERIAL Serial2

// =============================================================================
// Relay Trigger Configuration
// =============================================================================
// Set to 1 for Low-Level Trigger Relay (LOW = ON, HIGH = OFF)
// Set to 0 for High-Level Trigger Relay (HIGH = ON, LOW = OFF)
#define RELAY_ACTIVE_LOW 1

#if RELAY_ACTIVE_LOW
  #define MAINS_ON  LOW  
  #define MAINS_OFF HIGH 
#else
  #define MAINS_ON  HIGH 
  #define MAINS_OFF LOW  
#endif

// =============================================================================
// API & Timing Constants
// =============================================================================

extern const char *READINGS_POST_PATH;
extern const char *READINGS_GET_PATH;
extern const char *BUDGET_PATH;
extern const char *STATE_PATH;

extern const char *NTP_SERVER;
extern const long  GMT_OFFSET_SEC;
extern const int   DAYLIGHT_OFFSET;

extern const float RATE_GHS_PER_KWH;

extern const unsigned long BACKEND_POST_MS;
extern const unsigned long BUDGET_FETCH_MS;
extern const unsigned long STATE_POLL_MS;
extern const unsigned long NVS_SAVE_MS;

extern const unsigned long LONG_PRESS_MS;
extern const unsigned long PORTAL_PRESS_MS;

extern const unsigned int localUdpPort;

// =============================================================================
// Hardware Instances (Declared Extern)
// =============================================================================

extern PZEM004Tv30 pzem;
extern U8G2_SH1106_128X64_NONAME_F_HW_I2C display;
extern Preferences prefs;
extern WiFiUDP udp;

// =============================================================================
// Global State Variables (Declared Extern)
// =============================================================================

extern SemaphoreHandle_t stateMutex;

extern char SERVER_HOST[64];
extern bool shouldSaveConfig;
extern volatile bool serverHealthy;
extern volatile bool displayNeedsUpdate;

extern bool relayState;
extern bool pendingRelayPost;
extern unsigned long relayChangedAt;

extern int currentScreen;

extern unsigned long btnPressStart;
extern bool btnWaitingForRelease;

extern float energykWh;
extern float cost;
extern float budgetMaxKWh;
extern float lastPostedKWh;

extern float latestVoltage;
extern float latestCurrent;
extern float latestPower;
extern float latestFreq;
extern float latestPf;

extern unsigned long lastBackendPost;
extern unsigned long lastBudgetFetch;
extern unsigned long lastStatePoll;
extern unsigned long lastNvsSave;
extern unsigned long lastDisplayUpdate;

extern bool budgetExceededAlarmFired;
extern float lastSavedKWh;

extern char incomingPacket[128];
extern unsigned long lastSubnetScan;

// =============================================================================
// Thread Synchronization Lock Helpers
// =============================================================================

bool takeStateLock(TickType_t waitTicks = pdMS_TO_TICKS(50));
void giveStateLock();

#endif // CONFIG_H
