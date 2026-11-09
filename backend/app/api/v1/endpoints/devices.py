"""Device management endpoints."""

import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from app.core.datetime_utils import utc_now

logger = logging.getLogger("chargeguard")

from app.db.database import get_db
from app.models import Device, DeviceConfiguration
from app.schemas import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceConfigurationResponse,
    DeviceConfigurationUpdate,
    SerialPortInfo,
    DeviceHeartbeatRequest,
    DeviceCommandResponse,
    BridgeConnectRequest,
    BridgeStatusResponse,
)
from app.services.hardware_bridge import hardware_bridge_service
from app.websocket.manager import ws_manager

router = APIRouter()

# In-memory command queues for connected hardware devices
_device_command_queues: Dict[str, List[Dict[str, Any]]] = {}

def enqueue_device_command(device_id: str, cmd: Dict[str, Any]):
    """Add a command (e.g. START, STOP) to a hardware device's queue."""
    if device_id not in _device_command_queues:
        _device_command_queues[device_id] = []
    _device_command_queues[device_id].append(cmd)

def get_next_device_command(device_id: str) -> Optional[Dict[str, Any]]:
    """Pop the next pending command for a device."""
    q = _device_command_queues.get(device_id, [])
    if q:
        return q.pop(0)
    return None


@router.get("/devices/ports", response_model=List[SerialPortInfo], summary="Discover System Serial Ports")
def list_serial_ports():
    """
    Enumerate real Windows COM ports using PySerial.
    Detects hardware USB-UART bridges (CP210x, CH340, FTDI, ESP32 native USB).
    Sorts ESP32 and USB hardware ports first; deprioritizes virtual Bluetooth ports.
    """
    try:
        import serial.tools.list_ports
        ports = list(serial.tools.list_ports.comports())
        result = []
        for p in ports:
            desc_lower = (p.description or "").lower()
            hwid_lower = (p.hwid or "").lower()
            is_esp = any(chip in desc_lower or chip in hwid_lower for chip in [
                "cp210", "ch340", "ch341", "ftdi", "usb serial", "uart", "esp32", "silicon labs"
            ])
            result.append(SerialPortInfo(
                device=p.device,
                description=p.description or p.device,
                hwid=p.hwid or "",
                is_esp=is_esp
            ))
        
        # Sort: ESP32 first, then other USB, then Bluetooth last
        def port_priority(p: SerialPortInfo) -> int:
            if p.is_esp:
                return 0
            desc = p.description.lower()
            if "bluetooth" in desc or "bthenum" in p.hwid.lower():
                return 2
            return 1

        result.sort(key=port_priority)
        return result
    except Exception as e:
        return []
    except Exception as e:
        return []


@router.get("/devices", response_model=List[DeviceResponse], summary="List All Devices")
def list_devices(db: Session = Depends(get_db)):
    """Retrieve all registered hardware and simulator devices."""
    return db.query(Device).order_by(Device.created_at.desc()).all()


