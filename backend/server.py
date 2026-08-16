from dotenv import load_dotenv
from pathlib import Path
from contextlib import asynccontextmanager

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.concurrency import run_in_threadpool
from bson import ObjectId
from bson.errors import InvalidId
from pymongo import AsyncMongoClient, ReturnDocument
from pymongo.errors import DuplicateKeyError
import os
import logging
import bcrypt
import jwt
import secrets
import razorpay
import hashlib
import hmac
import json
import re
import unicodedata
import ipaddress
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError, VerificationError
from decimal import Decimal, ROUND_HALF_UP
from enum import Enum
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime, timezone, timedelta

# MongoDB connection
mongodb_uri = os.environ["MONGODB_URI"]
client = AsyncMongoClient(mongodb_uri, tz_aware=True)
db = client[os.environ['DB_NAME']]

# Runtime/security config
APP_ENV = os.environ.get("APP_ENV", "development").lower()
if APP_ENV not in {"development", "test", "production"}:
    raise RuntimeError("APP_ENV must be development, test, or production")
IS_PRODUCTION = APP_ENV == "production"

# JWT config
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET:
    if IS_PRODUCTION:
        raise RuntimeError("JWT_SECRET is required in production")
    JWT_SECRET = "chaska-local-development-secret-change-me"
if IS_PRODUCTION and len(JWT_SECRET) < 32:
    raise RuntimeError("JWT_SECRET must contain at least 32 characters in production")
JWT_ISSUER = os.environ.get("JWT_ISSUER", "chaska-api")
JWT_AUDIENCE = os.environ.get("JWT_AUDIENCE", "chaska-web")
ACCESS_TOKEN_MINUTES = int(os.environ.get("ACCESS_TOKEN_MINUTES", "15"))
REFRESH_TOKEN_DAYS = int(os.environ.get("REFRESH_TOKEN_DAYS", "7"))
MAX_ACTIVE_SESSIONS = int(os.environ.get("MAX_ACTIVE_SESSIONS", "5"))
LOGIN_MAX_FAILURES = int(os.environ.get("LOGIN_MAX_FAILURES", "5"))
LOGIN_LOCK_MINUTES = int(os.environ.get("LOGIN_LOCK_MINUTES", "15"))
TRUST_PROXY_HEADERS = os.environ.get("TRUST_PROXY_HEADERS", "false").lower() == "true"
ALLOWED_HOSTS = [
    host.strip()
    for host in os.environ.get("ALLOWED_HOSTS", "").split(",")
    if host.strip()
]
if IS_PRODUCTION and not ALLOWED_HOSTS:
    raise RuntimeError("ALLOWED_HOSTS is required in production")

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")
if bool(ADMIN_EMAIL) != bool(ADMIN_PASSWORD):
    raise RuntimeError("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together")
if ADMIN_EMAIL:
    ADMIN_EMAIL = ADMIN_EMAIL.lower().strip()

COOKIE_SECURE = IS_PRODUCTION
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").lower()
if COOKIE_SAMESITE not in {"lax", "strict", "none"}:
    raise RuntimeError("COOKIE_SAMESITE must be lax, strict, or none")
if COOKIE_SAMESITE == "none" and not COOKIE_SECURE:
    raise RuntimeError("COOKIE_SAMESITE=none requires APP_ENV=production")
CORS_ORIGINS_RAW = os.environ.get("CORS_ORIGINS")
if IS_PRODUCTION and not CORS_ORIGINS_RAW:
    raise RuntimeError("CORS_ORIGINS is required in production")
CORS_ORIGINS = [
    origin.strip()
    for origin in (CORS_ORIGINS_RAW or "http://localhost:3000").split(",")
    if origin.strip()
]

# Razorpay
razorpay_key_id = os.environ.get("RAZORPAY_KEY_ID", "")
razorpay_key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
razorpay_webhook_secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET", "")
razorpay_client = None
if bool(razorpay_key_id) != bool(razorpay_key_secret):
    raise RuntimeError("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be configured together")
if razorpay_key_id and razorpay_key_secret:
    if not razorpay_key_id.startswith(("rzp_test_", "rzp_live_")):
        raise RuntimeError("RAZORPAY_KEY_ID has an invalid prefix")
    if IS_PRODUCTION and not razorpay_key_id.startswith("rzp_live_"):
        raise RuntimeError("Production requires a Razorpay live-mode key")
    if IS_PRODUCTION and not razorpay_webhook_secret:
        raise RuntimeError("RAZORPAY_WEBHOOK_SECRET is required when Razorpay is enabled in production")
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))

api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Password Hashing ---
PASSWORD_HASHER = PasswordHasher(
    time_cost=2,
    memory_cost=19456,
    parallelism=1,
    hash_len=32,
    salt_len=16,
)
COMMON_PASSWORDS = {
    "12345678", "123456789", "1234567890", "qwerty123", "password1",
    "password123", "admin123", "letmein123", "welcome123", "iloveyou1",
    "abc12345", "chaska123", "chaskacafe", "passw0rd", "11111111",
}

def hash_password(password: str) -> str:
    return PASSWORD_HASHER.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> tuple[bool, bool]:
    """Return (valid, needs_argon2_rehash), supporting legacy bcrypt hashes."""
    if hashed_password.startswith("$argon2"):
        try:
            valid = PASSWORD_HASHER.verify(hashed_password, plain_password)
            return valid, valid and PASSWORD_HASHER.check_needs_rehash(hashed_password)
        except (VerifyMismatchError, VerificationError, InvalidHashError):
            return False, False
    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            valid = bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
            return valid, valid
        except (ValueError, TypeError):
            return False, False
    return False, False

DUMMY_PASSWORD_HASH = hash_password("not-a-real-user-password-7391")

