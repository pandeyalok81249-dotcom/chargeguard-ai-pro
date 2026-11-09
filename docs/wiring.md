# Hardware Wiring and Test Fixture Schematics

## 1. Components Required
1. **ESP32 NodeMCU / DevKit V1** (30-pin or 38-pin).
2. **Adafruit INA219** High-Side DC Current & Voltage Sensor (I2C address `0x40`).
3. **Maxim DS18B20** Digital Temperature Sensor (TO-92 or waterproof probe) with 4.7kΩ pullup resistor.
4. **USB-C PD Sink Trigger Board** configured permanently for fixed 5 V.
5. **N-Channel Logic-Level Power MOSFET** (e.g. IRLZ44N or AO3400) for load switching.
6. **Constant Current Electronic Load** or 5Ω / 10W power resistor (for ~1 A test load at 5 V).

## 2. Wiring Connections

```
[ ESP32 ]                      [ INA219 ]
  3V3    --------------------->  VCC
  GND    --------------------->  GND
  GPIO 21 (SDA) -------------->  SDA
  GPIO 22 (SCL) -------------->  SCL

[ 5V Source / PD Trigger ]     [ INA219 & Load ]
  VBUS (+) ------------------->  VIN+
                                 VIN- --------->  [ Power Resistor / Load ] (+)
  GND ------------------------>  [ Power Resistor / Load ] (-) via MOSFET Drain
                                 MOSFET Source -> System Common GND

[ ESP32 ]                      [ MOSFET ]
  GPIO 16 -------------------->  MOSFET Gate (with 10kΩ pulldown to GND)

[ ESP32 ]                      [ DS18B20 ]
  3V3    --------------------->  VDD (Pin 3)
  GND    --------------------->  GND (Pin 1)
  GPIO 4  -------------------->  DATA (Pin 2)
  (Place 4.7kΩ resistor between GPIO 4 and 3V3)
```

## 3. Physical Placement
- Affix the DS18B20 sensor probe firmly against the sink-side USB-C connector shell using thermal tape.
- Keep high-current ground return paths short and heavy gauge (> 20 AWG).
