#include "display_manager.h"

void initDisplay() {
  display.begin();
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf); 
  display.drawStr(0, 20, "System Loading...");
  display.drawStr(0, 40, "Single-Channel Mode");
  display.sendBuffer();
}

void updateDisplay(float voltage, float current, float power, float freq, float pf) {
  display.clearBuffer();

  bool isPzemErr = isnan(voltage) || isnan(current);
  bool isOverBudget = (energykWh >= budgetMaxKWh);

  if (isPzemErr) {
    display.setFont(u8g2_font_6x12_tf);
    display.drawStr(0, 25, "PZEM ERROR!");
    display.drawStr(0, 45, "Check AC Supply");
  } 
  else if (isOverBudget && !relayState) {
    // Safety Priority Screen
    display.setFont(u8g2_font_7x14_tf);
    display.drawStr(10, 20, "!! OVER LIMIT !!");
    display.setFont(u8g2_font_6x12_tf);
    char limitMsg[32];
    snprintf(limitMsg, sizeof(limitMsg), "Used: %.2f / %.1f kWh", energykWh, budgetMaxKWh);
    display.drawStr(0, 42, limitMsg);
    display.drawStr(5, 60, "POWER DISCONNECTED");
  } 
  else {
    // Status Dot Indicator in top-right corner when relay is active
    if (relayState) {
      display.drawDisc(122, 5, 3);
    }

    display.setFont(u8g2_font_6x12_tf);
    char buffer[32];

    if (currentScreen == 0) {
      // SCREEN 0: Main Power Diagnostics
      snprintf(buffer, sizeof(buffer), "Voltage: %.1f V", voltage);
      display.drawStr(0, 12, buffer);

      snprintf(buffer, sizeof(buffer), "Current: %.3f A", current);
      display.drawStr(0, 28, buffer);

      snprintf(buffer, sizeof(buffer), "Power:   %.1f W", power);
      display.drawStr(0, 44, buffer);

      snprintf(buffer, sizeof(buffer), "E: %.2f / %.1f kWh", energykWh, budgetMaxKWh);
      display.drawStr(0, 60, buffer);
    } 
    else {
      // SCREEN 1: Extended Phase Parameters
      display.drawStr(0, 12, "-- Extended Data --");

      snprintf(buffer, sizeof(buffer), "Frequency: %.1f Hz", freq);
      display.drawStr(0, 28, buffer);

      snprintf(buffer, sizeof(buffer), "Power Factor: %.2f", pf);
      display.drawStr(0, 44, buffer);

      snprintf(buffer, sizeof(buffer), "Relay: %s", relayState ? "ON (MAINS)" : "OFF (MANUAL)");
      display.drawStr(0, 60, buffer);
    }
  }

  display.sendBuffer();
}
