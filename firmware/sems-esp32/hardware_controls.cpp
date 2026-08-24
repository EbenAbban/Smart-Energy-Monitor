#include "hardware_controls.h"
#include "wifi_manager_helper.h"
#include "network_task.h"

void triggerShortBeep(uint16_t freq, uint16_t durationMs) {
  tone(BUZZER_PIN, freq, durationMs);
}

void triggerDoubleBeep() {
  tone(BUZZER_PIN, 2000, 60);
  delay(100);
  tone(BUZZER_PIN, 2000, 60);
}

void maybeSaveEnergyToNVS() {
  bool valueMoved   = (energykWh - lastSavedKWh) > 0.001f;
  bool timerExpired = (millis() - lastNvsSave) >= NVS_SAVE_MS;
  if (!valueMoved && !timerExpired) return;

  prefs.begin("energy", false);
  prefs.putFloat("kwh", energykWh);
  prefs.end();
  lastSavedKWh = energykWh;
  lastNvsSave  = millis();
}

void handleButtons() {
  // --- Non-blocking Button Debounce & Timing Logic ---
  bool buttonPressed = (digitalRead(BUTTON_PIN) == LOW); // LOW = pressed

  if (buttonPressed && !btnWaitingForRelease) {
    btnWaitingForRelease = true;
    btnPressStart = millis();
  } 
  else if (!buttonPressed && btnWaitingForRelease) {
    unsigned long pressDuration = millis() - btnPressStart;
    btnWaitingForRelease = false;

    if (pressDuration >= PORTAL_PRESS_MS) { // >= 5 seconds
      // --- VERY LONG PRESS (>= 5s): Launch WiFi Config Portal ---
      Serial.println("[Config] Button held >= 5s — launching WiFi Config Portal...");
      triggerDoubleBeep();

      display.clearBuffer();
      display.setFont(u8g2_font_6x12_tf);
      display.drawStr(0, 15, "WIFI CONFIG PORTAL");
      display.drawStr(0, 32, "AP: Smart-Energy-AP");
      display.drawStr(0, 47, "Pass: 12345678");
      display.drawStr(0, 60, "IP: 192.168.4.1");
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
          if (takeStateLock()) {
            strcpy(SERVER_HOST, custom_server_host.getValue());
            giveStateLock();
          }
          prefs.begin("config", false);
          prefs.putString("server_host", SERVER_HOST);
          prefs.end();
          shouldSaveConfig = false;
        }
      }
      seedEnergyFromBackend();
      fetchBudget();
    } 
    else if (pressDuration >= 2000) { // 2s - 5s Hold
      // --- MEDIUM HOLD (2s - 5s): Cycle OLED Display Pages ---
      currentScreen = (currentScreen + 1) % 2; // Cycles 0 (Main) <-> 1 (Extended)
      triggerShortBeep(2200, 60);
      displayNeedsUpdate = true;
      Serial.printf("[Button] Switched to Display Screen Page: %d\n", currentScreen);
    } 
    else if (pressDuration >= 50) { // 50ms - 2s Short Click
      // --- SHORT CLICK: TOGGLE RELAY IMMEDIATELY (INSTANT PHYSICAL CLICK!) ---
      if (takeStateLock()) {
        relayState = !relayState;
        digitalWrite(RELAY_PIN, relayState ? MAINS_ON : MAINS_OFF); // PHYSICAL RELAY COIL TOGGLE!
        relayChangedAt = millis();
        pendingRelayPost = true;
        displayNeedsUpdate = true;
        giveStateLock();
      }

      // Audio double beep confirmation
      triggerDoubleBeep();
      Serial.printf("[Button] Short Click -> RELAY TOGGLED: %s\n", relayState ? "ON (MAINS_ON)" : "OFF (MAINS_OFF)");
    }
  }
}
