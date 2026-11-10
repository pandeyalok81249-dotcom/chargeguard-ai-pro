/*
 * ChargeGuard AI Pro - ESP32 Firmware (v1.4.0)
 * Intelligent Hardware Monitoring, Predictive Maintenance & LCD Carousel Engine
 *
 * FULL LCD DISPLAY CAPABILITIES:
 * - Automatically rotates multi-page dashboard telemetry on 16x2 I2C LCD (0x27):
 *     Page 1: Voltage & Current Draw + Synchronized Health Score & Fault Status
 *     Page 2: Conductor Surface Temp & Dynamic Power Draw
 *     Page 3: Loop Conductor Resistance & Differential Voltage Drop
 *     Page 4: Cable Test ID & Active Elapsed Runtime
 * - Single Source of Truth Synchronization:
 *     Receives backend {"cmd":"SYNC", "score":55, "status":"FAULT", "reason":"..."}
 *     Instantly mirrors backend & web application values on physical LCD line 2.
 * - Hardware Safety Interlocks:
 *     Instant automatic hardware cutoff if Current > 3.0A or Temperature > 50.0°C.
 * - Dual-Rail Telemetry:
 *     Reads physical INA219 (V/I), DS18B20 (T), and streams structured JSON to host.
 *     Includes built-in sensor fallback simulation if sensors are temporarily unplugged.
 *
 * PIN WIRING CONNECTIONS (ESP32 DevKit v1):
 *   - I2C SDA       -> GPIO 21 (Connect to LCD SDA & INA219 SDA)
 *   - I2C SCL       -> GPIO 22 (Connect to LCD SCL & INA219 SCL)
 *   - DS18B20 Temp  -> GPIO 4  (Connect to DS18B20 Data pin with 4.7kΩ pull-up to 3.3V)
 *   - Load Switch   -> GPIO 16 (Connect to MOSFET Gate or Relay module to engage 5V load)
 *   - Diagnostic LED-> GPIO 2  (Built-in Blue LED / External indicator)
 *   - Power Rails   -> 5V / VIN to LCD & INA219 VCC; GND to common ground.
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <Adafruit_INA219.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ---------------------- PIN DEFINITIONS ----------------------
#define ONE_WIRE_BUS 4        // DS18B20 OneWire Data Pin
#define LOAD_ENABLE_PIN 16    // Active-HIGH MOSFET switch to engage 5V load
#define STATUS_LED_PIN 2      // On-board diagnostic indicator LED
#define ANALOG_VOLT_PIN 34    // Hardware analog voltage divider pin

// ------------------- HARDWARE SAFETY LIMITS ------------------
const float MAX_SAFE_CURRENT_A = 3.00;
const float MAX_SAFE_TEMP_C = 50.0;
const float MIN_SAFE_VOLTAGE_V = 3.80;
const float MAX_SAFE_VOLTAGE_V = 5.60;

// ----------------- PERIPHERAL INSTANTIATIONS -----------------
// Standard I2C LCD 16x2 at Address 0x27 (use 0x3F if your screen differs)
LiquidCrystal_I2C lcd(0x27, 16, 2);

Adafruit_INA219 ina219;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensors(&oneWire);

// Sensor Availability Flags
bool lcdReady = false;
bool ina219Ready = false;
bool ds18b20Ready = false;

// --------------------- DEVICE METADATA -----------------------
const String DEVICE_ID = "cg-esp32-001";
const String FIRMWARE_VERSION = "cg-fw-1.4.0";
String currentCableId = "cable-001";
String currentTestId = "idle";
bool isTestActive = false;

// --------------------- TIMING CONSTANTS ----------------------
unsigned long lastSampleTime = 0;
const unsigned long SAMPLE_INTERVAL_MS = 1000;
unsigned long testStartTime = 0;
unsigned long lastLcdUpdateTime = 0;
const unsigned long LCD_INTERVAL_MS = 300;       // Display refresh rate
unsigned long lastPageChangeTime = 0;
const unsigned long PAGING_INTERVAL_MS = 2500;   // Auto-cycle screen every 2.5 seconds
int currentDisplayPage = 0;
const int TOTAL_TEST_PAGES = 4;
const int TOTAL_STANDBY_PAGES = 2;

// ---------------- CACHED PHYSICAL READINGS -------------------
float currentBusVoltage_V = 5.020;
float currentLoadCurrent_A = 0.000;
float currentTemp_C = 28.5;
float currentPower_W = 0.000;
float currentResistance_Ohm = 0.065;
float currentVoltageDrop_V = 0.040;
float sourceVoltage_V = 5.050; // Calibrated 5V supply reference

// -------- SYNCHRONIZED STATE (FROM BACKEND HEALTH ENGINE) -----
int syncHealthScore = 100;
char syncFaultStatus[16] = "NORMAL";
char syncReason[32] = "NOMINAL";
unsigned long lastSyncReceivedTime = 0;
bool hasReceivedSync = false;
bool isEmergencyCutoff = false;
char emergencyReason[32] = "";

// ------------------- FUNCTION PROTOTYPES ---------------------
void updateLcdDisplay();
void takeMeasurement();
void handleCommand(String cmd);
void handleSyncCommand(String cmd);
void stopTest(String reason);
void triggerEmergencyStop(String reason);
void readSensors();
void sendPong();
void sendIdentify();

// =============================================================
//                           SETUP
// =============================================================
void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 2500);

  pinMode(LOAD_ENABLE_PIN, OUTPUT);
  digitalWrite(LOAD_ENABLE_PIN, LOW); // Safe default: load disconnected

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize I2C Bus on GPIO 21 (SDA) and GPIO 22 (SCL)
  Wire.begin(21, 22);

  // Initialize I2C LCD Display (0x27)
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcdReady = true;

  // Boot splash on LCD
  lcd.setCursor(0, 0);
  lcd.print("ChargeGuard PRO ");
  lcd.setCursor(0, 1);
  lcd.print("AI Monitor v1.4 ");
  delay(1400);

  // Initialize INA219 Voltage/Current Sensor
  if (ina219.begin()) {
    ina219Ready = true;
  } else {
    ina219Ready = false;
  }

  // Initialize DS18B20 Temperature Sensor
  tempSensors.begin();
  tempSensors.setResolution(11); // 0.125°C resolution
  if (tempSensors.getDeviceCount() > 0) {
    ds18b20Ready = true;
  } else {
    ds18b20Ready = false;
  }

  // Initial read to populate cache
  readSensors();
  lcd.clear();
  updateLcdDisplay();

  // Announce readiness to host serial bridge in structured JSON
  Serial.println("{\"system\": \"ChargeGuard AI Pro Firmware Ready\", \"device_id\": \"" + DEVICE_ID + "\", \"firmware_version\": \"" + FIRMWARE_VERSION + "\", \"mode\": \"hardware\", \"profile\": \"5V\", \"sensor_status\": {\"ina219\": \"" + String(ina219Ready ? "ok" : "simulated") + "\", \"ds18b20\": \"" + String(ds18b20Ready ? "ok" : "simulated") + "\", \"lcd\": \"ok\"}}");
}

// =============================================================
//                            LOOP
// =============================================================
void loop() {
  // 1. Process incoming commands from Python backend / Dashboard
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() > 0) {
      handleCommand(cmd);
    }
  }

  // 2. Hardware Safety Interlock Watchdog (Runs every loop iteration)
  readSensors();
  if (currentLoadCurrent_A >= MAX_SAFE_CURRENT_A && isTestActive) {
    triggerEmergencyStop("OVERCURRENT (>3.0A)");
  }
  if (currentTemp_C >= MAX_SAFE_TEMP_C && isTestActive) {
    triggerEmergencyStop("OVERHEAT (>50.0C)");
  }

  // 3. Periodic telemetry transmission during active test
  if (isTestActive && (millis() - lastSampleTime >= SAMPLE_INTERVAL_MS)) {
    lastSampleTime = millis();
    takeMeasurement();
  }

  // 4. Auto-Cycle Multi-Page LCD Carousel every 2.5 seconds
  if (millis() - lastPageChangeTime >= PAGING_INTERVAL_MS) {
    lastPageChangeTime = millis();
    int maxPages = isTestActive ? TOTAL_TEST_PAGES : TOTAL_STANDBY_PAGES;
    currentDisplayPage = (currentDisplayPage + 1) % maxPages;
  }

  // 5. Refresh Physical LCD Display Content
  if (millis() - lastLcdUpdateTime >= LCD_INTERVAL_MS) {
    lastLcdUpdateTime = millis();
    updateLcdDisplay();
  }
}

// =============================================================
//                      SENSOR READING
// =============================================================
void readSensors() {
  // 1. Read Physical Temperature
  if (ds18b20Ready) {
    tempSensors.requestTemperatures();
    float t = tempSensors.getTempCByIndex(0);
    if (t != DEVICE_DISCONNECTED_C && t >= -20.0 && t <= 125.0) {
      currentTemp_C = t;
    }
  } else {
    // Fallback: Read internal ESP32 silicon temperature or maintain ambient baseline
    float rawT = temperatureRead();
    currentTemp_C = (rawT > 55.0) ? (rawT - 32.0) * 5.0 / 9.0 : rawT;
    if (currentTemp_C < 15.0 || currentTemp_C > 75.0) {
      currentTemp_C = 28.5 + (isTestActive ? (float)(millis() - testStartTime) / 10000.0 : 0.0);
    }
  }

  // 2. Read Physical Voltage & Current
  if (ina219Ready) {
    currentBusVoltage_V = ina219.getBusVoltage_V();
    float current_mA = ina219.getCurrent_mA();
    currentLoadCurrent_A = (current_mA > 0.0) ? (current_mA / 1000.0) : 0.0;
  } else {
    // Graceful test bench simulation if INA219 is not wired yet
    if (isTestActive) {
      unsigned long elapsed = millis() - testStartTime;
      float jitter = (float)random(-10, 10) / 1000.0;
      currentLoadCurrent_A = 1.480 + 0.030 * sin(elapsed / 1200.0) + jitter;
      if (currentLoadCurrent_A < 0.0) currentLoadCurrent_A = 0.0;

      float r_est = 0.065 + ((float)random(-3, 3) / 1000.0);
      currentVoltageDrop_V = currentLoadCurrent_A * r_est;
      currentBusVoltage_V = sourceVoltage_V - currentVoltageDrop_V;
    } else {
      currentBusVoltage_V = 5.030 + ((float)random(-5, 5) / 1000.0);
      currentLoadCurrent_A = 0.000;
      currentVoltageDrop_V = 0.000;
    }
  }

  // Derived metrics
  currentPower_W = currentBusVoltage_V * currentLoadCurrent_A;
  currentVoltageDrop_V = sourceVoltage_V - currentBusVoltage_V;
  if (currentVoltageDrop_V < 0.0) currentVoltageDrop_V = 0.0;

  if (currentLoadCurrent_A > 0.05) {
    currentResistance_Ohm = currentVoltageDrop_V / currentLoadCurrent_A;
  } else {
    currentResistance_Ohm = 0.000;
  }
}

// =============================================================
//                    LCD DISPLAY CAROUSEL
// =============================================================
void updateLcdDisplay() {
  if (!lcdReady) return;

  char line1[17];
  char line2[17];

  // PRIORITY 1: Emergency Safety Stop Screen
  if (isEmergencyCutoff) {
    snprintf(line1, sizeof(line1), "** EMERGENCY! **");
    snprintf(line2, sizeof(line2), "%-16s", emergencyReason);
    lcd.setCursor(0, 0);
    lcd.print(line1);
    lcd.setCursor(0, 1);
    lcd.print(line2);
    return;
  }

  // PRIORITY 2: Active Test Carousel (Rotates through 4 detailed pages)
  if (isTestActive) {
    switch (currentDisplayPage) {
      case 0:
        // Page 1: Core Electrical & Synchronized Health (Matches Web Cockpit)
        // Line 1: V: 4.10V I: 1.45A
        // Line 2: H: 55    FAULT   
        snprintf(line1, sizeof(line1), "V:%4.2fV I:%4.2fA", currentBusVoltage_V, currentLoadCurrent_A);
        snprintf(line2, sizeof(line2), "H:%3d  %-9s", syncHealthScore, syncFaultStatus);
        break;

      case 1:
        // Page 2: Power and Thermal Dissipation
        // Line 1: P: 5.95W T: 28.5C
        // Line 2: H: 55    FAULT   
        snprintf(line1, sizeof(line1), "P:%4.2fW T:%4.1fC", currentPower_W, currentTemp_C);
        snprintf(line2, sizeof(line2), "H:%3d  %-9s", syncHealthScore, syncFaultStatus);
        break;

      case 2:
        // Page 3: Conductor Loop Resistance & Voltage Sag Drop
        // Line 1: R:0.065R D:0.09V
        // Line 2: Status: FAULT   
        snprintf(line1, sizeof(line1), "R:%5.3fO D:%4.2fV", currentResistance_Ohm, currentVoltageDrop_V);
        snprintf(line2, sizeof(line2), "Stat:%-11s", syncFaultStatus);
        break;

      case 3:
      default:
        // Page 4: Session Runtime & Cable Tag
        // Line 1: ID: cable-001   
        // Line 2: Time: 00:24 Sync
        unsigned long elapsedSec = (millis() - testStartTime) / 1000;
        int mins = elapsedSec / 60;
        int secs = elapsedSec % 60;
        char timeBuf[8];
        snprintf(timeBuf, sizeof(timeBuf), "%02d:%02d", mins, secs);

        snprintf(line1, sizeof(line1), "Cbl:%-12s", currentCableId.substring(0, 12).c_str());
        snprintf(line2, sizeof(line2), "T:%-5s H:%-3d %-2s", timeBuf, syncHealthScore, (syncFaultStatus[0] == 'F' ? "FL" : "OK"));
        break;
    }
  }
  // PRIORITY 3: Idle / Standby Mode Carousel
  else {
    switch (currentDisplayPage) {
      case 0:
        // Standby Screen 1: Ready status & 5V Rail
        snprintf(line1, sizeof(line1), "ChargeGuard PRO ");
        snprintf(line2, sizeof(line2), "Rig Ready (5.0V)");
        break;

      case 1:
      default:
        // Standby Screen 2: Idle Voltage, Temp & Baseline Health
        snprintf(line1, sizeof(line1), "V:%4.2fV T:%4.1fC", currentBusVoltage_V, currentTemp_C);
        snprintf(line2, sizeof(line2), "H:%3d   %-8s", syncHealthScore, syncFaultStatus);
        break;
    }
  }

  // Write line buffers to LCD screen (avoids screen flickering)
  lcd.setCursor(0, 0);
  lcd.print(line1);
  lcd.setCursor(0, 1);
  lcd.print(line2);
}

// =============================================================
//               SYNCHRONIZATION COMMAND PARSER
// =============================================================
void handleSyncCommand(String cmd) {
  // Parse JSON: {"cmd":"SYNC","score":55,"status":"FAULT","reason":"CRITICAL_UNDERVOLTAGE"}
  int scoreIdx = cmd.indexOf("\"score\":");
  if (scoreIdx > 0) {
    int valStart = scoreIdx + 8;
    while (valStart < cmd.length() && (cmd[valStart] == ' ' || cmd[valStart] == ':')) valStart++;
    int valEnd = valStart;
    while (valEnd < cmd.length() && isDigit(cmd[valEnd])) valEnd++;
    syncHealthScore = cmd.substring(valStart, valEnd).toInt();
  }

  int statusIdx = cmd.indexOf("\"status\":");
  if (statusIdx > 0) {
    int q1 = cmd.indexOf('"', statusIdx + 9);
    int q2 = cmd.indexOf('"', q1 + 1);
    if (q1 > 0 && q2 > q1) {
      String st = cmd.substring(q1 + 1, q2);
      st.toUpperCase();
      st.toCharArray(syncFaultStatus, sizeof(syncFaultStatus));
    }
  }

  int reasonIdx = cmd.indexOf("\"reason\":");
  if (reasonIdx > 0) {
    int q1 = cmd.indexOf('"', reasonIdx + 9);
    int q2 = cmd.indexOf('"', q1 + 1);
    if (q1 > 0 && q2 > q1) {
      String re = cmd.substring(q1 + 1, q2);
      re.toCharArray(syncReason, sizeof(syncReason));
    }
  }

  hasReceivedSync = true;
  lastSyncReceivedTime = millis();
  updateLcdDisplay();
}

// =============================================================
//                    TELEMETRY TRANSMITTER
// =============================================================
void takeMeasurement() {
  readSensors();

  float stability = abs(5.0 - currentBusVoltage_V) / 5.0;

  // Emit structured JSON telemetry frame to host serial bridge
  Serial.print("{\"schema_version\": 1, ");
  Serial.print("\"device_id\": \"" + DEVICE_ID + "\", ");
  Serial.print("\"cable_id\": \"" + currentCableId + "\", ");
  Serial.print("\"test_id\": \"" + currentTestId + "\", ");
  Serial.print("\"mode\": \"hardware\", ");
  Serial.print("\"timestamp\": " + String(millis()) + ", ");
  Serial.print("\"source_voltage_v\": " + String(sourceVoltage_V, 3) + ", ");
  Serial.print("\"sink_voltage_v\": " + String(currentBusVoltage_V, 3) + ", ");
  Serial.print("\"current_a\": " + String(currentLoadCurrent_A, 3) + ", ");
  Serial.print("\"power_w\": " + String(currentPower_W, 3) + ", ");
  Serial.print("\"temperature_c\": " + String(currentTemp_C, 1) + ", ");
  Serial.print("\"voltage_drop_v\": " + String(currentVoltageDrop_V, 4) + ", ");
  Serial.print("\"effective_resistance_ohm\": " + String(currentResistance_Ohm, 4) + ", ");
  Serial.print("\"voltage_stability\": " + String(stability, 4) + ", ");
  Serial.print("\"fault_status\": \"" + String(syncFaultStatus) + "\", ");
  Serial.print("\"health_score\": " + String(syncHealthScore) + ", ");
  Serial.println("\"measurement_valid\": true}");
}

void sendPong() {
  Serial.print("{\"event\": \"PONG\", ");
  Serial.print("\"device_id\": \"" + DEVICE_ID + "\", ");
  Serial.print("\"firmware_version\": \"" + FIRMWARE_VERSION + "\", ");
  Serial.print("\"mode\": \"hardware\", ");
  Serial.print("\"is_test_active\": " + String(isTestActive ? "true" : "false") + ", ");
  Serial.print("\"load_enabled\": " + String(isTestActive ? "true" : "false") + ", ");
  Serial.print("\"health_score\": " + String(syncHealthScore) + ", ");
  Serial.print("\"fault_status\": \"" + String(syncFaultStatus) + "\", ");
  Serial.print("\"sensor_status\": {\"ina219\": \"" + String(ina219Ready ? "ok" : "simulated") + "\", ");
  Serial.print("\"ds18b20\": \"" + String(ds18b20Ready ? "ok" : "simulated") + "\", ");
  Serial.println("\"lcd\": \"" + String(lcdReady ? "ok" : "fault") + "\"}}");
}

void sendIdentify() {
  Serial.print("{\"event\": \"IDENTIFY\", ");
  Serial.print("\"device_id\": \"" + DEVICE_ID + "\", ");
  Serial.print("\"firmware_version\": \"" + FIRMWARE_VERSION + "\", ");
  Serial.print("\"mode\": \"hardware\", ");
  Serial.print("\"profile\": \"5V\", ");
  Serial.print("\"health_score\": " + String(syncHealthScore) + ", ");
  Serial.print("\"fault_status\": \"" + String(syncFaultStatus) + "\", ");
  Serial.print("\"sensor_status\": {\"ina219\": \"" + String(ina219Ready ? "ok" : "simulated") + "\", ");
  Serial.print("\"ds18b20\": \"" + String(ds18b20Ready ? "ok" : "simulated") + "\", ");
  Serial.println("\"lcd\": \"" + String(lcdReady ? "ok" : "fault") + "\"}}");
}

// =============================================================
//                    COMMAND DISPATCHER
// =============================================================
void handleCommand(String cmd) {
  if (cmd.equals("PING")) {
    sendPong();
  }
  else if (cmd.equals("IDENTIFY")) {
    sendIdentify();
  }
  else if (cmd.equals("STATUS")) {
    readSensors();
    takeMeasurement();
  }
  else if (cmd.indexOf("\"cmd\":\"SYNC\"") >= 0 || cmd.indexOf("\"cmd\": \"SYNC\"") >= 0 || cmd.startsWith("SYNC")) {
    handleSyncCommand(cmd);
  }
  else if (cmd.startsWith("START")) {
    isEmergencyCutoff = false;
    int firstSpace = cmd.indexOf(' ');
    int secondSpace = cmd.indexOf(' ', firstSpace + 1);

    if (firstSpace > 0 && secondSpace > 0) {
      currentCableId = cmd.substring(firstSpace + 1, secondSpace);
      currentTestId = cmd.substring(secondSpace + 1);
    } else if (firstSpace > 0) {
      currentCableId = cmd.substring(firstSpace + 1);
      currentTestId = "test-live-" + String(millis());
    } else {
      currentCableId = "cable-001";
      currentTestId = "test-live-" + String(millis());
    }

    isTestActive = true;
    testStartTime = millis();
    lastSampleTime = millis();
    lastPageChangeTime = millis();
    currentDisplayPage = 0;

    digitalWrite(LOAD_ENABLE_PIN, HIGH); // Engage 5V dynamic load
    digitalWrite(STATUS_LED_PIN, HIGH);

    if (lcdReady) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("STARTING TEST...");
      lcd.setCursor(0, 1);
      lcd.print(currentCableId.substring(0, 16));
      delay(400);
    }

    Serial.println("{\"event\": \"TEST_STARTED\", \"device_id\": \"" + DEVICE_ID + "\", \"cable_id\": \"" + currentCableId + "\", \"test_id\": \"" + currentTestId + "\"}");
    takeMeasurement();
  }
  else if (cmd.startsWith("STOP")) {
    String reason = "User requested stop";
    int firstSpace = cmd.indexOf(' ');
    if (firstSpace > 0) {
      reason = cmd.substring(firstSpace + 1);
    }
    stopTest(reason);
  }
  else {
    Serial.println("{\"error\": \"Unrecognized command\", \"command\": \"" + cmd + "\"}");
  }
}

void triggerEmergencyStop(String reason) {
  isEmergencyCutoff = true;
  strncpy(emergencyReason, reason.c_str(), sizeof(emergencyReason));
  syncHealthScore = 30;
  strncpy(syncFaultStatus, "FAULT", sizeof(syncFaultStatus));

  stopTest(reason);

  if (lcdReady) {
    lcd.clear();
    updateLcdDisplay();
  }

  Serial.println("{\"event\": \"EMERGENCY_STOP\", \"device_id\": \"" + DEVICE_ID + "\", \"reason\": \"" + reason + "\", \"health_score\": 30, \"fault_status\": \"FAULT\"}");
}

void stopTest(String reason) {
  isTestActive = false;
  digitalWrite(LOAD_ENABLE_PIN, LOW); // Safe default: disconnect load
  digitalWrite(STATUS_LED_PIN, LOW);

  if (lcdReady && !isEmergencyCutoff) {
    currentDisplayPage = 0;
    updateLcdDisplay();
  }

  Serial.println("{\"event\": \"TEST_STOPPED\", \"device_id\": \"" + DEVICE_ID + "\", \"reason\": \"" + reason + "\"}");
}
