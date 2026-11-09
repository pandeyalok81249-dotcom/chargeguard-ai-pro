"""Tests for User Authentication, Registration, and JWT Security."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_auth_registration_and_login():
    # 1. Register a test engineer
    reg_payload = {
        "username": "test_engineer_42",
        "email": "test_engineer_42@chargeguard.io",
        "full_name": "Test Engineer 42",
        "password": "SecurePassword123!",
        "role": "engineer"
    }
    res_reg = client.post("/api/auth/register", json=reg_payload)
    assert res_reg.status_code in (201, 409)

    # 2. Login with valid credentials
    login_payload = {
        "username": "test_engineer_42",
        "password": "SecurePassword123!"
    }
    res_login = client.post("/api/auth/login", json=login_payload)
    assert res_login.status_code == 200
    token_data = res_login.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    token = token_data["access_token"]

    # 3. Access protected /me profile endpoint
    res_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res_me.status_code == 200
    profile = res_me.json()
    assert profile["username"] == "test_engineer_42"
    assert profile["role"] == "engineer"

    # 4. Reject invalid login credentials
    bad_login = {
        "username": "test_engineer_42",
        "password": "WrongPassword!"
    }
    res_bad = client.post("/api/auth/login", json=bad_login)
    assert res_bad.status_code == 401


def test_auth_password_reset_flow():
    # 1. Request reset token
    res_req = client.post("/api/auth/forgot-password", json={"email": "admin@chargeguard.io"})
    assert res_req.status_code == 200
    data = res_req.json()
    assert "reset_token" in data
    token = data["reset_token"]

    # 2. Confirm reset
    confirm_payload = {
        "token": token,
        "new_password": "NewAdminPassword2026!"
    }
    res_conf = client.post("/api/auth/reset-password", json=confirm_payload)
    assert res_conf.status_code == 200
