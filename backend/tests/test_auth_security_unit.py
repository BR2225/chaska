import os
import sys
import asyncio
from pathlib import Path
from types import SimpleNamespace

import bcrypt
import pytest
from pydantic import ValidationError

os.environ["MONGODB_URI"] = "mongodb://127.0.0.1:27017"
os.environ["DB_NAME"] = "chaska_auth_unit_tests"
os.environ["APP_ENV"] = "test"
os.environ["JWT_SECRET"] = "unit-test-jwt-secret-that-is-long-enough"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import server


def test_database_client_uses_pymongo_async_driver():
    assert isinstance(server.client, server.AsyncMongoClient)


@pytest.mark.parametrize(
    ("raw", "identity_type", "normalized"),
    [
        (" Customer@Example.COM ", "email", "customer@example.com"),
        ("9876543210", "phone", "+919876543210"),
        ("+44 7700 900123", "phone", "+447700900123"),
    ],
)
def test_normalize_identity(raw, identity_type, normalized):
    assert server.normalize_identity(raw) == (identity_type, normalized)


@pytest.mark.parametrize(
    "password",
    ["short1", "onlyletters", "12345678", "Password1"],
)
def test_password_policy_rejects_weak_passwords(password):
    with pytest.raises(ValueError):
        server.validate_new_password(password, "Test Customer", "test@example.com")


def test_argon2id_hash_and_verify():
    password_hash = server.hash_password("CorrectHorse42")
    assert password_hash.startswith("$argon2id$")
    assert server.verify_password("CorrectHorse42", password_hash) == (True, False)
    assert server.verify_password("WrongHorse42", password_hash)[0] is False


def test_legacy_bcrypt_hash_requests_upgrade():
    legacy_hash = bcrypt.hashpw(b"LegacyPass42", bcrypt.gensalt()).decode("utf-8")
    assert server.verify_password("LegacyPass42", legacy_hash) == (True, True)


def test_access_token_rejects_wrong_type():
    refresh_jti = "refresh-jti"
    refresh_token = server.create_refresh_token("user-id", "session-id", 1, refresh_jti)
    with pytest.raises(server.jwt.InvalidTokenError):
        server.decode_token(refresh_token, "access")


def test_review_submission_normalizes_customer_text():
    review = server.ReviewCreate(
        customer_name="  Test   Customer  ",
        email="Customer@Example.com",
        rating=5,
        comment="  The pistachio bomboloni   were wonderful.  ",
    )
    assert review.customer_name == "Test Customer"
    assert str(review.email) == "Customer@example.com"
    assert review.comment == "The pistachio bomboloni were wonderful."


@pytest.mark.parametrize(
    "payload",
    [
        {"customer_name": "T", "email": "test@example.com", "rating": 5, "comment": "A genuinely lovely dessert."},
        {"customer_name": "Test", "email": "not-an-email", "rating": 5, "comment": "A genuinely lovely dessert."},
        {"customer_name": "Test", "email": "test@example.com", "rating": 0, "comment": "A genuinely lovely dessert."},
        {"customer_name": "Test", "email": "test@example.com", "rating": 5, "comment": "Too short"},
    ],
)
def test_review_submission_rejects_invalid_input(payload):
    with pytest.raises(ValidationError):
        server.ReviewCreate(**payload)


def test_review_submission_is_private_and_pending(monkeypatch):
    inserted = []

    class FakeReviews:
        async def insert_one(self, document):
            inserted.append(document.copy())

    async def skip_rate_limit(*_args):
        return None

    monkeypatch.setattr(server, "db", SimpleNamespace(reviews=FakeReviews()))
    monkeypatch.setattr(server, "enforce_rate_limit", skip_rate_limit)
    request = SimpleNamespace(client=SimpleNamespace(host="127.0.0.1"), headers={})
    review = server.ReviewCreate(
        customer_name="Test Customer",
        email="CUSTOMER@example.com",
        rating=5,
        comment="The classic tiramisu was excellent.",
    )

    response = asyncio.run(server.create_review(review, request))

    assert response["message"].endswith("submitted for approval.")
    assert "email" not in response
    assert inserted[0]["email"] == "customer@example.com"
    assert inserted[0]["status"] == "pending"
    assert inserted[0]["source"] == "website"


def test_customer_guard_accepts_only_customer_role(monkeypatch):
    async def customer_user(_request):
        return {"id": "customer-id", "role": "customer"}

    monkeypatch.setattr(server, "get_current_user", customer_user)
    user = asyncio.run(server.require_customer(SimpleNamespace()))
    assert user["id"] == "customer-id"


def test_customer_guard_rejects_admin_role(monkeypatch):
    async def admin_user(_request):
        return {"id": "admin-id", "role": "admin"}

    monkeypatch.setattr(server, "get_current_user", admin_user)
    with pytest.raises(server.HTTPException) as error:
        asyncio.run(server.require_customer(SimpleNamespace()))
    assert error.value.status_code == 403


def test_order_creation_rejects_anonymous_request_before_database_lookup():
    request = SimpleNamespace(cookies={}, headers={})
    order = server.OrderCreate(
        items=[{"product_id": "bomboloni-classic", "size": "Single", "quantity": 1}],
        customer_name="Guest Customer",
        customer_email="guest@example.com",
        customer_phone="9876543210",
        delivery_address="123 Test Street, Mumbai",
        payment_method="cod",
    )

    with pytest.raises(server.HTTPException) as error:
        asyncio.run(server.create_order(order, request))
    assert error.value.status_code == 401


def test_contact_submission_rejects_anonymous_request_before_database_write():
    request = SimpleNamespace(cookies={}, headers={})
    contact = server.ContactCreate(
        name="Guest Customer",
        email="guest@example.com",
        subject="Question",
        message="I have a question about an order.",
    )

    with pytest.raises(server.HTTPException) as error:
        asyncio.run(server.submit_contact(contact, request))
    assert error.value.status_code == 401


def test_razorpay_capture_must_match_order_amount_currency_and_id():
    order = {
        "id": "ORD-TEST",
        "total": 180.0,
        "razorpay_order_id": "order_test123",
    }
    payment = {
        "id": "pay_test123",
        "status": "captured",
        "order_id": "order_test123",
        "currency": "INR",
        "amount": 18000,
    }

    assert server.razorpay_payment_matches_order(payment, order) is True


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("status", "authorized"),
        ("order_id", "order_other"),
        ("currency", "USD"),
        ("amount", 17900),
    ],
)
def test_razorpay_capture_rejects_mismatched_facts(field, value):
    order = {
        "id": "ORD-TEST",
        "total": 180.0,
        "razorpay_order_id": "order_test123",
    }
    payment = {
        "id": "pay_test123",
        "status": "captured",
        "order_id": "order_test123",
        "currency": "INR",
        "amount": 18000,
    }
    payment[field] = value

    assert server.razorpay_payment_matches_order(payment, order) is False
