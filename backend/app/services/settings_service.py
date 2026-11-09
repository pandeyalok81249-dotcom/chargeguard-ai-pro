"""Settings service for threshold overrides and hardware configuration."""

import json
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models import SystemSetting
from app.core.config import settings

DEFAULT_SETTINGS_KEY = "system_thresholds"

def get_current_settings(db: Session) -> Dict[str, Any]:
    """Retrieve settings from DB or fall back to application config defaults."""
    setting_row = db.query(SystemSetting).filter(SystemSetting.key == DEFAULT_SETTINGS_KEY).first()
    
    defaults = {
        "profile_voltage_nominal_v": settings.PROFILE_VOLTAGE_NOMINAL_V,
        "voltage_min_warning_v": settings.VOLTAGE_MIN_WARNING_V,
        "voltage_min_critical_v": settings.VOLTAGE_MIN_CRITICAL_V,
        "voltage_max_warning_v": settings.VOLTAGE_MAX_WARNING_V,
        "voltage_max_critical_v": settings.VOLTAGE_MAX_CRITICAL_V,
        "current_max_warning_a": settings.CURRENT_MAX_WARNING_A,
        "current_max_critical_a": settings.CURRENT_MAX_CRITICAL_A,
        "temperature_warning_c": settings.TEMPERATURE_WARNING_C,
        "temperature_critical_c": settings.TEMPERATURE_CRITICAL_C,
        "resistance_good_max_ohm": settings.RESISTANCE_GOOD_MAX_OHM,
        "resistance_warning_max_ohm": settings.RESISTANCE_WARNING_MAX_OHM,
        "default_connection_mode": "demo",
        "sampling_interval_ms": 1000,
        "serial_port": settings.DEFAULT_SERIAL_PORT,
        "baud_rate": settings.DEFAULT_BAUD_RATE,
        "min_samples_for_health_score": settings.MIN_SAMPLES_FOR_HEALTH_SCORE
    }
    
    if setting_row:
        try:
            persisted = json.loads(setting_row.value)
            defaults.update(persisted)
        except Exception:
            pass
            
    return defaults

def update_settings(db: Session, updates: Dict[str, Any]) -> Dict[str, Any]:
    """Update persisted settings."""
    current = get_current_settings(db)
    current.update({k: v for k, v in updates.items() if v is not None})
    
    setting_row = db.query(SystemSetting).filter(SystemSetting.key == DEFAULT_SETTINGS_KEY).first()
    if not setting_row:
        setting_row = SystemSetting(key=DEFAULT_SETTINGS_KEY, value=json.dumps(current))
        db.add(setting_row)
    else:
        setting_row.value = json.dumps(current)
        
    db.commit()
    db.refresh(setting_row)
    return current
