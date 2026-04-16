"""Tests for customer auth (register/login/me/logout) and my-orders endpoints"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = f"TEST_customer_{int(time.time())}@example.com"
TEST_PASSWORD = "test1234"
TEST_NAME = "Test Customer"


class TestAuthRegister:
    def test_register_new_customer(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL.lower().lower()
        assert data["role"] == "customer"
        assert "id" in data

    def test_register_duplicate_email(self):
        # Register same email again
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"name": TEST_NAME, "email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 400


class TestAuthLogin:
    def test_login_valid_customer(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL.lower().lower()
        assert data["role"] == "customer"
        assert "token" in data

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": "wrongpassword"})
        assert r.status_code == 401

    def test_login_admin(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"


class TestAuthMe:
    def test_auth_me_with_token(self):
        # Login first
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        data = r2.json()
        assert data["email"] == TEST_EMAIL.lower()

    def test_auth_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


class TestMyOrders:
    def test_my_orders_authenticated(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        token = r.json()["token"]
        r2 = requests.get(f"{BASE_URL}/api/my-orders", headers={"Authorization": f"Bearer {token}"})
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_my_orders_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/my-orders")
        assert r.status_code == 401
