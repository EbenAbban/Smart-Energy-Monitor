# 🔌 ESP32 Smart Energy Monitor — Complete Wiring & Schematic Guide

This document lists the hardware pin assignments, wiring rules, and electrical connections for the Smart Energy Monitor (SEM) based on the production firmware ([`main.ino`](file:///c:/Users/HP/Desktop/Mini%20Project/SmartEnergy2.0/Smart-Energy-Monitor/firmware/sems-esp32/main.ino)).

---

## 📌 Master Pin Connection Table

| ESP32 Pin | Component / Module | Signal / Connection Type | Description |
| :--- | :--- | :--- | :--- |
| **GND** | All Components | Common Ground | Central ground bus link |
| **5V / VIN** | Relays, ACS712, Buzzer, Display | Power Bus (+5V) | VCC power line for 5V peripherals |
| **3V3** | Display (Optional) | Power Bus (+3.3V) | Can power SH1106 display if 3.3V version |
| **GPIO 34** | ACS712 Current Sensor | Analog Input (ADC1_CH6) | Current sensor OUT (0V to 3.3V range) |
| **GPIO 13** | Active Buzzer | Digital Output (PWM) | Piezo alarm signal control line |
| **GPIO 21** | SH1106 OLED Display | I2C Data line (SDA) | Serial Data connection |
| **GPIO 22** | SH1106 OLED Display | I2C Clock line (SCL) | Serial Clock connection |
| **GPIO 32** | Push Button 1 | Digital Input (Internal Pullup) | Controls Relay 1 / Holds to reset config |
| **GPIO 33** | Push Button 2 | Digital Input (Internal Pullup) | Controls Relay 2 |
| **GPIO 18** | Push Button 3 | Digital Input (Internal Pullup) | Controls Relay 3 |
| **GPIO 19** | Push Button 4 | Digital Input (Internal Pullup) | Controls Relay 4 |
| **GPIO 25** | Relay Module 1 | Digital Output (Active-Low) | Controls power line for Appliance 1 |
| **GPIO 26** | Relay Module 2 | Digital Output (Active-Low) | Controls power line for Appliance 2 |
| **GPIO 27** | Relay Module 3 | Digital Output (Active-Low) | Controls power line for Appliance 3 |
| **GPIO 14** | Relay Module 4 | Digital Output (Active-Low) | Controls power line for Appliance 4 |

---

## ⚡ Subsystem Schematics & Wiring Logic

### 1. Power Supply Distribution
* **Input Power**: Supply **5V DC** to the ESP32 `VIN` / `5V` pin (usually from a 5V/2A mains USB adapter or step-down module).
* **Grounding**: Ensure a single common Ground (`GND`) bus is shared between the ESP32, relay module, display, sensor, and buzzer to prevent noise issues.

### 2. ACS712 Current Sensor Connection
* **VCC**: Connect to ESP32 **5V / VIN** pin.
* **GND**: Connect to common **GND**.
* **OUT**: Connect to **GPIO 34**.
  > [!IMPORTANT]
  > Since the ESP32 ADC reads up to **3.3V** and the ACS712 outputs up to **5.0V**, use a simple resistive voltage divider on the OUT line if you are measuring currents near the maximum rating of your sensor to protect the ESP32 pin (e.g., a 10kΩ and 18kΩ resistor pair).

### 3. Push Buttons (Physical Toggles)
* Connect one side of each button switch to the respective ESP32 pin (**GPIO 32, 33, 18, 19**).
* Connect the other side of all switches to common **GND**.
  > [!NOTE]
  > The firmware configures these pins with internal pull-up resistors (`INPUT_PULLUP`). The input reads `HIGH` by default and falls to `LOW` when pressed.

### 4. Active-Low 4-Channel Relay Board
* **VCC / JD-VCC**: Connect VCC to **5V**. (If using optical isolation, remove the jumper and supply JD-VCC from external 5V to separate relay coil noise from ESP32).
* **GND**: Connect to common **GND**.
* **IN1 to IN4**: Connect to **GPIO 25, 26, 27, 14** respectively.
  > [!NOTE]
  > These relays are **active-low**: setting the pin to `LOW` closes the relay contact (turns Appliance ON); setting it to `HIGH` opens the contact (turns Appliance OFF).

### 5. SH1106 I2C OLED Display (128x64)
* **VCC**: Connect to **3.3V** or **5V** (verify display board rating).
* **GND**: Connect to common **GND**.
* **SDA**: Connect to **GPIO 21**.
* **SCL**: Connect to **GPIO 22**.

### 6. Piezo Buzzer
* **Positive (+)**: Connect to **GPIO 13**.
* **Negative (-)**: Connect to common **GND**.
