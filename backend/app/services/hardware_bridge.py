"""
Hardware Bridge Service for ChargeGuard AI Pro.

Manages direct USB-UART communication with connected ESP32 test fixtures on Windows COM ports.
Provides thread-safe serial reading, genuine hardware handshakes (IDENTIFY/PING),
automatic release of locked serial monitors, and live telemetry streaming into the test engine.
"""

import asyncio
import json
import logging
import os
import subprocess
import threading
import time
from datetime import datetime
from typing import Optional, Dict, Any, List

from app.core.datetime_utils import utc_now, utc_now_iso
from app.core.logging import logger
from app.db.database import SessionLocal
from app.models import Device, TestSession
from app.schemas import MeasurementIngestContract
from app.websocket.manager import ws_manager

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    serial = None


class HardwareBridgeService:
    def __init__(self):
        self.port: Optional[str] = None
        self.baud: int = 115200
        self.device_id: str = "cg-esp32-001"
        self.firmware_version: str = "cg-fw-1.2.0"
        self.sensor_status: Dict[str, str] = {"ina219": "ok", "ds18b20": "ok", "lcd": "ok"}
        self.is_connected: bool = False
        self.last_seen_at: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self.rx_frame_count: int = 0
        self.active_test_id: Optional[str] = None
        self.active_cable_id: Optional[str] = None

        self.ser: Optional[Any] = None
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self.loop: Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()

    def release_port_locks(self, port: str):
        """
        On Windows, if Arduino IDE's Serial Monitor is holding the COM port,
        terminate the child serial-monitor.exe to free the exclusive hardware lock.
        """
        try:
            # Query and kill serial-monitor.exe if running
            cmd = 'taskkill /F /IM serial-monitor.exe /T'
            subprocess.run(cmd, shell=True, capture_output=True, timeout=3.0)
            time.sleep(0.6)
            logger.info(f"Released potential serial-monitor locks on {port}")
        except Exception as e:
            logger.debug(f"Error while releasing port locks: {e}")

    def list_ports(self) -> List[Dict[str, Any]]:
        """Discover attached Windows COM ports and flag likely ESP32 devices."""
        if not serial:
            return []
        try:
            ports = list(serial.tools.list_ports.comports())
            result = []
            for p in ports:
                desc = p.description or p.device
                desc_lower = desc.lower()
                hwid_lower = (p.hwid or "").lower()
                is_esp = any(chip in desc_lower or chip in hwid_lower for chip in [
                    "cp210", "ch340", "ch341", "ftdi", "usb serial", "uart", "esp32", "silicon labs"
                ])
                result.append({
                    "device": p.device,
                    "description": desc,
                    "hwid": p.hwid or "",
                    "is_esp": is_esp
                })
            return result
        except Exception as e:
            logger.error(f"Failed to enumerate serial ports: {e}")
            return []

    def connect(self, port: str, baud: int = 115200, force_unlock: bool = True) -> Dict[str, Any]:
        """
        Open a connection to the specified COM port and begin background monitoring.
        If the specified port is not found or fails, automatically scans for an active ESP32 device.
        """
        with self._lock:
            if not serial:
                self.last_error = "PySerial is not installed in the backend environment"
                return self.get_status()

            if self.is_connected and self.port == port:
                return self.get_status()

            if self.is_connected:
                self._disconnect_internal()

            # If port is 'auto' or empty, detect from system
            candidate_ports = [port] if port and port.lower() not in ("auto", "") else []
            available = self.list_ports()
            for p in available:
                if p.get("is_esp") and p["device"] not in candidate_ports:
                    candidate_ports.append(p["device"])
            # Fallback to any non-bluetooth port
            for p in available:
                if "bluetooth" not in p.get("description", "").lower() and p["device"] not in candidate_ports:
                    candidate_ports.append(p["device"])

            if not candidate_ports:
                self.last_error = "No serial ports available to connect."
                return self.get_status()

            opened_ser = None
            last_err = None
            for p in candidate_ports:
                try:
                    opened_ser = serial.Serial(
                        port=p,
                        baudrate=baud,
                        bytesize=serial.EIGHTBITS,
                        parity=serial.PARITY_NONE,
                        stopbits=serial.STOPBITS_ONE,
                        timeout=0.5
                    )
                    self.port = p
                    break
                except Exception as e:
                    err_str = str(e)
                    if ("PermissionError" in err_str or "Access is denied" in err_str) and force_unlock:
                        logger.warning(f"Port {p} locked. Releasing serial-monitor locks...")
                        self.release_port_locks(p)
                        try:
                            opened_ser = serial.Serial(
                                port=p,
                                baudrate=baud,
                                bytesize=serial.EIGHTBITS,
                                parity=serial.PARITY_NONE,
                                stopbits=serial.STOPBITS_ONE,
                                timeout=0.5
                            )
                            self.port = p
                            break
                        except Exception as retry_err:
                            last_err = f"Port {p} locked: {retry_err}"
                    else:
                        last_err = f"Failed to open {p}: {err_str}"

            if not opened_ser:
                self.last_error = last_err or f"Could not connect to any port from {candidate_ports}"
                logger.error(self.last_error)
                return self.get_status()

            self.ser = opened_ser
            self.baud = baud
            self.last_error = None
            self.sensor_status = {"ina219": "ok", "ds18b20": "ok", "lcd": "ok"}
            self.is_connected = True
            self.last_seen_at = utc_now()
            self._stop_event.clear()

            # Start background reader thread
            self._thread = threading.Thread(
                target=self._reader_loop,
                name=f"HardwareBridge-{self.port}",
                daemon=True
            )
            self._thread.start()

            # Wait briefly for board to complete bootloader reset and send IDENTIFY
            time.sleep(0.8)
            self._send_raw(b"IDENTIFY\n")
            time.sleep(0.1)
            self._send_raw(b"STATUS\n")

            self._update_db_device_status(online=True)
            logger.info(f"Connected to ESP32 test rig on {self.port} @ {baud} baud")
            return self.get_status()

    def disconnect(self) -> Dict[str, Any]:
        """Disconnect the hardware bridge and release the COM port."""
        with self._lock:
            self._disconnect_internal()
            return self.get_status()

    def _disconnect_internal(self):
        self._stop_event.set()
        if self.ser:
            try:
                if self.ser.is_open:
                    self.ser.write(b"STOP Disconnect requested\n")
                    self.ser.flush()
                    self.ser.close()
            except Exception as e:
                logger.debug(f"Error closing serial port: {e}")
            finally:
                self.ser = None

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.5)
            self._thread = None

        self.is_connected = False
        self._update_db_device_status(online=False)
        logger.info(f"Disconnected ESP32 test rig from {self.port}")

    def get_status(self) -> Dict[str, Any]:
        """Return the current connection and sensor status."""
        return {
            "connected": self.is_connected,
            "port": self.port,
            "baud": self.baud,
            "device_id": self.device_id,
            "firmware_version": self.firmware_version,
            "sensor_status": self.sensor_status,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
            "last_error": self.last_error,
            "rx_frame_count": self.rx_frame_count,
            "active_test_id": self.active_test_id
        }

    def start_hardware_test(self, cable_id: str, test_id: str):
        """Instruct the ESP32 to arm load and start streaming."""
        self.active_cable_id = cable_id
        self.active_test_id = test_id
        cmd = f"START {cable_id} {test_id}\n"
        self._send_raw(cmd.encode("utf-8"))
        logger.info(f"[Bridge -> ESP32] START sent for cable {cable_id}, test {test_id}")

    def stop_hardware_test(self, reason: str = "User requested stop"):
        """Instruct the ESP32 to disengage load and stop streaming."""
        cmd = f"STOP {reason}\n"
        self._send_raw(cmd.encode("utf-8"))
        self.active_test_id = None
        logger.info(f"[Bridge -> ESP32] STOP sent: {reason}")

    def send_sync_command(self, score: int, status: str, reason: str = "OK", v: Optional[float] = None, i: Optional[float] = None, t: Optional[float] = None):
        """
        Transmit authoritative centralized health score and fault classification
        down to the ESP32 physical fixture so the physical LCD displays the exact same values.
        """
        payload = {
            "cmd": "SYNC",
            "score": int(score),
            "status": str(status).upper(),
            "reason": str(reason)[:24]
        }
        if v is not None:
            payload["v"] = round(float(v), 2)
        if i is not None:
            payload["i"] = round(float(i), 2)
        if t is not None:
            payload["t"] = round(float(t), 1)

        msg = json.dumps(payload) + "\n"
        self._send_raw(msg.encode("utf-8"))
        logger.info(f"[Bridge -> ESP32 SYNC] Sent: {msg.strip()}")

    def _send_raw(self, data: bytes):
        if self.ser and self.ser.is_open:
            try:
                self.ser.write(data)
                self.ser.flush()
            except Exception as e:
                logger.warning(f"Serial write error: {e}")

    def _update_db_device_status(self, online: bool):
        """Update device online_status in the DB and broadcast via WebSocket."""
        db = SessionLocal()
        try:
            device = db.query(Device).filter(Device.device_id == self.device_id).first()
            if not device:
                device = Device(
                    device_id=self.device_id,
                    display_name=f"ESP32 Lab Rig Bench #1",
                    connection_mode="hardware",
                    firmware_version=self.firmware_version,
                    online_status=online,
                    last_seen_at=utc_now() if online else None
                )
                db.add(device)
            else:
                device.online_status = online
                if online:
                    device.last_seen_at = utc_now()
                device.firmware_version = self.firmware_version
            db.commit()

            # Broadcast via WebSocket
            if self.loop and not self.loop.is_closed():
                asyncio.run_coroutine_threadsafe(
                    ws_manager.broadcast({
                        "type": "device_status",
                        "data": {
                            "device_id": self.device_id,
                            "online_status": online,
                            "last_seen_at": utc_now_iso() if online else None,
                            "port": self.port,
                            "sensor_status": self.sensor_status,
                            "last_error": self.last_error,
                            "firmware_version": self.firmware_version
                        }
                    }),
                    self.loop
                )
        except Exception as e:
            logger.error(f"Failed to update device status in DB: {e}")
        finally:
            db.close()

    def _reader_loop(self):
        """Continuous background loop reading newline-delimited serial frames."""
        last_ping_time = time.time()
        logger.info(f"Serial reader loop started on {self.port}")

        while not self._stop_event.is_set() and self.ser and self.ser.is_open:
            try:
                # Periodic PING every 10s to keep connection verified
                now = time.time()
                if now - last_ping_time >= 10.0:
                    last_ping_time = now
                    self._send_raw(b"PING\n")

                line_bytes = self.ser.readline()
                if not line_bytes:
                    continue

                line = line_bytes.decode("utf-8", errors="replace").strip()
                if not line:
                    continue

                self.last_seen_at = utc_now()
                self._handle_incoming_line(line)

            except serial.SerialException as e:
                logger.error(f"Serial communication error on {self.port}: {e}")
                self.last_error = str(e)
                break
            except Exception as e:
                logger.debug(f"Reader loop exception: {e}")
                time.sleep(0.1)

        self.is_connected = False
        self._update_db_device_status(online=False)
        logger.info(f"Serial reader loop exited for {self.port}")

    def _handle_incoming_line(self, line: str):
        """Process a decoded serial line from the ESP32."""
        logger.info(f"[ESP32 RX] {line}")
        # 1. Check for JSON structure
        if line.startswith("{") and line.endswith("}"):
            try:
                payload = json.loads(line)
                self.rx_frame_count += 1

                # Check handshake events
                event = payload.get("event") or payload.get("system")
                if event in ("IDENTIFY", "PONG") or "ChargeGuard" in str(event):
                    if payload.get("device_id"):
                        self.device_id = payload["device_id"]
                    if payload.get("firmware_version"):
                        self.firmware_version = payload["firmware_version"]
                    if payload.get("sensor_status"):
                        self.sensor_status = payload["sensor_status"]
                    self._update_db_device_status(online=True)
                    return

                # Check telemetry frame
                if "sink_voltage_v" in payload or "measurement_valid" in payload:
                    self._process_telemetry_frame(payload)
                    return

            except json.JSONDecodeError:
                pass

        # 2. Check for text indicator strings (e.g., test sketches emitting "ESP32 OK")
        if "ESP32" in line or "Ready" in line:
            self.firmware_version = "cg-fw-1.2.0"
            self._update_db_device_status(online=True)

    def _process_telemetry_frame(self, payload: Dict[str, Any]):
        """Forward telemetry frame to the test runner engine."""
        cable_id = payload.get("cable_id") or self.active_cable_id or "cable-001"
        test_id = payload.get("test_id") or self.active_test_id
        if not test_id or test_id == "idle":
            # Check if there is an active running hardware test in the database
            db = SessionLocal()
            try:
                active_session = db.query(TestSession).filter(
                    TestSession.device_id == self.device_id,
                    TestSession.status == "running"
                ).first()
                if active_session:
                    test_id = active_session.test_id
                    cable_id = active_session.cable_id
                    self.active_test_id = test_id
                    self.active_cable_id = cable_id
            except Exception as e:
                logger.debug(f"Failed to query active session for telemetry: {e}")
            finally:
                db.close()

        if not test_id or test_id == "idle":
            return

        contract = MeasurementIngestContract(
            schema_version=payload.get("schema_version", 1),
            device_id=payload.get("device_id", self.device_id),
            cable_id=cable_id,
            test_id=test_id,
            timestamp=utc_now(),
            mode="hardware",
            source_voltage_v=payload.get("source_voltage_v"),
            sink_voltage_v=payload.get("sink_voltage_v"),
            current_a=payload.get("current_a"),
            power_w=payload.get("power_w"),
            temperature_c=payload.get("temperature_c"),
            humidity_pct=payload.get("humidity_pct"),
            voltage_stability=payload.get("voltage_stability"),
            fault_status=payload.get("fault_status", "NORMAL"),
            measurement_valid=payload.get("measurement_valid", True),
            validity_reason=payload.get("validity_reason")
        )

        target_loop = self.loop
        if not target_loop or target_loop.is_closed():
            try:
                target_loop = asyncio.get_running_loop()
            except RuntimeError:
                try:
                    target_loop = asyncio.get_event_loop()
                except Exception:
                    pass

        if target_loop and not target_loop.is_closed():
            from app.services.test_runner import process_incoming_measurement
            async def _safe_ingest():
                db = SessionLocal()
                try:
                    await process_incoming_measurement(db, contract)
                except Exception as ingest_err:
                    logger.error(f"Error in measurement ingestion: {ingest_err}")
                finally:
                    db.close()

            try:
                future = asyncio.run_coroutine_threadsafe(
                    _safe_ingest(),
                    target_loop
                )
                def _done_callback(fut):
                    try:
                        exc = fut.exception()
                        if exc:
                            logger.error(f"Async measurement ingest error: {exc}")
                    except Exception:
                        pass
                future.add_done_callback(_done_callback)
            except Exception as e:
                logger.error(f"Failed to schedule measurement processing: {e}")


# Singleton Instance
hardware_bridge_service = HardwareBridgeService()

