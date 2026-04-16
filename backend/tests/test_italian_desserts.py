"""
Backend tests for Italian Desserts website
Tests: Auth, Products, Orders, Reviews, Contact, Admin endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_session(api_client):
    resp = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    # cookies set automatically
    return api_client

# --- Auth Tests ---
class TestAuth:
    def test_admin_login_success(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "admin@example.com"
        assert data["role"] == "admin"
        assert "token" in data

    def test_login_invalid_credentials(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "wrong@example.com", "password": "wrongpass"})
        assert resp.status_code == 401

    def test_get_me_with_token(self, api_client):
        # Login first
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        token = resp.json()["token"]
        me_resp = requests.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "admin@example.com"

# --- Product Tests ---
class TestProducts:
    def test_get_products_returns_10(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 10

    def test_get_products_filter_bomboloni(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products?category=bomboloni")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5
        assert all(p["category"] == "bomboloni" for p in data)

    def test_get_products_filter_tiramisu(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products?category=tiramisu")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 5

    def test_get_single_product(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products/tiramisu-classic")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "tiramisu-classic"
        assert "sizes" in data
        assert len(data["sizes"]) > 0

    def test_get_product_not_found(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products/nonexistent-product")
        assert resp.status_code == 404

    def test_featured_products(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/products?featured=true")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) > 0
        assert all(p["featured"] == True for p in data)

# --- Order Tests ---
class TestOrders:
    def test_create_order_cod(self, api_client):
        payload = {
            "items": [{"product_id": "bomboloni-classic", "name": "Classic Cream Bomboloni", "price": 180, "quantity": 2, "size": "Single"}],
            "customer_name": "TEST_Customer",
            "customer_email": "test@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "123 Test Street, Mumbai",
            "payment_method": "cod",
            "notes": ""
        }
        resp = api_client.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"].startswith("ORD-")
        assert data["status"] == "pending"
        assert data["payment_status"] == "cod"
        assert data["total"] == 360
        return data["id"]

    def test_create_order_calculates_total(self, api_client):
        payload = {
            "items": [
                {"product_id": "bomboloni-classic", "price": 200, "quantity": 3},
                {"product_id": "tiramisu-classic", "price": 450, "quantity": 1}
            ],
            "customer_name": "TEST_Total",
            "customer_email": "test@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "Test Address",
            "payment_method": "cod"
        }
        resp = api_client.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 200
        assert resp.json()["total"] == 1050

# --- Reviews Tests ---
class TestReviews:
    def test_get_reviews(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/reviews")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 5
        assert "customer_name" in data[0]
        assert "rating" in data[0]
        assert "comment" in data[0]

# --- Contact Tests ---
class TestContact:
    def test_submit_contact(self, api_client):
        payload = {
            "name": "TEST_User",
            "email": "testcontact@example.com",
            "subject": "Test Inquiry",
            "message": "This is a test message"
        }
        resp = api_client.post(f"{BASE_URL}/api/contact", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Message sent successfully"
        assert "id" in data

# --- Admin Tests ---
class TestAdmin:
    def test_admin_stats(self):
        # Login as admin
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        token = resp.json()["token"]
        stats_resp = session.get(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert stats_resp.status_code == 200
        data = stats_resp.json()
        assert "total_products" in data
        assert data["total_products"] == 10
        assert "total_orders" in data
        assert "total_revenue" in data

    def test_admin_get_orders(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        token = resp.json()["token"]
        orders_resp = session.get(f"{BASE_URL}/api/orders", headers={"Authorization": f"Bearer {token}"})
        assert orders_resp.status_code == 200
        assert isinstance(orders_resp.json(), list)

    def test_admin_get_contacts(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json={"email": "admin@example.com", "password": "admin123"})
        token = resp.json()["token"]
        contacts_resp = session.get(f"{BASE_URL}/api/admin/contacts", headers={"Authorization": f"Bearer {token}"})
        assert contacts_resp.status_code == 200
        assert isinstance(contacts_resp.json(), list)

    def test_orders_require_admin(self, api_client):
        fresh = requests.Session()
        resp = fresh.get(f"{BASE_URL}/api/orders")
        assert resp.status_code == 401

    def test_razorpay_not_configured(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/razorpay/config")
        assert resp.status_code == 200
        data = resp.json()
        assert data["enabled"] == False
