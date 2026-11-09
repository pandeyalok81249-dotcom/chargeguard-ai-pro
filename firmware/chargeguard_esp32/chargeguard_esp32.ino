/*
 * ChargeGuard AI Pro - ESP32 Firmware
 * Hardware Test Profile: Fixed 5.0 V USB-C Sink with INA219 & DS18B20
 *
 * Safety Notice:
 * - This firmware controls a student prototype test fixture for a verified fixed 5 V profile.
 * - Do NOT request 9V/15V/20V PD profiles without verified isolation.
 * - An automatic emergency cutoff is executed if current > 3.0 A or temperature > 55.0 °C.
 */

#include <Wire.h>
#include <Adafruit_INA219.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// Pin Definitions
#define ONE_WIRE_BUS 4        // DS18B20 OneWire Data Pin
#define LOAD_ENABLE_PIN 16    // Active-HIGH MOSFET switch to engage 5V load
#define STATUS_LED_PIN 2      // On-board diagnostic indicator LED

// Safety Limits
const float MAX_SAFE_CURRENT_A = 3.0;
const float MAX_SAFE_TEMP_C = 55.0;
const float MIN_SAFE_VOLTAGE_V = 3.8;
const float MAX_SAFE_VOLTAGE_V = 5.6;

Adafruit_INA219 ina219;
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensors(&oneWire);

// Active Test State
String currentDeviceId = "cg-esp32-001";
String currentCableId = "cable-001";
String currentTestId = "test-live-001";
bool isTestActive = false;
unsigned long lastSampleTime = 0;
const unsigned long SAMPLE_INTERVAL_MS = 1000;

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);

  pinMode(LOAD_ENABLE_PIN, OUTPUT);
  digitalWrite(LOAD_ENABLE_PIN, LOW); // Safe default: load disconnected

  pinMode(STATUS_LED_PIN, OUTPUT);
  digitalWrite(STATUS_LED_PIN, LOW);

  // Initialize I2C Bus for INA219
  Wire.begin(21, 22); // SDA=21, SCL=22
  if (!ina219.begin()) {
    Serial.println("{\"error\": \"INA219 current/voltage sensor initialization failed\"}");
  }

  // Initialize Temperature Sensor
  tempSensors.begin();
  tempSensors.setResolution(11); // 0.125°C resolution, fast 375ms conversion

  Serial.println("{\"system\": \"ChargeGuard AI Pro Firmware Ready\", \"mode\": \"hardware\", \"profile\": \"5V\"}");
}

void loop() {
  // Check for incoming serial commands (e.g. START, STOP)
  if (Serial.available() > 0) {
    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    handleCommand(cmd);
  }

  // Sample and stream measurements during active test
  if (isTestActive && (millis() - lastSampleTime >= SAMPLE_INTERVAL_MS)) {
    lastSampleTime = millis();
    takeMeasurement();
  }
}

void handleCommand(String cmd) {
  if (cmd.startsWith("START")) {
    // Expected format: START <cable_id> <test_id>
    int firstSpace = cmd.indexOf(' ');
    int secondSpace = cmd.indexOf(' ', firstSpace + 1);

    if (firstSpace > 0 && secondSpace > 0) {
      currentCableId = cmd.substring(firstSpace + 1, secondSpace);
      currentTestId = cmd.substring(secondSpace + 1);
    }

    isTestActive = true;
    digitalWrite(LOAD_ENABLE_PIN, HIGH); // Engage load
    digitalWrite(STATUS_LED_PIN, HIGH);
    Serial.println("{\"event\": \"TEST_STARTED\", \"test_id\": \"" + currentTestId + "\"}");
  }
  else if (cmd.equals("STOP")) {
    stopTest("User requested stop");
  }
}

void stopTest(String reason) {
  isTestActive = false;
  digitalWrite(LOAD_ENABLE_PIN, LOW); // Disconnect load safely
  digitalWrite(STATUS_LED_PIN, LOW);
  Serial.println("{\"event\": \"TEST_STOPPED\", \"reason\": \"" + reason + "\"}");
}

void takeMeasurement() {
  // Read INA219
  float busVoltage_V = ina219.getBusVoltage_V();
  float current_mA = ina219.getCurrent_mA();
  float current_A = current_mA / 1000.0;
  if (current_A < 0.0) current_A = 0.0; // clamp reverse noise

  // Read DS18B20
  tempSensors.requestTemperatures();
  float temp_C = tempSensors.getTempCByIndex(0);

  bool isValid = true;
  String reason = "";

  // Sensor health checks
  if (temp_C == DEVICE_DISCONNECTED_C || temp_C < -40.0 || temp_C > 125.0) {
    isValid = false;
    reason = "DS18B20 temperature sensor fault";
  }

  // Hardware Safety Trips (Independent micro-controller cutoff)
  if (current_A > MAX_SAFE_CURRENT_A) {
    stopTest("Emergency over-current trip: > 3.0A");
    return;
  }
  if (temp_C > MAX_SAFE_TEMP_C) {
    stopTest("Emergency thermal runaway cutoff: > 55.0C");
    return;
  }

  // Emit Schema Version 1 JSON Frame
  Serial.print("{\"schema_version\": 1, ");
  Serial.print("\"device_id\": \"" + currentDeviceId + "\", ");
  Serial.print("\"cable_id\": \"" + currentCableId + "\", ");
  Serial.print("\"test_id\": \"" + currentTestId + "\", ");
  Serial.print("\"mode\": \"hardware\", ");
  Serial.print("\"source_voltage_v\": null, "); // Starter firmware single-ended sink measurement
  Serial.print("\"sink_voltage_v\": " + String(busVoltage_V, 3) + ", ");
  Serial.print("\"current_a\": " + String(current_A, 3) + ", ");
  Serial.print("\"power_w\": " + String(busVoltage_V * current_A, 3) + ", ");
  Serial.print("\"temperature_c\": " + String(temp_C, 1) + ", ");
  Serial.print("\"measurement_valid\": " + String(isValid ? "true" : "false"));
  if (!isValid) {
    Serial.print(", \"validity_reason\": \"" + reason + "\"");
  }
  Serial.println("}");
}