def validate_new_password(password: str, name: str, identifier: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    if len(password) > 128:
        raise ValueError("Password must not exceed 128 characters")
    if not any(character.isalpha() for character in password):
        raise ValueError("Password must contain at least one letter")
    if not any(character.isdigit() for character in password):
        raise ValueError("Password must contain at least one number")
    folded = password.casefold()
    if folded in COMMON_PASSWORDS:
        raise ValueError("Choose a less common password")
    contextual_terms = {
        "chaska",
        identifier.split("@", 1)[0].casefold(),
        *(part.casefold() for part in name.split() if len(part) >= 4),
    }
    if any(term and len(term) >= 4 and folded == term for term in contextual_terms):
        raise ValueError("Password is too easy to guess")
    return password

def normalize_identity(value: str) -> tuple[str, str]:
    identity = unicodedata.normalize("NFKC", value).strip()
    if "@" in identity:
        from pydantic import TypeAdapter
        email = str(TypeAdapter(EmailStr).validate_python(identity)).lower()
        return "email", email

    compact_phone = re.sub(r"[\s().-]", "", identity)
    if re.fullmatch(r"[6-9]\d{9}", compact_phone):
        compact_phone = f"+91{compact_phone}"
    if not re.fullmatch(r"\+[1-9]\d{7,14}", compact_phone):
        raise ValueError("Enter a valid email address or phone number")
    return "phone", compact_phone

def normalize_full_name(value: str) -> str:
    name = " ".join(unicodedata.normalize("NFKC", value).split())
    if len(name) < 2 or len(name) > 120 or any(unicodedata.category(char).startswith("C") for char in name):
        raise ValueError("Enter a valid full name")
    return name

# --- JWT ---
def create_access_token(user_id: str, session_id: str, auth_version: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id, "sid": session_id, "ver": auth_version,
        "jti": secrets.token_urlsafe(16), "type": "access",
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        "iat": now, "nbf": now, "exp": now + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str, session_id: str, auth_version: int, refresh_jti: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id, "sid": session_id, "ver": auth_version,
        "jti": refresh_jti, "type": "refresh",
        "iss": JWT_ISSUER, "aud": JWT_AUDIENCE,
        "iat": now, "nbf": now, "exp": now + timedelta(days=REFRESH_TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str, expected_type: str, verify_expiration: bool = True) -> dict:
    payload = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALGORITHM],
        issuer=JWT_ISSUER,
        audience=JWT_AUDIENCE,
        options={"verify_exp": verify_expiration},
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError("Invalid token type")
    return payload

def public_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user.get("name", ""),
        "email": user.get("email"),
        "phone": user.get("phone"),
        "role": user.get("role", "customer"),
    }

async def create_session(user: dict, request: Request) -> tuple[str, str]:
    now = datetime.now(timezone.utc)
    session_id = secrets.token_urlsafe(24)
    refresh_jti = secrets.token_urlsafe(32)
    user_id = str(user["_id"])
    auth_version = user.get("auth_version", 1)
    await db.sessions.insert_one({
        "id": session_id,
        "user_id": user_id,
        "refresh_jti_hash": hashlib.sha256(refresh_jti.encode("utf-8")).hexdigest(),
        "created_at": now,
        "last_used_at": now,
        "expires_at": now + timedelta(days=REFRESH_TOKEN_DAYS),
        "user_agent_hash": hashlib.sha256(request.headers.get("User-Agent", "").encode("utf-8")).hexdigest(),
    })
    active_sessions = await db.sessions.find(
        {"user_id": user_id, "revoked_at": {"$exists": False}},
        {"_id": 1},
    ).sort("created_at", -1).skip(MAX_ACTIVE_SESSIONS).to_list(100)
    if active_sessions:
        await db.sessions.update_many(
            {"_id": {"$in": [session["_id"] for session in active_sessions]}},
            {"$set": {"revoked_at": now}},
        )
    return (
        create_access_token(user_id, session_id, auth_version),
        create_refresh_token(user_id, session_id, auth_version, refresh_jti),
    )

