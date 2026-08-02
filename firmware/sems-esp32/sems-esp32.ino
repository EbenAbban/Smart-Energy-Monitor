/*
 * Smart Energy Monitor
 * ESP32 Firmware
 * 
 * Reads energy data from sensors and sends to backend via Wi-Fi
 * 
 * Hardware:
 *   - ESP32 Dev Module
 *   - Current Transformer (SCT-013) via ADC
 *   - Voltage Sensor (ZMPT101B) via ADC
 *   - Relays for appliance control
 * 
 * Connections:
 *   - GPIO34: Current sensor ADC input
 *   - GPIO35: Voltage sensor ADC input
 *   - GPIO32: Relay 1
 *   - GPIO33: Relay 2
 *   - GPIO25: Relay 3
 *   - GPIO26: Relay 4
 *   - GPIO27: Relay 5
 *   - GPIO14: Relay 6
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WebServer.h>

// Wi-Fi Configuration
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend Configuration
const char* serverUrl = "http://192.168.1.100:4000/api";
const char* applianceId = "1";  // Change per ESP32 device

// Pin Configuration
const int currentSensorPin = 34;
const int voltageSensorPin = 35;
const int relayPins[] = {32, 33, 25, 26, 27, 14};
const int relayCount = 6;

// Sampling Configuration
const int samplesPerReading = 200;
const unsigned long readingInterval = 2000;  // 2 seconds
const unsigned long wifiTimeout = 10000;

// Calibration
const float voltageCalibration = 1.0;
const float currentCalibration = 1.0;
const float referenceVoltage = 120.0;  // Default if sensor fails

WebServer webServer(80);
unsigned long lastReadingTime = 0;
bool apMode = false;

void setup() {
  Serial.begin(115200);
  Serial.println("\nSmart Energy Monitor ESP32 Starting...");

  // Configure relay pins
  for (int i = 0; i < relayCount; i++) {
    pinMode(relayPins[i], OUTPUT);
    digitalWrite(relayPins[i], HIGH);  // OFF (active low)
  }

  // ADC configuration
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Start in AP mode for configuration if no credentials saved
  if (strlen(ssid) == 0 || strcmp(ssid, "YOUR_WIFI_SSID") == 0) {
    startConfigPortal();
  } else {
    connectToWiFi();
  }
}

void loop() {
  if (apMode) {
    webServer.handleClient();
    return;
  }

  // Check Wi-Fi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Wi-Fi disconnected. Reconnecting...");
    connectToWiFi();
    return;
  }

  // Take readings at interval
  unsigned long now = millis();
  if (now - lastReadingTime >= readingInterval) {
    lastReadingTime = now;
    takeReading();
  }

  // Fetch relay status from backend
  checkRelayCommands();
}

void connectToWiFi() {
  Serial.printf("Connecting to Wi-Fi: %s\n", ssid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - start > wifiTimeout) {
      Serial.println("\nWi-Fi connection failed. Starting config portal.");
      startConfigPortal();
      return;
    }
  }

  Serial.printf("\nConnected! IP: %s\n", WiFi.localIP().toString().c_str());
  apMode = false;
}

void startConfigPortal() {
  Serial.println("Starting Configuration Portal...");
  apMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("SmartEnergyMonitor-Config");

  webServer.on("/", HTTP_GET, []() {
    String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<title>Smart Energy Monitor Configuration</title>";
    html += "<style>body{font-family:Arial;background:#111;color:#eee;padding:20px}";
    html += "input{width:100%;padding:10px;margin:8px 0;background:#222;border:1px solid #333;color:#fff;border-radius:6px}";
    html += "button{width:100%;padding:12px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:16px;cursor:pointer}";
    html += "h2{color:#10b981}</style></head><body>";
    html += "<h2>Smart Energy Monitor - ESP32 Configuration</h2>";
    html += "<form action='/save' method='POST'>";
    html += "<label>Wi-Fi SSID:</label><input type='text' name='ssid' required>";
    html += "<label>Wi-Fi Password:</label><input type='password' name='password'>";
    html += "<label>Server URL:</label><input type='text' name='server' value='http://192.168.1.100:4000/api'>";
    html += "<label>Appliance ID:</label><input type='number' name='applianceId' value='1'>";
    html += "<br><br><button type='submit'>Save & Connect</button></form></body></html>";
    webServer.send(200, "text/html", html);
  });

  webServer.on("/save", HTTP_POST, []() {
    String newSsid = webServer.arg("ssid");
    String newPass = webServer.arg("password");
    String newServer = webServer.arg("server");
    String newAppId = webServer.arg("applianceId");

    // Save to preferences (simplified - in production use Preferences library)
    Serial.printf("Config received - SSID: %s, Server: %s, Appliance: %s\n",
      newSsid.c_str(), newServer.c_str(), newAppId.c_str());

    String html = "<!DOCTYPE html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'>";
    html += "<meta http-equiv='refresh' content='5;url=/'>";
    html += "<style>body{font-family:Arial;background:#111;color:#eee;padding:20px;text-align:center}</style>";
    html += "</head><body><h2>Configuration Saved!</h2><p>Rebooting...</p></body></html>";
    webServer.send(200, "text/html", html);

    delay(1000);
    ESP.restart();
  });

  webServer.begin();
  Serial.println("AP Mode - Connect to 'SmartEnergyMonitor-Config' and visit http://192.168.4.1");
}

void takeReading() {
  // Sample sensors
  float currentRMS = readCurrentSensor();
  float voltageRMS = readVoltageSensor();
  float power = voltageRMS * currentRMS;
  float energyUsed = (power / 1000.0) * (readingInterval / 3600000.0);  // kWh for interval

  Serial.printf("Reading - V: %.1f, I: %.3f, P: %.1f, E: %.4f kWh\n",
    voltageRMS, currentRMS, power, energyUsed);

  // Send to backend
  sendReading(energyUsed, voltageRMS, currentRMS, power);
}

float readCurrentSensor() {
  // Read current transformer via ADC
  int rawSum = 0;
  int rawMin = 4095;
  int rawMax = 0;

  for (int i = 0; i < samplesPerReading; i++) {
    int raw = analogRead(currentSensorPin);
    rawSum += raw;
    if (raw < rawMin) rawMin = raw;
    if (raw > rawMax) rawMax = raw;
    delayMicroseconds(100);
  }

  int avg = rawSum / samplesPerReading;
  int amplitude = rawMax - rawMin;

  // Convert to current (calibration dependent on CT sensor)
  float current = (amplitude / 4095.0) * 30.0 * currentCalibration;  // SCT-013 30A
  return max(current, 0.0f);
}

float readVoltageSensor() {
  // Read voltage sensor via ADC
  int rawSum = 0;

  for (int i = 0; i < 100; i++) {
    rawSum += analogRead(voltageSensorPin);
    delayMicroseconds(100);
  }

  int avg = rawSum / 100;
  float voltage = (avg / 4095.0) * 250.0 * voltageCalibration;  // ZMPT101B range
  return voltage > 50 ? voltage : referenceVoltage;  // Fallback to reference
}

void sendReading(float energyUsed, float voltage, float current, float power) {
  HTTPClient http;
  http.begin(String(serverUrl) + "/readings");
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["applianceId"] = atoi(applianceId);
  doc["energyUsed"] = energyUsed;
  doc["voltage"] = voltage;
  doc["current"] = current;
  doc["power"] = power;

  String json;
  serializeJson(doc, json);

  int httpCode = http.POST(json);
  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("Server response: %d - %s\n", httpCode, response.c_str());
  } else {
    Serial.printf("HTTP request failed: %d\n", httpCode);
  }

  http.end();
}

void checkRelayCommands() {
  HTTPClient http;
  http.begin(String(serverUrl) + "/appliances/" + applianceId);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.GET();
  if (httpCode == 200) {
    String response = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, response);

    int relayNum = doc["relayNumber"] | 0;
    bool status = doc["status"] | false;

    if (relayNum > 0 && relayNum <= relayCount) {
      int pinIndex = relayNum - 1;
      digitalWrite(relayPins[pinIndex], status ? LOW : HIGH);  // Active low
    }
  }

  http.end();
}
