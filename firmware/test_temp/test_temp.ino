void setup() {
  Serial.begin(115200);
}

void loop() {
  float temp = temperatureRead();
  int a34 = analogRead(34);
  int a35 = analogRead(35);
  Serial.print("CHIP_TEMP:");
  Serial.print(temp);
  Serial.print(" A34:");
  Serial.print(a34);
  Serial.print(" A35:");
  Serial.println(a35);
  delay(1000);
}