# --- Auth Helper ---
async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token, "access")
        now = datetime.now(timezone.utc)
        session = await db.sessions.find_one({
            "id": payload["sid"],
            "user_id": payload["sub"],
            "revoked_at": {"$exists": False},
            "expires_at": {"$gt": now},
        })
        if not session:
            raise HTTPException(status_code=401, detail="Session expired")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or user.get("auth_version", 1) != payload.get("ver"):
            raise HTTPException(status_code=401, detail="User not found")
        return public_user(user)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except (InvalidId, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_optional_current_user(request: Request) -> Optional[dict]:
    if not request.cookies.get("access_token") and not request.headers.get("Authorization"):
        return None
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def require_customer(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "customer":
        raise HTTPException(status_code=403, detail="Customer account required")
    return user

def request_ip(request: Request) -> str:
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("CF-Connecting-IP") or request.headers.get("X-Forwarded-For", "").split(",")[0]
        if forwarded:
            try:
                return str(ipaddress.ip_address(forwarded.strip()))
            except ValueError:
                pass
    return request.client.host if request.client else "unknown"

async def enforce_rate_limit(scope: str, key: str, limit: int, window_seconds: int):
    now = datetime.now(timezone.utc)
    bucket = int(now.timestamp()) // window_seconds
    document_id = hashlib.sha256(f"{scope}:{key}:{bucket}".encode("utf-8")).hexdigest()
    attempt = await db.auth_rate_limits.find_one_and_update(
        {"_id": document_id},
        {
            "$inc": {"count": 1},
            "$setOnInsert": {
                "scope": scope,
                "expires_at": now + timedelta(seconds=window_seconds * 2),
            },
        },
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )
    if attempt["count"] > limit:
        retry_after = window_seconds - (int(now.timestamp()) % window_seconds)
        raise HTTPException(
            status_code=429,
            detail="Too many attempts. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

# --- Pydantic Models ---
class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

class PaymentMethod(str, Enum):
    cod = "cod"
    razorpay = "razorpay"

class OrderStatus(str, Enum):
    pending = "pending"
    payment_pending = "payment_pending"
    confirmed = "confirmed"
    preparing = "preparing"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    cancelled = "cancelled"

class LoginRequest(StrictModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)

    @field_validator("identifier")
    @classmethod
    def identity_must_be_valid(cls, value):
        normalize_identity(value)
        return value

class RegisterRequest(StrictModel):
    full_name: str = Field(min_length=2, max_length=120)
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("full_name")
    @classmethod
    def full_name_must_be_valid(cls, value):
        return normalize_full_name(value)

    @field_validator("identifier")
    @classmethod
    def identity_must_be_valid(cls, value):
        normalize_identity(value)
        return value

    @field_validator("password")
    @classmethod
    def password_must_be_strong(cls, value):
        return validate_new_password(value, "", "")

class ProductSize(StrictModel):
    name: str = Field(min_length=1, max_length=100)
    price: float = Field(gt=0)

class ProductCreate(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(pattern=r"^(bomboloni|tiramisu)$")
    description: str = Field(min_length=1, max_length=2000)
    price: float = Field(gt=0)
    image: str = Field(default="", max_length=2000)
    sizes: List[ProductSize] = Field(min_length=1)
    is_available: bool = True
    featured: bool = False

class OrderItemIn(StrictModel):
    product_id: str = Field(min_length=1, max_length=100)
    size: str = Field(min_length=1, max_length=100)
    quantity: int = Field(ge=1, le=50)

class OrderCreate(StrictModel):
    items: List[OrderItemIn] = Field(min_length=1, max_length=50)
    customer_name: str = Field(min_length=1, max_length=120)
    customer_email: Optional[EmailStr] = None
    customer_phone: str = Field(pattern=r"^[6-9]\d{9}$")
    delivery_address: str = Field(min_length=5, max_length=500)
    payment_method: PaymentMethod = PaymentMethod.cod
    notes: str = Field(default="", max_length=1000)

    @field_validator("customer_email", mode="before")
    @classmethod
    def empty_email_is_none(cls, value):
        return None if value == "" else value

class ReviewCreate(StrictModel):
    customer_name: str = Field(min_length=2, max_length=120)
    email: EmailStr = Field(max_length=320)
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=10, max_length=1000)
    product_id: Optional[str] = Field(default=None, max_length=100)

    @field_validator("customer_name", "comment")
    @classmethod
    def normalize_review_text(cls, value: str) -> str:
        normalized = " ".join(value.split())
        if not normalized:
            raise ValueError("Field cannot be blank")
        return normalized

class ContactCreate(StrictModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=1, max_length=200)
    message: str = Field(min_length=1, max_length=3000)

class OrderStatusUpdate(StrictModel):
    status: OrderStatus

class RazorpayOrderRequest(StrictModel):
    payment_token: Optional[str] = None

class PaymentVerify(StrictModel):
    order_id: str
    payment_token: Optional[str] = None
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    cookie_options = {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "path": "/",
    }
    response.set_cookie("access_token", access_token, max_age=ACCESS_TOKEN_MINUTES * 60, **cookie_options)
    response.set_cookie("refresh_token", refresh_token, max_age=REFRESH_TOKEN_DAYS * 86400, **cookie_options)
    response.headers["Cache-Control"] = "no-store"

def hash_capability_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def payment_token_matches(order: dict, token: Optional[str]) -> bool:
    if not token or not order.get("payment_token_hash"):
        return False
    return hmac.compare_digest(order["payment_token_hash"], hash_capability_token(token))

async def can_manage_order(request: Request, order: dict, payment_token: Optional[str] = None) -> bool:
    user = await get_optional_current_user(request)
    if user:
        if user.get("role") == "admin" or order.get("user_id") == user["id"]:
            return True
        if order.get("customer_email") and order["customer_email"] == user.get("email"):
            return True
    return payment_token_matches(order, payment_token)

def order_total_in_paise(order: dict) -> int:
    return int(
        (Decimal(str(order["total"])) * 100).quantize(
            Decimal("1"),
            rounding=ROUND_HALF_UP,
        )
    )

def razorpay_payment_matches_order(payment: dict, order: dict) -> bool:
    """Validate the immutable payment facts before confirming fulfilment."""
    return bool(
        payment.get("id")
        and payment.get("status") == "captured"
        and payment.get("order_id") == order.get("razorpay_order_id")
        and payment.get("currency") == "INR"
        and payment.get("amount") == order_total_in_paise(order)
    )

async def mark_order_paid(order: dict, payment: dict) -> bool:
    """Atomically move one order to paid and prevent payment ID reuse."""
    now = datetime.now(timezone.utc)
    result = await db.orders.update_one(
        {"id": order["id"], "payment_status": {"$ne": "paid"}},
        {"$set": {
            "payment_status": "paid",
            "status": "confirmed",
            "razorpay_payment_id": payment["id"],
            "paid_at": now,
            "updated_at": now,
        }},
    )
    if result.modified_count:
        confirmed = await db.orders.find_one({"id": order["id"]}, {"_id": 0})
        send_order_confirmation_email(confirmed)
        return True
    return False

# --- Auth Routes ---
@api_router.post("/auth/register")
async def register(req: RegisterRequest, response: Response, request: Request):
    await enforce_rate_limit("register-ip", request_ip(request), 5, 3600)
    identity_type, identity = normalize_identity(req.identifier)
    await enforce_rate_limit("register-identity", identity, 3, 3600)
    existing = await db.users.find_one({identity_type: identity})
    if existing:
        raise HTTPException(status_code=409, detail="Unable to create account with those details")
    try:
        validate_new_password(req.password, req.full_name, identity)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))
    hashed = await run_in_threadpool(hash_password, req.password)
    user_doc = {
        identity_type: identity,
        "password_hash": hashed,
        "name": req.full_name,
        "role": "customer",
        "auth_version": 1,
        "failed_login_count": 0,
        "created_at": datetime.now(timezone.utc),
    }
    try:
        result = await db.users.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=409, detail="Unable to create account with those details")
    user_doc["_id"] = result.inserted_id
    access_token, refresh_token = await create_session(user_doc, request)
    set_auth_cookies(response, access_token, refresh_token)
    response.status_code = 201
    return public_user(user_doc)

