// =============================================================================
// Standalone ESP32 Hardware Relay Test Sketch
// =============================================================================
// Purpose: Test physical Relay (GPIO 19), Buzzer (GPIO 18), and Button (GPIO 17).
//
// What to expect:
//   1. Every 3 seconds, the sketch automatically toggles GPIO 19 between LOW and HIGH.
//   2. An Active-LOW relay module will CLICK and turn ON when GPIO 19 is LOW (0V).
//   3. An Active-HIGH relay module will CLICK and turn ON when GPIO 19 is HIGH (3.3V).
//   4. Pressing the physical button (GPIO 17) manually toggles the relay immediately.
// =============================================================================

#include <Arduino.h>

#define RELAY_PIN  19
#define BUZZER_PIN 18
#define BUTTON_PIN 17

bool currentPinState = HIGH; // Start HIGH (OFF for active-LOW)
unsigned long lastAutoToggle = 0;
const unsigned long TOGGLE_INTERVAL_MS = 3000; // Auto-toggle every 3 seconds

bool lastBtnState = HIGH;

void beep(uint16_t freq = 2000, uint16_t durationMs = 80) {
  tone(BUZZER_PIN, freq, durationMs);
}

void setRelayState(bool pinLevel, const char *triggerSource) {
  currentPinState = pinLevel;
  digitalWrite(RELAY_PIN, currentPinState);
  beep(currentPinState == LOW ? 2400 : 1200, 60);

  Serial.println("--------------------------------------------------");
  Serial.printf("[%s] GPIO 19 set to: %s (%s)\n", 
                triggerSource, 
                currentPinState == LOW ? "LOW (0V)" : "HIGH (3.3V)",
                currentPinState == LOW ? "Active-LOW = ON / Active-HIGH = OFF" : "Active-LOW = OFF / Active-HIGH = ON");
  Serial.printf("Relay Status Indicator: %s\n", currentPinState == LOW ? "[RELAY ACTIVE / LOW]" : "[RELAY INACTIVE / HIGH]");
}

void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("      ESP32 STANDALONE RELAY TEST SKETCH         ");
  Serial.println("==================================================");
  Serial.printf(" Relay Pin  : GPIO %d\n", RELAY_PIN);
  Serial.printf(" Buzzer Pin : GPIO %d\n", BUZZER_PIN);
  Serial.printf(" Button Pin : GPIO %d (INPUT_PULLUP)\n", BUTTON_PIN);
  Serial.println("==================================================\n");

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // Initial state: Set relay pin HIGH
  setRelayState(HIGH, "SETUP");

  // Startup chime
  beep(1500, 100);
  delay(120);
  beep(2000, 100);
}

void loop() {
  // 1. Manual Button Control Test (GPIO 17)
  bool btnState = digitalRead(BUTTON_PIN);
  if (lastBtnState == HIGH && btnState == LOW) { // Button Pressed (Falling edge)
    delay(50); // Debounce
    bool newPinState = !currentPinState;
    setRelayState(newPinState, "MANUAL BUTTON PRESS");
    lastAutoToggle = millis(); // Reset auto timer
  }
  lastBtnState = btnState;

  // 2. Automatic Relay Toggle Test (Every 3 seconds)
  if (millis() - lastAutoToggle >= TOGGLE_INTERVAL_MS) {
    lastAutoToggle = millis();
    bool newPinState = !currentPinState;
    setRelayState(newPinState, "AUTO TIMER TOGGLE");
  }

  delay(10);
}
