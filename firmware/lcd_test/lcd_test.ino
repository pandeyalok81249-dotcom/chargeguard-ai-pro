#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  Serial.begin(115200);
  Wire.begin(21, 22);
  lcd.init();
  lcd.backlight();
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("ChargeGuard PRO");
  lcd.setCursor(0, 1);
  lcd.print("LCD Test OK!");
  Serial.println("LCD_TEST_INITIALIZED");
}

void loop() {
  delay(1000);
}
