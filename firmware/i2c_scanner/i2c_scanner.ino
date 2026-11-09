#include <Wire.h>

void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 3000);
  Wire.begin(21, 22);
  Serial.println("I2C_SCAN_START");
}

void loop() {
  byte error, address;
  int nDevices = 0;
  for (address = 1; address < 127; address++) {
    Wire.beginTransmission(address);
    error = Wire.endTransmission();
    if (error == 0) {
      Serial.print("I2C_DEV_FOUND:0x");
      if (address < 16) Serial.print("0");
      Serial.println(address, HEX);
      nDevices++;
    }
  }
  Serial.print("I2C_TOTAL:");
  Serial.println(nDevices);
  delay(2000);
}
