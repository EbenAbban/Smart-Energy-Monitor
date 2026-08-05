# ⚡ Smart Energy Monitor — Project Presentation Outline

Use this outline to present your project to your friends, peers, or evaluators. It is structured to take your audience on a journey from **the real-world problem** to your **hardware engineering**, **backend architecture**, **modern frontend web app**, and a **live demo**.

---

## 🎯 Slide 1: Title & Hook
- **Title**: Smart Energy Monitor (SEM) 2.0
- **Subtitle**: Real-Time IoT Energy Tracking, Budget Automation, and Remote Appliance Control
- **Presenter**: Sylvester Amoah
- **The Hook Question**: *"Have you ever opened your monthly electricity bill and wondered which exact appliance drained your money? What if your home could automatically cut off high-load appliances before you exceed your electricity budget?"*

---

## 🚨 Slide 2: The Problem Statement
- **Invisible Consumption**: Traditional energy meters only show a single cumulative number at the end of the month.
- **No Appliance-Level Control**: You cannot see how much power your fridge, AC, or TV uses in real time.
- **Accidental Budget Overshoots**: By the time you notice high usage, the money is already spent.
- **Manual Overhead**: No remote switch control when you leave appliances on by mistake.

---

## 💡 Slide 3: The Solution Overview (System Architecture)
Explain the 3 core layers working seamlessly together:
1. **IoT Hardware Layer (ESP32 System)**: Measures voltage and current, drives the OLED display, triggers buzzer alarms, and controls physical relays.
2. **Backend & Real-Time Server Layer (Node.js + Express + Socket.IO + Neon Postgres)**: Processes energy deltas, tracks budgets, stores history, and broadcasts real-time events.
3. **Web Monitoring Interface (Next.js 16 + Tailwind CSS + Framer Motion)**: Interactive dashboard for live monitoring, remote relay control, analytics, and budget configuration.

---

## 🔌 Slide 4: Hardware Engineering & Circuit Design
Highlight the hardware components and smart firmware features:
- **ESP32 Microcontroller**: Dual-core processor handling Wi-Fi networking and sensor reading.
- **ACS712 Current Sensor**: Measures instant current (Amperes) across active loads.
- **4-Channel Relay Module**: Active-Low relay switches controlling power to individual appliances.
- **SH1106 OLED Display**: Provides real-time hardware status (Current, Power, Energy kWh, and Cost in GHS/USD).
- **Active Buzzer & Safety Guard**: Sounds a 5-second continuous alarm and automatically cuts off all relays when the monthly budget limit is reached.
- **Smart Connectivity Engineering**:
  - **LAN Subnet Auto-Scanner (`discoverBackendIP`)**: Probes the network on boot to automatically find your laptop's IP address—zero manual configuration needed!
  - **mDNS Support**: Resolves hostnames dynamically.
  - **On-Demand Portal**: Hold Button 1 for 3 seconds to update Wi-Fi without wiping credentials.
  - **NVS Non-Volatile Storage**: Saves energy totals to flash memory so data is never lost during power outages.

---

## ⚙️ Slide 5: Backend Architecture & Database Optimization
- **Node.js & Express REST API**: Efficient endpoint design for posting readings (`/api/readings`) and controlling relays (`/api/appliances`).
- **Socket.IO WebSockets**: Instant two-way communication between the ESP32 hardware and web browser with sub-second latency.
- **Prisma ORM & Neon Serverless Postgres**: PostgreSQL database hosted in the cloud.
- **Connection Pool Tuning**: Configured connection pooling and cold-start retries to prevent database timeouts during high-frequency posting.
- **Cumulative Energy Delta Algorithm**: Calculates incremental energy usage (`energyUsed`) per reading instead of raw totals, keeping budget calculations 100% accurate.

---

## 🖥️ Slide 6: Modern Web Dashboard Experience
Walk them through the user interface features:
- **Live Overview Dashboard**: Interactive gauge displaying monthly budget usage percentage, real-time power (Watts), total kWh used, and active alerts.
- **Remote Appliance Management**: Turn appliances ON/OFF from your phone or browser with live relay status indicators.
- **Multi-Currency Pricing System**: Supports custom electricity rates for GHS (Ghana Cedi), USD, EUR, GBP, NGN, ZAR, and more, complete with Peak vs. Off-Peak tariffs.
- **Interactive Analytics & Reports**: Visual breakdown of hourly energy consumption and top energy-consuming appliances.
- **Notification Control**: Customizable push, budget, and appliance status alert toggles saved locally.

---

## 🎬 Slide 7: Live Demonstration Script
Show your friends the system in action:
1. **Show the ESP32 OLED**: Point out live Amps (`I`), Watts (`P`), kWh (`E`), and Cost (`C`).
2. **Demonstrate Web Sync**: Toggle Relay 1 on the Web App and show Relay 1 turning ON instantly on the physical ESP32 board!
3. **Demonstrate Physical Button Sync**: Press physical Button 1 on the hardware and show the web dashboard toggle switch update immediately in real time via Socket.IO.
4. **Demonstrate Budget Threshold Alert**: Set a low budget limit on the app. Show how the buzzer sounds an alarm and automatically cuts all physical relays to protect the user's budget!

---

## 🚀 Slide 8: Production Deployment & Future Roadmap
- **24/7 Cloud Deployment**: Deploying the backend to Railway/Render and frontend to Vercel so the ESP32 streams data 24/7 without needing a laptop.
- **Machine Learning Integration**: AI load disaggregation to detect appliance health and predict power spikes before failure.
- **Solar Integration**: Auto-switching relays between grid power and solar battery backup based on available battery percentage.

---

## ❓ Slide 9: Q&A & Conclusion
- Open the floor for questions.
- **Key Takeaway**: Smart Energy Monitor transforms passive electricity consumers into active, cost-saving managers of their smart homes.
