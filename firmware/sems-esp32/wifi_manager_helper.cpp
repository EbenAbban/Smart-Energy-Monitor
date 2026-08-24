#include "wifi_manager_helper.h"

void saveConfigCallback() {
  Serial.println("[WiFiManager] Config needs saving");
  shouldSaveConfig = true;
}

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);

  WiFiManager wm;
  wm.setSaveConfigCallback(saveConfigCallback);

  WiFiManagerParameter custom_server_host(
      "server", "Backend Host URL (e.g. http://192.168.100.5:4000)",
      SERVER_HOST, 64);
  wm.addParameter(&custom_server_host);
  wm.setConfigPortalTimeout(180);
  wm.setConnectTimeout(10);

  Serial.println("[WiFiManager] Starting connection attempt...");
  if (!wm.autoConnect("Smart-Energy-AP", "12345678")) {
    Serial.println("[WiFiManager] Connection timeout. Proceeding in offline mode...");
    return;
  }

  Serial.println("[WiFiManager] Connected successfully!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());

  if (shouldSaveConfig) {
    strcpy(SERVER_HOST, custom_server_host.getValue());
    Serial.printf("[Config] Saved Server Host: %s\n", SERVER_HOST);
    prefs.begin("config", false);
    prefs.putString("server_host", SERVER_HOST);
    prefs.end();
    shouldSaveConfig = false;
  }
}

void ensureWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  static unsigned long lastReconnectAttempt = 0;
  if (millis() - lastReconnectAttempt < 10000) return; // Non-blocking: retry every 10s
  lastReconnectAttempt = millis();

  Serial.println("[WiFi] Connection lost. Background non-blocking reconnect...");
  WiFi.disconnect();
  WiFi.begin();
}