@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response, request: Request):
    identity_type, identity = normalize_identity(req.identifier)
    ip_address = request_ip(request)
    await enforce_rate_limit("login-ip", ip_address, 50, 900)
    await enforce_rate_limit("login-pair", f"{ip_address}:{identity}", 10, 900)
    user = await db.users.find_one({identity_type: identity})
    now = datetime.now(timezone.utc)
    locked = bool(user and user.get("locked_until") and user["locked_until"] > now)
    password_hash = DUMMY_PASSWORD_HASH if not user or locked else user.get("password_hash", DUMMY_PASSWORD_HASH)
    valid, needs_rehash = await run_in_threadpool(verify_password, req.password, password_hash)
    if not user or locked or not valid:
        if user and not locked:
            failed_user = await db.users.find_one_and_update(
                {"_id": user["_id"]},
                {"$inc": {"failed_login_count": 1}, "$set": {"last_failed_login_at": now}},
                return_document=ReturnDocument.AFTER,
            )
            if failed_user and failed_user.get("failed_login_count", 0) >= LOGIN_MAX_FAILURES:
                await db.users.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"locked_until": now + timedelta(minutes=LOGIN_LOCK_MINUTES)}},
                )
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    updates = {
        "failed_login_count": 0,
        "last_login_at": now,
        "auth_version": user.get("auth_version", 1),
    }
    unset_fields = {"locked_until": "", "last_failed_login_at": ""}
    if needs_rehash:
        updates["password_hash"] = await run_in_threadpool(hash_password, req.password)
        user["password_hash"] = updates["password_hash"]
    await db.users.update_one({"_id": user["_id"]}, {"$set": updates, "$unset": unset_fields})
    user.update(updates)
    access_token, refresh_token = await create_session(user, request)
    set_auth_cookies(response, access_token, refresh_token)
    return public_user(user)

@api_router.post("/auth/refresh")
async def refresh_session(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    try:
        payload = decode_token(token, "refresh")
        now = datetime.now(timezone.utc)
        session = await db.sessions.find_one({
            "id": payload["sid"],
            "user_id": payload["sub"],
            "revoked_at": {"$exists": False},
            "expires_at": {"$gt": now},
        })
        presented_jti_hash = hashlib.sha256(payload["jti"].encode("utf-8")).hexdigest()
        if not session or not hmac.compare_digest(session.get("refresh_jti_hash", ""), presented_jti_hash):
            if session:
                await db.sessions.update_one({"_id": session["_id"]}, {"$set": {"revoked_at": now}})
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user or user.get("auth_version", 1) != payload.get("ver"):
            raise HTTPException(status_code=401, detail="User not found")
        new_refresh_jti = secrets.token_urlsafe(32)
        new_refresh_jti_hash = hashlib.sha256(new_refresh_jti.encode("utf-8")).hexdigest()
        rotation = await db.sessions.update_one(
            {"_id": session["_id"], "refresh_jti_hash": presented_jti_hash, "revoked_at": {"$exists": False}},
            {"$set": {"refresh_jti_hash": new_refresh_jti_hash, "last_used_at": now}},
        )
        if rotation.modified_count != 1:
            await db.sessions.update_one({"_id": session["_id"]}, {"$set": {"revoked_at": now}})
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        access_token = create_access_token(str(user["_id"]), session["id"], user.get("auth_version", 1))
        refresh_token = create_refresh_token(
            str(user["_id"]), session["id"], user.get("auth_version", 1), new_refresh_jti,
        )
        set_auth_cookies(response, access_token, refresh_token)
        return {"message": "Session refreshed"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except (jwt.InvalidTokenError, InvalidId, KeyError, TypeError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("refresh_token") or request.cookies.get("access_token")
    if token:
        try:
            token_type = "refresh" if request.cookies.get("refresh_token") else "access"
            payload = decode_token(token, token_type, verify_expiration=False)
            await db.sessions.update_one(
                {"id": payload.get("sid")},
                {"$set": {"revoked_at": datetime.now(timezone.utc)}},
            )
        except (jwt.InvalidTokenError, KeyError, TypeError):
            pass
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    response.headers["Cache-Control"] = "no-store"
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

@api_router.get("/health")
async def health_check():
    await db.command("ping")
    return {"status": "ok", "database": "connected"}

# --- Products Routes ---
@api_router.get("/products")
async def get_products(category: Optional[str] = None, featured: Optional[bool] = None):
    query = {}
    if category:
        query["category"] = category
    if featured is not None:
        query["featured"] = featured
    products = await db.products.find(query, {"_id": 0}).to_list(100)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products")
async def create_product(product: ProductCreate, request: Request):
    await require_admin(request)
    product_id = secrets.token_hex(8)
    doc = product.model_dump()
    doc["id"] = product_id
    doc["created_at"] = datetime.now(timezone.utc)
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate, request: Request):
    await require_admin(request)
    update_data = product.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc)
    result = await db.products.update_one({"id": product_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, request: Request):
    await require_admin(request)
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"message": "Product deleted"}

# --- Order Notification Hook ---
def send_order_confirmation_email(order_data: dict):
    """Record confirmation without writing customer PII to application logs."""
    logger.info(
        "Order confirmed order_id=%s payment_method=%s",
        order_data.get("id", "unknown"),
        order_data.get("payment_method", "unknown"),
    )

# --- Orders Routes ---
@api_router.post("/orders")
async def create_order(order: OrderCreate, request: Request):
    user = await require_customer(request)
    await enforce_rate_limit("order-customer", user["id"], 20, 3600)
    if order.payment_method == PaymentMethod.razorpay and not razorpay_client:
        raise HTTPException(status_code=503, detail="Online payment is currently unavailable")
    order_id = f"ORD-{secrets.token_hex(4).upper()}"
    resolved_items = []
    subtotal = Decimal("0.00")
    for item in order.items:
        product = await db.products.find_one(
            {"id": item.product_id, "is_available": True},
            {"_id": 0},
        )
        if not product:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} is unavailable")
        size = next((entry for entry in product.get("sizes", []) if entry.get("name") == item.size), None)
        if not size:
            raise HTTPException(status_code=400, detail=f"Size {item.size} is unavailable for {product['name']}")
        unit_price = Decimal(str(size["price"])).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        line_total = unit_price * item.quantity
        subtotal += line_total
        resolved_items.append({
            "product_id": item.product_id,
            "name": product["name"],
            "size": item.size,
            "price": float(unit_price),
            "quantity": item.quantity,
            "line_total": float(line_total),
        })

    tracking_token = secrets.token_urlsafe(24)
    payment_token = secrets.token_urlsafe(24) if order.payment_method == PaymentMethod.razorpay else None
    doc = order.model_dump(mode="json")
    doc["items"] = resolved_items
    doc["id"] = order_id
    doc["subtotal"] = float(subtotal)
    doc["total"] = float(subtotal)
    doc["status"] = "payment_pending" if order.payment_method == PaymentMethod.razorpay else "pending"
    doc["payment_status"] = "unpaid" if order.payment_method == PaymentMethod.razorpay else "cod"
    doc["tracking_token_hash"] = hash_capability_token(tracking_token)
    if payment_token:
        doc["payment_token_hash"] = hash_capability_token(payment_token)
    doc["created_at"] = datetime.now(timezone.utc)
    doc["user_id"] = user["id"]
    doc["customer_email"] = doc.get("customer_email") or user.get("email", "")
    doc["customer_name"] = doc.get("customer_name") or user.get("name", "")
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    if order.payment_method == PaymentMethod.cod:
        send_order_confirmation_email(doc)
    doc.pop("tracking_token_hash", None)
    doc.pop("payment_token_hash", None)
    doc["tracking_token"] = tracking_token
    if payment_token:
        doc["payment_token"] = payment_token
    return doc

