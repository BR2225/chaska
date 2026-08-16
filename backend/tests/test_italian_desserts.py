"""
Backend tests for Italian Desserts website
Tests: Auth, Products, Orders, Reviews, Contact, Admin endpoints
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get("BACKEND_TEST_URL", os.environ.get("REACT_APP_BACKEND_URL", "")).rstrip("/")
pytestmark = pytest.mark.skipif(not BASE_URL, reason="BACKEND_TEST_URL is not configured")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
CUSTOMER_EMAIL = f"order-customer-{int(time.time())}@example.com"
CUSTOMER_PASSWORD = "OrderTest42"

def admin_credentials():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        pytest.skip("Admin credentials not configured")
    return {"identifier": ADMIN_EMAIL, "password": ADMIN_PASSWORD}

@pytest.fixture(scope="module")
def api_client():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

@pytest.fixture(scope="module")
def admin_session(api_client):
    resp = api_client.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
    assert resp.status_code == 200, f"Admin login failed: {resp.text}"
    # cookies set automatically
    return api_client

@pytest.fixture(scope="module")
def customer_session():
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    resp = session.post(
        f"{BASE_URL}/api/auth/register",
        json={
            "full_name": "Order Test Customer",
            "identifier": CUSTOMER_EMAIL,
            "password": CUSTOMER_PASSWORD,
        },
    )
    if resp.status_code == 409:
        resp = session.post(
            f"{BASE_URL}/api/auth/login",
            json={"identifier": CUSTOMER_EMAIL, "password": CUSTOMER_PASSWORD},
        )
        assert resp.status_code == 200, f"Customer login failed: {resp.text}"
    else:
        assert resp.status_code == 201, f"Customer registration failed: {resp.text}"
    return session

# --- Auth Tests ---
class TestAuth:
    def test_admin_login_success(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == ADMIN_EMAIL.lower()
        assert data["role"] == "admin"
        assert "token" not in data
        assert "access_token" in resp.cookies

    def test_login_invalid_credentials(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json={"identifier": "wrong@example.com", "password": "wrongpass"})
        assert resp.status_code == 401

    def test_get_me_with_token(self, api_client):
        resp = api_client.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
        assert resp.status_code == 200
        me_resp = api_client.get(f"{BASE_URL}/api/auth/me")
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == ADMIN_EMAIL.lower()

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
    def test_create_order_requires_customer_login(self, api_client):
        payload = {
            "items": [{"product_id": "bomboloni-classic", "quantity": 1, "size": "Single"}],
            "customer_name": "Guest Customer",
            "customer_email": "guest@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "123 Test Street, Mumbai",
            "payment_method": "cod",
        }
        resp = api_client.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 401

    def test_create_order_cod(self, customer_session):
        payload = {
            "items": [{"product_id": "bomboloni-classic", "quantity": 2, "size": "Single"}],
            "customer_name": "TEST_Customer",
            "customer_email": "test@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "123 Test Street, Mumbai",
            "payment_method": "cod",
            "notes": ""
        }
        resp = customer_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"].startswith("ORD-")
        assert data["status"] == "pending"
        assert data["payment_status"] == "cod"
        assert data["total"] == 360
        return data["id"]

    def test_create_order_calculates_total(self, customer_session):
        payload = {
            "items": [
                {"product_id": "bomboloni-classic", "size": "Single", "quantity": 3},
                {"product_id": "tiramisu-classic", "size": "Individual", "quantity": 1}
            ],
            "customer_name": "TEST_Total",
            "customer_email": "test@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "Test Address",
            "payment_method": "cod"
        }
        resp = customer_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 200
        assert resp.json()["total"] == 990

    def test_create_order_rejects_client_price(self, customer_session):
        payload = {
            "items": [{"product_id": "bomboloni-classic", "size": "Single", "quantity": 1, "price": 1}],
            "customer_name": "TEST_Tamper",
            "customer_email": "test@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "Test Address",
            "payment_method": "cod"
        }
        resp = customer_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert resp.status_code == 422

    def test_tracking_requires_token(self, customer_session):
        payload = {
            "items": [{"product_id": "bomboloni-classic", "size": "Single", "quantity": 1}],
            "customer_name": "TEST_Tracking",
            "customer_email": "tracking@example.com",
            "customer_phone": "9876543210",
            "delivery_address": "Test Address",
            "payment_method": "cod"
        }
        created = customer_session.post(f"{BASE_URL}/api/orders", json=payload)
        assert created.status_code == 200
        order = created.json()
        denied = requests.get(f"{BASE_URL}/api/tracking/orders/{order['id']}")
        assert denied.status_code == 404
        tracked = requests.get(
            f"{BASE_URL}/api/tracking/orders/{order['id']}",
            params={"token": order["tracking_token"]},
        )
        assert tracked.status_code == 200
        assert "delivery_address" not in tracked.json()

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
        assert "source" in data[0]
        assert "email" not in data[0]

# --- Contact Tests ---
class TestContact:
    def test_submit_contact(self, customer_session):
        payload = {
            "name": "TEST_User",
            "email": "testcontact@example.com",
            "subject": "Test Inquiry",
            "message": "This is a test message"
        }
        resp = customer_session.post(f"{BASE_URL}/api/contact", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["message"] == "Message sent successfully"
        assert "id" in data

# --- Admin Tests ---
class TestAdmin:
    def test_admin_stats(self):
        # Login as admin
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
        assert resp.status_code == 200
        stats_resp = session.get(f"{BASE_URL}/api/admin/stats")
        assert stats_resp.status_code == 200
        data = stats_resp.json()
        assert "total_products" in data
        assert data["total_products"] == 10
        assert "total_orders" in data
        assert "total_revenue" in data

    def test_admin_get_orders(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
        assert resp.status_code == 200
        orders_resp = session.get(f"{BASE_URL}/api/orders")
        assert orders_resp.status_code == 200
        assert isinstance(orders_resp.json(), list)

    def test_admin_get_contacts(self):
        session = requests.Session()
        resp = session.post(f"{BASE_URL}/api/auth/login", json=admin_credentials())
        assert resp.status_code == 200
        contacts_resp = session.get(f"{BASE_URL}/api/admin/contacts")
        assert contacts_resp.status_code == 200
        assert isinstance(contacts_resp.json(), list)

    def test_orders_require_admin(self, api_client):
        fresh = requests.Session()
        resp = fresh.get(f"{BASE_URL}/api/orders")
        assert resp.status_code == 401

    def test_razorpay_configuration_shape(self, api_client):
        resp = api_client.get(f"{BASE_URL}/api/razorpay/config")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data["enabled"], bool)
        if data["enabled"]:
            assert data["key_id"].startswith(("rzp_test_", "rzp_live_"))
        else:
            assert data["key_id"] == ""
