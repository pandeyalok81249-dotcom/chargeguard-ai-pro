"""Configuration settings for ChargeGuard AI Pro Backend."""

from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "ChargeGuard AI Pro"
    VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api"
    
    # Environment
    ENV: str = os.getenv("ENV", "development")
    DEBUG: bool = os.getenv("DEBUG", "true").lower() == "true"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./chargeguard.db")
    
    # CORS Origins (default localhost Vite and React dev servers)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    
    # Default Safety and Diagnostic Thresholds (5V Profile)
    PROFILE_VOLTAGE_NOMINAL_V: float = 5.0
    VOLTAGE_MIN_WARNING_V: float = 4.50
    VOLTAGE_MIN_CRITICAL_V: float = 4.20
    VOLTAGE_MAX_WARNING_V: float = 5.30
    VOLTAGE_MAX_CRITICAL_V: float = 5.60
    
    CURRENT_MAX_WARNING_A: float = 2.40
    CURRENT_MAX_CRITICAL_A: float = 3.00
    
    TEMPERATURE_WARNING_C: float = 42.0
    TEMPERATURE_CRITICAL_C: float = 50.0
    
    # Resistance Thresholds (Ohms)
    RESISTANCE_GOOD_MAX_OHM: float = 0.25
    RESISTANCE_WARNING_MAX_OHM: float = 0.60
    
    # Minimum valid samples for calculating a confident health score
    MIN_SAMPLES_FOR_HEALTH_SCORE: int = 5
    
    # Serial Defaults
    DEFAULT_SERIAL_PORT: str = "COM3"
    DEFAULT_BAUD_RATE: int = 115200

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
