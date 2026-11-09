#!/usr/bin/env python3
"""
ChargeGuard AI Pro - Serial to Backend Ingestion Bridge.

Reads newline-delimited JSON or documented CSV telemetry from an ESP32 micro-controller,
validates each measurement, handles USB disconnects with auto-reconnect, and forwards
valid frames to the FastAPI backend ingestion endpoint.

Protocol Formats Supported:
1. JSON Format (Recommended):
   {"device_id":"cg-esp32-001","cable_id":"cable-001","test_id":"test-001","source_voltage_v":5.01,"sink_voltage_v":4.88,"current_a":0.95,"temperature_c":28.5,"measurement_valid":true}
2. CSV Format (Documented Order):
   device_id,cable_id,test_id,source_v,sink_v,current_a,temperature_c,valid_int(1/0)
"""

import argparse
import json
import logging
import time
import sys
from datetime import datetime
from typing import Optional, Dict, Any

try:
    import serial
    import requests
except ImportError:
    print("Missing required libraries. Install with: pip install pyserial requests")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [SerialBridge] %(message)s"
)
logger = logging.getLogger("SerialBridge")

def parse_line(line_str: str) -> Optional[Dict[str, Any]]:
    """Parse newline-delimited JSON or fallback CSV into ingestion contract format."""
    line_str = line_str.strip()
    if not line_str:
        return None

    # Try JSON parsing first
    if line_str.startswith("{") and line_str.endswith("}"):
        try:
            data = json.loads(line_str)
            # Ensure mandatory fields
            if "device_id" in data and "test_id" in data:
                data.setdefault("schema_version", 1)
                data.setdefault("mode", "hardware")
                data.setdefault("timestamp", datetime.utcnow().isoformat())
                return data
        except json.JSONDecodeError as e:
            logger.warning(f"JSON decode failed on line: {line_str} (Error: {e})")
            return None

    # Try documented CSV parsing
    # Expected: device_id,cable_id,test_id,source_v,sink_v,current_a,temperature_c,valid_int
    parts = [p.strip() for p in line_str.split(",")]
    if len(parts) >= 6:
        try:
            device_id = parts[0]
            cable_id = parts[1]
            test_id = parts[2]
            source_v = float(parts[3]) if parts[3] and parts[3] != "null" else None
            sink_v = float(parts[4]) if parts[4] and parts[4] != "null" else None
            current_a = float(parts[5]) if parts[5] and parts[5] != "null" else None
            temp_c = float(parts[6]) if len(parts) > 6 and parts[6] and parts[6] != "null" else None
            is_valid = True
            if len(parts) > 7:
                is_valid = parts[7] in ("1", "true", "True")

            return {
                "schema_version": 1,
                "device_id": device_id,
                "cable_id": cable_id,
                "test_id": test_id,
                "timestamp": datetime.utcnow().isoformat(),
                "mode": "hardware",
                "source_voltage_v": source_v,
                "sink_voltage_v": sink_v,
                "current_a": current_a,
                "temperature_c": temp_c,
                "measurement_valid": is_valid
            }
        except ValueError as e:
            logger.warning(f"CSV parse error for line '{line_str}': {e}")
            return None

    logger.warning(f"Unrecognized serial format: '{line_str}'")
    return None


def run_bridge(port: str, baud: int, backend_url: str):
    """Main bridge loop with reconnection handling."""
    logger.info(f"Starting ChargeGuard Serial Bridge on {port} @ {baud} bps")
    logger.info(f"Target backend ingestion: {backend_url}")

    while True:
        try:
            logger.info(f"Connecting to serial port {port}...")
            with serial.Serial(port, baud, timeout=2.0) as ser:
                logger.info(f"Connected to {port} successfully. Listening for telemetry...")
                
                while ser.is_open:
                    try:
                        raw_bytes = ser.readline()
                        if not raw_bytes:
                            continue
                            
                        line = raw_bytes.decode("utf-8", errors="replace").strip()
                        if not line:
                            continue

                        payload = parse_line(line)
                        if not payload:
                            continue

                        # Forward to backend ingestion
                        try:
                            resp = requests.post(backend_url, json=payload, timeout=2.0)
                            if resp.status_code == 201:
                                logger.info(
                                    f"Frame posted -> V_sink={payload.get('sink_voltage_v')}V, "
                                    f"I={payload.get('current_a')}A, T={payload.get('temperature_c')}°C"
                                )
                            else:
                                logger.warning(f"Backend rejected frame ({resp.status_code}): {resp.text}")
                        except requests.RequestException as e:
                            logger.error(f"Failed to post to backend {backend_url}: {e}")

                    except serial.SerialException as e:
                        logger.error(f"Serial read error: {e}")
                        break

        except (serial.SerialException, FileNotFoundError) as e:
            logger.warning(f"Serial port {port} not accessible ({e}). Retrying in 3 seconds...")
            time.sleep(3.0)
        except KeyboardInterrupt:
            logger.info("Serial bridge stopped by user.")
            sys.exit(0)


def main():
    parser = argparse.ArgumentParser(description="ChargeGuard AI Pro ESP32 Serial Ingestion Bridge")
    parser.add_argument("--port", default="COM3", help="Serial port (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--baud", type=int, default=115200, help="Baud rate (default 115200)")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000/api/ingest/measurement",
        help="FastAPI ingestion endpoint URL"
    )
    args = parser.parse_args()
    run_bridge(args.port, args.baud, args.url)


if __name__ == "__main__":
    main()
