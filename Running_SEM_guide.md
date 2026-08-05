1. Steps to Get Everything Running & Synced Anytime You Boot
To run your Smart Energy Monitor setup anytime:

Turn on Mobile Hotspot on your phone (so your laptop and ESP32 share the same Wi-Fi network).
Start the Web Application on your laptop:
Backend: Open terminal in backend/ and run npm run dev.
Frontend: Open http://localhost:3000 in your web browser.
Power On the ESP32:
Plug in or power on the ESP32 controller.
The ESP32 automatically connects to your phone's hotspot, finds the backend server, and begins streaming live voltage, current, power, and relay status directly to your web dashboard!
2. What Happens When You Reset the ESP32?
Depending on how you trigger a reset, here is what happens:

A. Normal Reset / Powering Off & On (Pressing EN / RST button or cycling power)
Settings Preserved: All Wi-Fi credentials, saved cumulative energy (kWh), and backend server IP settings remain safely stored in the ESP32's flash memory (NVS).
Behavior: The ESP32 reboots, reconnects to Wi-Fi, restores its cumulative energy count, and resumes sending live readings to the web app immediately without needing any re-configuration.
B. Full Configuration Reset (Holding Button 1 (GPIO 32) on Power-Up)
Trigger: Hold down physical Button 1 while plugging in or powering on the ESP32.
Behavior: The buzzer sounds a 0.5s tone, clears all saved Wi-Fi networks and backend server settings from flash memory, and restarts in Access Point Mode (Smart-Energy-AP).
Use Case: Use this only if you move the device to a completely new Wi-Fi network with a different password.
C. Quick Config Update (Holding Button 1 for 3 seconds while running)
Behavior: Opens the Smart-Energy-AP configuration portal on-demand without wiping your Wi-Fi password, so you can tweak backend settings on the fly if needed.
Everything is fully configured, synced, and ready to monitor your energy usage!