@api_router.get("/my-orders")
async def get_my_orders(request: Request):
    user = await require_customer(request)
    user_id = user["id"]
    email = user.get("email", "")
    orders = await db.orders.find(
        {"$or": [{"user_id": user_id}, {"customer_email": email}]},
        {"_id": 0, "tracking_token_hash": 0, "payment_token_hash": 0}
    ).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders")
async def get_orders(request: Request, status: Optional[OrderStatus] = None):
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status.value
    orders = await db.orders.find(
        query,
        {"_id": 0, "tracking_token_hash": 0, "payment_token_hash": 0},
    ).sort("created_at", -1).to_list(500)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, request: Request):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not await can_manage_order(request, order):
        raise HTTPException(status_code=404, detail="Order not found")
    order.pop("tracking_token_hash", None)
    order.pop("payment_token_hash", None)
    return order

@api_router.get("/tracking/orders/{order_id}")
async def track_order(order_id: str, request: Request, token: Optional[str] = None):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    token_valid = bool(
        token
        and order.get("tracking_token_hash")
        and hmac.compare_digest(order["tracking_token_hash"], hash_capability_token(token))
    )
    if not token_valid and not await can_manage_order(request, order):
        raise HTTPException(status_code=404, detail="Order not found")
    return {
        "id": order["id"],
        "status": order["status"],
        "payment_status": order.get("payment_status"),
        "payment_method": order.get("payment_method"),
        "total": order.get("total"),
        "created_at": order.get("created_at"),
        "items": [
            {
                "name": item.get("name"),
                "size": item.get("size"),
                "quantity": item.get("quantity"),
            }
            for item in order.get("items", [])
        ],
    }

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, request: Request):
    await require_admin(request)
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status.value, "updated_at": datetime.now(timezone.utc)}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated

# --- Reviews Routes ---
@api_router.get("/reviews")
async def get_reviews():
    reviews = await db.reviews.find(
        {"status": "approved"},
        {
            "_id": 0,
            "id": 1,
            "customer_name": 1,
            "rating": 1,
            "comment": 1,
            "product_id": 1,
            "source": 1,
            "created_at": 1,
        },
    ).sort("created_at", -1).to_list(100)
    return reviews

@api_router.post("/reviews", status_code=201)
async def create_review(review: ReviewCreate, request: Request):
    await enforce_rate_limit("review-ip", request_ip(request), 5, 3600)
    doc = review.model_dump()
    doc["email"] = str(doc["email"]).lower().strip()
    doc["id"] = secrets.token_hex(8)
    doc["status"] = "pending"
    doc["source"] = "website"
    doc["created_at"] = datetime.now(timezone.utc)
    await db.reviews.insert_one(doc)
    return {
        "message": "Thank you. Your review was submitted for approval.",
        "id": doc["id"],
    }

# --- Contact Routes ---
@api_router.post("/contact")
async def submit_contact(contact: ContactCreate, request: Request):
    user = await require_customer(request)
    await enforce_rate_limit("contact-user", user["id"], 5, 3600)
    doc = contact.model_dump()
    doc["id"] = secrets.token_hex(8)
    doc["user_id"] = user["id"]
    doc["created_at"] = datetime.now(timezone.utc)
    doc["read"] = False
    await db.contacts.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Message sent successfully", "id": doc["id"]}

