# Safety Specifications and Operational Constraints

## 1. Safety Overview
ChargeGuard AI Pro is a laboratory screening prototype designed exclusively for controlled fixed 5.0 V DC electrical tests on USB charging cables.

> [!WARNING]
> This application is NOT a substitute for independent physical hardware safety devices such as fuses, polyfuses (PTCs), thermal fuses, or hardware over-current protection circuits. Software shutdown must always be paired with appropriate physical fusing.

## 2. Hard Electrical and Thermal Limits
The ESP32 firmware and backend diagnostic engine enforce the following non-bypassable limits:

| Metric | Nominal Range | Warning Limit | Critical Safety Limit | Action on Critical |
| :--- | :--- | :--- | :--- | :--- |
| **Profile Voltage** | 5.00 V DC | < 4.50 V or > 5.30 V | < 4.20 V or > 5.60 V | Emergency Test Cutoff |
| **Current Draw** | 0.00 – 2.00 A | >= 2.40 A | >= 3.00 A | Instant Hardware Disconnect |
| **Cable Surface Temp** | 20.0 – 38.0 °C | >= 42.0 °C | >= 50.0 °C | Load Cutoff & Overheat Alert |
| **Path Resistance** | < 0.25 Ω | > 0.60 Ω | > 1.00 Ω | High Resistance Warning |

## 3. Disclaimers and Limitations
1. **Screening Prototype Only**: This system does not certify official USB-IF (USB Implementers Forum) compliance.
2. **Thermal Measurement**: The DS18B20 sensor measures outer connector/jacket surface temperature. Internal copper core temperature will typically be higher under heavy continuous load.
3. **Counterfeit Detection**: Electrical screening can identify thin conductor gauge, excessive contact resistance, and poor thermal dissipation. It does NOT definitively prove counterfeit status without microscopic metallurgical and silicon analysis.
4. **USB-C PD Profiles**: Do NOT modify firmware to trigger 9V, 15V, 20V, or 48V (EPR) Power Delivery profiles on this prototype fixture. Doing so without rated differential isolation and rated dummy loads poses serious component destruction and fire hazard.