@router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED, summary="Register Device")
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    """Register a new ESP32 bridge or simulator device ID."""
    existing = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with ID '{payload.device_id}' already registered"
        )
    device = Device(
        device_id=payload.device_id,
        display_name=payload.display_name,
        connection_mode=payload.connection_mode,
        firmware_version=payload.firmware_version,
        online_status=(payload.connection_mode == "demo"),
        last_seen_at=utc_now() if payload.connection_mode == "demo" else None
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@router.post("/devices/heartbeat", response_model=DeviceResponse, summary="Device Heartbeat / Online Status")
async def device_heartbeat(payload: DeviceHeartbeatRequest, db: Session = Depends(get_db)):
    """
    Update device online status from the serial bridge upon verified handshake.
    Broadcasts state changes to all WebSocket clients.
    """
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        device = Device(
            device_id=payload.device_id,
            display_name=f"ESP32 Test Rig ({payload.device_id})",
            connection_mode="hardware",
            firmware_version=payload.firmware_version or "cg-fw-1.2.0",
            online_status=(payload.status == "online"),
            last_seen_at=utc_now() if payload.status == "online" else None
        )
        db.add(device)
    else:
        device.online_status = (payload.status == "online")
        if payload.status == "online":
            device.last_seen_at = utc_now()
        if payload.firmware_version:
            device.firmware_version = payload.firmware_version

    db.commit()
    db.refresh(device)

    # Broadcast device status update to WebSocket
    await ws_manager.broadcast({
        "type": "device_status",
        "data": {
            "device_id": device.device_id,
            "online_status": device.online_status,
            "last_seen_at": device.last_seen_at.isoformat() if device.last_seen_at else None,
            "port": payload.port,
            "sensor_status": payload.sensor_status,
            "last_error": payload.last_error,
            "firmware_version": device.firmware_version
        }
    })
    return device


@router.get("/devices/{device_id}/command", response_model=DeviceCommandResponse, summary="Fetch Pending Hardware Command")
def get_device_command(device_id: str):
    """
    Called by the Python serial bridge to poll for pending commands (START, STOP)
    dispatched by user test actions.
    """
    cmd = get_next_device_command(device_id)
    if cmd:
        return DeviceCommandResponse(**cmd)
    return DeviceCommandResponse(command=None)


@router.get("/devices/{device_id}", response_model=DeviceResponse, summary="Get Device Details")
def get_device(device_id: str, db: Session = Depends(get_db)):
    """Get device specifications and status."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    return device


@router.put("/devices/{device_id}", response_model=DeviceResponse, summary="Update Device")
def update_device(device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db)):
    """Update device metadata, mode, or connection state."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    
    if payload.display_name is not None:
        device.display_name = payload.display_name
    if payload.connection_mode is not None:
        device.connection_mode = payload.connection_mode
    if payload.firmware_version is not None:
        device.firmware_version = payload.firmware_version
    if payload.online_status is not None:
        device.online_status = payload.online_status
        if payload.online_status:
            device.last_seen_at = utc_now()

    db.commit()
    db.refresh(device)
    return device


@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Device")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Remove a device registration."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    db.delete(device)
    db.commit()
    return None


@router.get("/devices/{device_id}/config", response_model=DeviceConfigurationResponse, summary="Get Sensor Calibration Config")
def get_device_config(device_id: str, db: Session = Depends(get_db)):
    """Retrieve hardware sensor calibration parameters (ACS712, divider ratio, DHT offsets)."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")

    config = db.query(DeviceConfiguration).filter(DeviceConfiguration.device_id == device_id).first()
    if not config:
        config = DeviceConfiguration(
            device_id=device_id,
            voltage_divider_ratio=1.0,
            acs712_sensitivity_mv_per_a=185.0,
            acs712_zero_v_offset=2.50,
            temp_offset_c=0.0,
            humidity_offset_pct=0.0,
            dht_installed=True
        )
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


@router.put("/devices/{device_id}/config", response_model=DeviceConfigurationResponse, summary="Update Sensor Calibration Config")
def update_device_config(device_id: str, payload: DeviceConfigurationUpdate, db: Session = Depends(get_db)):
    """Update hardware calibration settings for current and voltage sensors."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")

    config = db.query(DeviceConfiguration).filter(DeviceConfiguration.device_id == device_id).first()
    if not config:
        config = DeviceConfiguration(device_id=device_id)
        db.add(config)

    if payload.voltage_divider_ratio is not None:
        config.voltage_divider_ratio = payload.voltage_divider_ratio
    if payload.acs712_sensitivity_mv_per_a is not None:
        config.acs712_sensitivity_mv_per_a = payload.acs712_sensitivity_mv_per_a
    if payload.acs712_zero_v_offset is not None:
        config.acs712_zero_v_offset = payload.acs712_zero_v_offset
    if payload.temp_offset_c is not None:
        config.temp_offset_c = payload.temp_offset_c
    if payload.humidity_offset_pct is not None:
        config.humidity_offset_pct = payload.humidity_offset_pct
    if payload.dht_installed is not None:
        config.dht_installed = payload.dht_installed

    config.updated_at = utc_now()
    db.commit()
    db.refresh(config)
    logger.info(f"Updated sensor calibration config for device {device_id}")
    return config


@router.post("/devices/bridge/connect", response_model=BridgeStatusResponse, summary="Connect Hardware Bridge")
def connect_bridge(payload: BridgeConnectRequest):
    """
    Connect to a local serial COM port directly from the application.
    Auto-detects ESP32 if port is not specified.
    """
    port = payload.port
    if not port or port.lower() in ("auto", ""):
        ports = hardware_bridge_service.list_ports()
        esp = next((p for p in ports if p.get("is_esp")), None)
        if esp:
            port = esp["device"]
        else:
            # Look for non-bluetooth port
            non_bt = next((p for p in ports if "bluetooth" not in p.get("description", "").lower() and "bthenum" not in p.get("hwid", "").lower()), None)
            if non_bt:
                port = non_bt["device"]
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No ESP32 or USB hardware port found. Please plug in your ESP32 board via USB data cable."
                )

    status_data = hardware_bridge_service.connect(
        port=port,
        baud=payload.baud,
        force_unlock=payload.force_unlock
    )
    if not status_data["connected"] and status_data["last_error"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=status_data["last_error"]
        )
    return BridgeStatusResponse(**status_data)


@router.post("/devices/bridge/disconnect", response_model=BridgeStatusResponse, summary="Disconnect Hardware Bridge")
def disconnect_bridge():
    """Disconnect the hardware bridge and release the COM port."""
    status_data = hardware_bridge_service.disconnect()
    return BridgeStatusResponse(**status_data)


@router.get("/devices/bridge/status", response_model=BridgeStatusResponse, summary="Hardware Bridge Status")
def get_bridge_status():
    """Query current connection state of the hardware bridge."""
    status_data = hardware_bridge_service.get_status()
    return BridgeStatusResponse(**status_data)