# --- Razorpay Routes ---
@api_router.post("/orders/{order_id}/razorpay-order")
async def create_razorpay_order(order_id: str, body: RazorpayOrderRequest, request: Request):
    if not razorpay_client:
        raise HTTPException(status_code=400, detail="Razorpay not configured")
    order = await db.orders.find_one({"id": order_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not await can_manage_order(request, order, body.payment_token):
        raise HTTPException(status_code=403, detail="You cannot pay for this order")
    if order.get("payment_method") != "razorpay":
        raise HTTPException(status_code=400, detail="Order does not use Razorpay")
    if order.get("payment_status") == "paid":
        raise HTTPException(status_code=409, detail="Order is already paid")

    amount = order_total_in_paise(order)
    if order.get("razorpay_order_id"):
        return {
            "razorpay_order_id": order["razorpay_order_id"],
            "amount": amount,
            "currency": "INR",
            "key_id": razorpay_key_id,
        }

    now = datetime.now(timezone.utc)
    lock_token = secrets.token_urlsafe(16)
    claimed_order = await db.orders.find_one_and_update(
        {
            "id": order_id,
            "razorpay_order_id": {"$exists": False},
            "$or": [
                {"razorpay_order_lock": {"$exists": False}},
                {"razorpay_order_lock_expires_at": {"$lte": now}},
            ],
        },
        {"$set": {
            "razorpay_order_lock": lock_token,
            "razorpay_order_lock_expires_at": now + timedelta(seconds=45),
            "updated_at": now,
        }},
        return_document=ReturnDocument.AFTER,
    )
    if not claimed_order:
        latest = await db.orders.find_one({"id": order_id})
        if latest and latest.get("razorpay_order_id"):
            return {
                "razorpay_order_id": latest["razorpay_order_id"],
                "amount": amount,
                "currency": "INR",
                "key_id": razorpay_key_id,
            }
        raise HTTPException(status_code=409, detail="Payment setup is already in progress. Please retry shortly.")

    try:
        razorpay_order = await run_in_threadpool(razorpay_client.order.create, {
            "amount": amount,
            "currency": "INR",
            "receipt": order_id,
            "notes": {"chaska_order_id": order_id},
        })
        stored = await db.orders.update_one(
            {"id": order_id, "razorpay_order_lock": lock_token},
            {
                "$set": {
                    "razorpay_order_id": razorpay_order["id"],
                    "razorpay_amount": razorpay_order["amount"],
                    "razorpay_currency": razorpay_order["currency"],
                    "updated_at": datetime.now(timezone.utc),
                },
                "$unset": {
                    "razorpay_order_lock": "",
                    "razorpay_order_lock_expires_at": "",
                },
            },
        )
        if not stored.modified_count:
            raise HTTPException(status_code=409, detail="Payment setup could not be saved. Please retry.")
    except HTTPException:
        raise
    except (razorpay.errors.BadRequestError, razorpay.errors.GatewayError, razorpay.errors.ServerError):
        await db.orders.update_one(
            {"id": order_id, "razorpay_order_lock": lock_token},
            {"$unset": {"razorpay_order_lock": "", "razorpay_order_lock_expires_at": ""}},
        )
        logger.exception("Razorpay order creation failed for order_id=%s", order_id)
        raise HTTPException(status_code=502, detail="Payment provider is temporarily unavailable")
    return {
        "razorpay_order_id": razorpay_order["id"],
        "amount": razorpay_order["amount"],
        "currency": razorpay_order["currency"],
        "key_id": razorpay_key_id,
    }

@api_router.post("/payments/razorpay/verify")
async def verify_razorpay_payment(body: PaymentVerify, request: Request, response: Response):
    if not razorpay_client:
        raise HTTPException(status_code=400, detail="Razorpay not configured")
    order = await db.orders.find_one({
        "id": body.order_id,
        "razorpay_order_id": body.razorpay_order_id,
    })
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if not await can_manage_order(request, order, body.payment_token):
        raise HTTPException(status_code=403, detail="You cannot verify this order")
    if order.get("payment_status") == "paid":
        return {"status": "paid"}
    try:
        await run_in_threadpool(razorpay_client.utility.verify_payment_signature, {
            "razorpay_order_id": body.razorpay_order_id,
            "razorpay_payment_id": body.razorpay_payment_id,
            "razorpay_signature": body.razorpay_signature,
        })
        payment = await run_in_threadpool(razorpay_client.payment.fetch, body.razorpay_payment_id)
        if payment.get("order_id") != order.get("razorpay_order_id"):
            raise HTTPException(status_code=400, detail="Payment does not belong to this order")
        if payment.get("amount") != order_total_in_paise(order) or payment.get("currency") != "INR":
            raise HTTPException(status_code=400, detail="Payment amount or currency does not match the order")
        if payment.get("status") == "captured":
            try:
                await mark_order_paid(order, payment)
            except DuplicateKeyError:
                logger.error("Razorpay payment ID reuse blocked for order_id=%s", body.order_id)
                raise HTTPException(status_code=409, detail="Payment has already been applied")
            return {"status": "paid"}

        provider_status = payment.get("status", "unknown")
        internal_status = "failed" if provider_status == "failed" else "processing"
        await db.orders.update_one(
            {"id": body.order_id, "payment_status": {"$ne": "paid"}},
            {"$set": {
                "payment_status": internal_status,
                "razorpay_payment_id": body.razorpay_payment_id,
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        response.status_code = 202
        return {"status": internal_status, "provider_status": provider_status}
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment verification failed")
    except (razorpay.errors.BadRequestError, razorpay.errors.GatewayError, razorpay.errors.ServerError):
        logger.exception("Razorpay payment fetch failed for order_id=%s", body.order_id)
        raise HTTPException(status_code=502, detail="Payment verification is temporarily unavailable")

@api_router.post("/payments/razorpay/webhook")
async def razorpay_webhook(request: Request):
    if not razorpay_webhook_secret:
        raise HTTPException(status_code=503, detail="Razorpay webhook is not configured")
    raw_body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature", "")
    expected = hmac.new(
        razorpay_webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()
    if not signature or not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        event = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")

    now = datetime.now(timezone.utc)
    event_id = request.headers.get("X-Razorpay-Event-Id") or hashlib.sha256(raw_body).hexdigest()
    try:
        claimed_event = await db.payment_events.find_one_and_update(
            {
                "id": event_id,
                "processed_at": {"$exists": False},
                "$or": [
                    {"processing_until": {"$exists": False}},
                    {"processing_until": {"$lte": now}},
                ],
            },
            {
                "$setOnInsert": {
                    "id": event_id,
                    "event_type": event.get("event", "unknown"),
                    "received_at": now,
                    "expires_at": now + timedelta(days=90),
                },
                "$set": {"processing_until": now + timedelta(minutes=2)},
            },
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except DuplicateKeyError:
        return {"status": "duplicate"}
    if not claimed_event:
        return {"status": "duplicate"}

    event_type = event.get("event")
    payload = event.get("payload", {})
    outcome = "ignored"
    try:
        if event_type in {"payment.captured", "order.paid"}:
            payment = payload.get("payment", {}).get("entity", {})
            razorpay_order = payload.get("order", {}).get("entity", {})
            razorpay_order_id = payment.get("order_id") or razorpay_order.get("id")
            order = await db.orders.find_one({"razorpay_order_id": razorpay_order_id}) if razorpay_order_id else None
            if order and razorpay_payment_matches_order(payment, order):
                try:
                    await mark_order_paid(order, payment)
                    outcome = "paid"
                except DuplicateKeyError:
                    logger.error("Webhook payment ID reuse blocked for order_id=%s", order["id"])
                    outcome = "payment_id_conflict"
            else:
                logger.error("Ignored mismatched Razorpay capture event event_id=%s", event_id)
                outcome = "capture_mismatch"
        elif event_type == "payment.failed":
            payment = payload.get("payment", {}).get("entity", {})
            razorpay_order_id = payment.get("order_id")
            if razorpay_order_id:
                await db.orders.update_one(
                    {"razorpay_order_id": razorpay_order_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {
                        "payment_status": "failed",
                        "razorpay_payment_id": payment.get("id"),
                        "updated_at": now,
                    }},
                )
                outcome = "failed"
        elif event_type == "refund.processed":
            refund = payload.get("refund", {}).get("entity", {})
            order = await db.orders.find_one({"razorpay_payment_id": refund.get("payment_id")})
            if order:
                refund_amount = int(refund.get("amount") or 0)
                refund_state = "refunded" if refund_amount >= order_total_in_paise(order) else "partially_refunded"
                await db.orders.update_one(
                    {"id": order["id"]},
                    {"$set": {
                        "payment_status": refund_state,
                        "refund_status": "processed",
                        "razorpay_refund_id": refund.get("id"),
                        "refund_amount": refund_amount,
                        "refunded_at": now,
                        "updated_at": now,
                    }},
                )
                outcome = refund_state
        elif event_type == "payment.dispute.created":
            dispute = payload.get("dispute", {}).get("entity", {})
            payment_id = dispute.get("payment_id")
            if payment_id:
                await db.orders.update_one(
                    {"razorpay_payment_id": payment_id},
                    {"$set": {
                        "payment_disputed": True,
                        "razorpay_dispute_id": dispute.get("id"),
                        "updated_at": now,
                    }},
                )
                outcome = "disputed"

        await db.payment_events.update_one(
            {"id": event_id},
            {
                "$set": {"processed_at": datetime.now(timezone.utc), "outcome": outcome},
                "$unset": {"processing_until": ""},
            },
        )
        return {"status": "ok"}
    except Exception:
        await db.payment_events.update_one(
            {"id": event_id},
            {
                "$set": {"last_failed_at": datetime.now(timezone.utc)},
                "$unset": {"processing_until": ""},
            },
        )
        logger.exception("Razorpay webhook processing failed event_id=%s", event_id)
        raise

# --- Admin Stats ---
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    total_reviews = await db.reviews.count_documents({})
    total_contacts = await db.contacts.count_documents({"read": False})
    pipeline = [
        {"$match": {"$or": [
            {"payment_status": "paid"},
            {"payment_method": "cod", "status": "delivered"},
        ]}},
        {"$group": {"_id": None, "total": {"$sum": "$total"}}},
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]["total"] if revenue_result else 0
    return {
        "total_products": total_products,
        "total_orders": total_orders,
        "pending_orders": pending_orders,
        "total_reviews": total_reviews,
        "unread_contacts": total_contacts,
        "total_revenue": total_revenue
    }

@api_router.get("/admin/contacts")
async def get_contacts(request: Request):
    await require_admin(request)
    contacts = await db.contacts.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return contacts

@api_router.patch("/admin/contacts/{contact_id}/read")
async def mark_contact_read(contact_id: str, request: Request):
    await require_admin(request)
    result = await db.contacts.update_one(
        {"id": contact_id},
        {"$set": {"read": True, "updated_at": datetime.now(timezone.utc)}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Contact message not found")
    return {"message": "Contact marked as read"}

@api_router.get("/razorpay/config")
async def get_razorpay_config():
    return {
        "key_id": razorpay_key_id if razorpay_client else "",
        "enabled": bool(razorpay_client),
    }

async def reject_cross_site_mutations(request: Request, call_next):
    if request.url.path.startswith("/api/") and request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("Origin")
        same_origin = str(request.base_url).rstrip("/")
        if origin and origin not in CORS_ORIGINS and origin != same_origin:
            response = Response(status_code=403, content="Cross-site request rejected")
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    if IS_PRODUCTION:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    return response

# --- Optional Admin Bootstrap ---
async def seed_admin():
    if not ADMIN_EMAIL or not ADMIN_PASSWORD:
        logger.warning("ADMIN_EMAIL/ADMIN_PASSWORD not set; admin bootstrap skipped")
        return
    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing is None:
        try:
            validate_new_password(ADMIN_PASSWORD, "Admin", ADMIN_EMAIL)
        except ValueError as error:
            raise RuntimeError(f"ADMIN_PASSWORD does not meet the password policy: {error}") from error
        hashed = await run_in_threadpool(hash_password, ADMIN_PASSWORD)
        await db.users.insert_one({
            "email": ADMIN_EMAIL, "password_hash": hashed,
            "name": "Admin", "role": "admin",
            "auth_version": 1, "failed_login_count": 0,
            "created_at": datetime.now(timezone.utc)
        })
        logger.info("Admin user seeded")

async def migrate_legacy_users_for_auth():
    async for user in db.users.find({}):
        updates = {}
        email = user.get("email")
        if isinstance(email, str):
            normalized_email = email.strip().lower()
            if normalized_email != email:
                collision = await db.users.find_one({"_id": {"$ne": user["_id"]}, "email": normalized_email})
                if collision:
                    raise RuntimeError("Cannot normalize duplicate user email; resolve duplicate accounts first")
                updates["email"] = normalized_email
        phone = user.get("phone")
        if isinstance(phone, str):
            try:
                identity_type, normalized_phone = normalize_identity(phone)
            except ValueError as error:
                raise RuntimeError("Cannot normalize an existing user phone number") from error
            if identity_type != "phone":
                raise RuntimeError("Existing user phone field contains a non-phone identity")
            if normalized_phone != phone:
                collision = await db.users.find_one({"_id": {"$ne": user["_id"]}, "phone": normalized_phone})
                if collision:
                    raise RuntimeError("Cannot normalize duplicate user phone; resolve duplicate accounts first")
                updates["phone"] = normalized_phone
        if "auth_version" not in user:
            updates["auth_version"] = 1
        if "failed_login_count" not in user:
            updates["failed_login_count"] = 0
        if updates:
            await db.users.update_one({"_id": user["_id"]}, {"$set": updates})

async def migrate_legacy_timestamps():
    for collection_name in ("users", "products", "orders", "reviews", "contacts"):
        collection = db[collection_name]
        async for document in collection.find(
            {"$or": [
                {"created_at": {"$type": "string"}},
                {"updated_at": {"$type": "string"}},
            ]},
            {"created_at": 1, "updated_at": 1},
        ):
            updates = {}
            for field_name in ("created_at", "updated_at"):
                value = document.get(field_name)
                if isinstance(value, str):
                    try:
                        updates[field_name] = datetime.fromisoformat(value.replace("Z", "+00:00"))
                    except ValueError:
                        logger.warning("Could not migrate %s.%s for %s", collection_name, field_name, document["_id"])
            if updates:
                await collection.update_one({"_id": document["_id"]}, {"$set": updates})

async def ensure_indexes_and_legacy_tracking_tokens():
    user_indexes = await db.users.index_information()
    for index_name, index in user_indexes.items():
        if index_name not in {"_id_", "uniq_user_email"} and index.get("key") == [("email", 1)]:
            await db.users.drop_index(index_name)
    await db.users.create_index(
        "email",
        name="uniq_user_email",
        unique=True,
        partialFilterExpression={"email": {"$type": "string"}},
    )
    await db.users.create_index(
        "phone",
        name="uniq_user_phone",
        unique=True,
        partialFilterExpression={"phone": {"$type": "string"}},
    )
    await db.sessions.create_index("id", unique=True)
    await db.sessions.create_index([("user_id", 1), ("created_at", -1)])
    await db.sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.auth_rate_limits.create_index("expires_at", expireAfterSeconds=0)
    await db.products.create_index("id", unique=True)
    await db.reviews.create_index("id", unique=True)
    await db.reviews.create_index([("status", 1), ("created_at", -1)])
    await db.orders.create_index("id", unique=True)
    await db.orders.create_index("tracking_token_hash", unique=True, sparse=True)
    await db.orders.create_index("razorpay_order_id", unique=True, sparse=True)
    await db.orders.create_index("razorpay_payment_id", unique=True, sparse=True)
    await db.orders.create_index([("user_id", 1), ("created_at", -1)])
    await db.orders.create_index([("customer_email", 1), ("created_at", -1)])
    await db.payment_events.create_index("id", unique=True)
    await db.payment_events.create_index("expires_at", expireAfterSeconds=0)

    async for order in db.orders.find(
        {"tracking_token_hash": {"$exists": False}},
        {"_id": 1},
    ):
        await db.orders.update_one(
            {"_id": order["_id"]},
            {"$set": {"tracking_token_hash": hash_capability_token(secrets.token_urlsafe(24))}},
        )

async def startup():
    await migrate_legacy_timestamps()
    await migrate_legacy_users_for_auth()
    await ensure_indexes_and_legacy_tracking_tokens()
    await seed_admin()

@asynccontextmanager
async def lifespan(_app: FastAPI):
    await startup()
    try:
        yield
    finally:
        await client.close()

app = FastAPI(
    title="Chaska API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if IS_PRODUCTION else "/docs",
    redoc_url=None if IS_PRODUCTION else "/redoc",
    openapi_url=None if IS_PRODUCTION else "/openapi.json",
)
app.include_router(api_router)
app.middleware("http")(reject_cross_site_mutations)
app.add_middleware(GZipMiddleware, minimum_size=1000)
if ALLOWED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=None if IS_PRODUCTION else r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):3000$",
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)
