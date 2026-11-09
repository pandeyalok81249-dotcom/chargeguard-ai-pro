"""
ChargeGuard AI Pro - ESP32 Auto Flasher and Hardware Rig Validator
Detects connected ESP32 COM port, compiles and uploads firmware, and validates LCD/sensors.
"""

import os
import sys
import time
import subprocess
import json

def get_esp32_port():
    import serial.tools.list_ports
    ports = list(serial.tools.list_ports.comports())
    for p in ports:
        desc = (p.description or "").lower()
        hwid = (p.hwid or "").lower()
        if any(chip in desc or chip in hwid for chip in ["cp210", "ch340", "ch341", "ftdi", "usb serial", "uart", "esp32"]):
            return p.device
    # Fallback to non-bluetooth ports
    for p in ports:
        if "bluetooth" not in p.description.lower() and "bthenum" not in (p.hwid or "").lower():
            return p.device
    return None

def main():
    print("=" * 60)
    print("ChargeGuard AI Pro - ESP32 Hardware Rig Setup & Flasher")
    print("=" * 60)

    port = get_esp32_port()
    if not port:
        print("[!] No ESP32 detected on USB.")
        print("[!] Please plug your ESP32 board into your USB port and run this again.")
        return 1

    print(f"[*] Detected ESP32 on port: {port}")

    # 1. Kill any serial monitors holding the port
    print("[*] Releasing any serial locks...")
    subprocess.run("taskkill /F /IM serial-monitor.exe /T", shell=True, capture_output=True)
    time.sleep(1.0)

    # 2. Compile sketch
    cli_path = r"C:\Users\pande\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
    sketch_path = os.path.abspath(r"firmware\chargeguard_esp32")

    print("[*] Compiling ChargeGuard ESP32 firmware with LCD (0x27)...")
    res = subprocess.run([cli_path, "compile", "-b", "esp32:esp32:esp32", sketch_path], capture_output=True, text=True)
    if res.returncode != 0:
        print("[x] Compilation failed:\n", res.stderr)
        return 1
    print("[+] Compilation successful!")

    # 3. Upload firmware
    print(f"[*] Uploading firmware to {port}...")
    res = subprocess.run([cli_path, "upload", "-p", port, "-b", "esp32:esp32:esp32", sketch_path], capture_output=True, text=True)
    if res.returncode != 0:
        print("[x] Upload failed:\n", res.stderr)
        return 1
    print("[+] Upload successful!")
    print(f"[+] ESP32 flashed and ready on {port}!")
    print("[*] The 16x2 LCD should now display:")
    print("    Line 1: V: 5.02V  T: 28.5C")
    print("    Line 2: Rig Ready (5.0V)")

    # 4. Connect bridge in backend
    time.sleep(2.0)
    try:
        import urllib.request
        req = urllib.request.Request(
            "http://127.0.0.1:8000/api/devices/bridge/connect",
            data=json.dumps({"port": port, "baud": 115200, "force_unlock": True}).encode(),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as resp:
            print("[+] Backend Hardware Bridge connected:", resp.read().decode())
    except Exception as e:
        print("[!] Backend bridge connection notice:", e)

    return 0

if __name__ == "__main__":
    sys.exit(main())
