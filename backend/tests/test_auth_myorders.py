"""Tests for customer auth (register/login/me/logout) and my-orders endpoints"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("BACKEND_TEST_URL", os.environ.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
pytestmark = pytest.mark.skipif(not BASE_URL, reason="BACKEND_TEST_URL is not configured")
TEST_EMAIL = f"TEST_customer_{int(time.time())}@example.com"
TEST_PHONE = f"+9198{int(time.time()) % 100000000:08d}"
TEST_PASSWORD = "Testpass123"
TEST_NAME = "Test Customer"


class TestAuthRegister:
    def test_register_new_customer(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"full_name": TEST_NAME, "identifier": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == TEST_EMAIL.lower().lower()
        assert data["role"] == "customer"
        assert "id" in data

    def test_register_duplicate_email(self):
        # Register same email again
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"full_name": TEST_NAME, "identifier": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 409

    @pytest.mark.parametrize("password", ["short1", "onlyletters"])
    def test_rejects_weak_passwords(self, password):
        email = f"weak-{password}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"full_name": TEST_NAME, "identifier": email, "password": password})
        assert r.status_code == 422

    def test_register_with_phone(self):
        r = requests.post(f"{BASE_URL}/api/auth/register", json={"full_name": TEST_NAME, "identifier": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 201
        assert r.json()["phone"] == TEST_PHONE
        assert r.json()["email"] is None


class TestAuthLogin:
    def test_login_valid_customer(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == TEST_EMAIL.lower().lower()
        assert data["role"] == "customer"
        assert "token" not in data
        assert "access_token" in r.cookies

    def test_login_invalid_credentials(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": TEST_EMAIL, "password": "wrongpassword"})
        assert r.status_code == 401

    def test_login_valid_phone(self):
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": TEST_PHONE, "password": TEST_PASSWORD})
        assert r.status_code == 200
        assert r.json()["phone"] == TEST_PHONE

    def test_login_admin(self):
        admin_email = os.environ.get("ADMIN_EMAIL")
        admin_password = os.environ.get("ADMIN_PASSWORD")
        if not admin_email or not admin_password:
            pytest.skip("Admin credentials not configured")
        r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": admin_email, "password": admin_password})
        assert r.status_code == 200
        data = r.json()
        assert data["role"] == "admin"


class TestAuthMe:
    def test_auth_me_with_token(self):
        session = requests.Session()
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        r2 = session.get(f"{BASE_URL}/api/auth/me")
        assert r2.status_code == 200
        data = r2.json()
        assert data["email"] == TEST_EMAIL.lower()

    def test_auth_me_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


class TestRefreshRotation:
    def test_refresh_rotates_and_rejects_replay(self):
        session = requests.Session()
        login_response = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD},
        )
        assert login_response.status_code == 200
        old_refresh = session.cookies.get("refresh_token")
        refresh_response = session.post(f"{BASE_URL}/api/auth/refresh")
        assert refresh_response.status_code == 200
        assert session.cookies.get("refresh_token") != old_refresh

        replay = requests.Session()
        replay.cookies.set("refresh_token", old_refresh)
        replay_response = replay.post(f"{BASE_URL}/api/auth/refresh")
        assert replay_response.status_code == 401


class TestMyOrders:
    def test_my_orders_authenticated(self):
        session = requests.Session()
        r = session.post(f"{BASE_URL}/api/auth/login", json={"identifier": TEST_EMAIL, "password": TEST_PASSWORD})
        assert r.status_code == 200
        r2 = session.get(f"{BASE_URL}/api/my-orders")
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)

    def test_my_orders_unauthenticated(self):
        r = requests.get(f"{BASE_URL}/api/my-orders")
        assert r.status_code == 401
