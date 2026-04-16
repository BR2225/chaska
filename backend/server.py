from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
import logging
import bcrypt
import jwt
import secrets
import razorpay
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
JWT_ALGORITHM = "HS256"
JWT_SECRET = os.environ.get("JWT_SECRET", secrets.token_hex(32))

# Razorpay
razorpay_key_id = os.environ.get("RAZORPAY_KEY_ID", "")
razorpay_key_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
razorpay_client = None
if razorpay_key_id and razorpay_key_secret:
    razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Password Hashing ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))

# --- JWT ---
def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(minutes=60), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

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
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"_id": ObjectId(payload["sub"])})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user["_id"] = str(user["_id"])
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def require_admin(request: Request) -> dict:
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# --- Pydantic Models ---
class LoginRequest(BaseModel):
    email: str
    password: str

class ProductCreate(BaseModel):
    name: str
    category: str
    description: str
    price: float
    image: str = ""
    sizes: List[dict] = []
    is_available: bool = True
    featured: bool = False

class OrderCreate(BaseModel):
    items: List[dict]
    customer_name: str
    customer_email: str
    customer_phone: str
    delivery_address: str
    payment_method: str = "cod"
    notes: str = ""

class ReviewCreate(BaseModel):
    customer_name: str
    rating: int
    comment: str
    product_id: Optional[str] = None

class ContactCreate(BaseModel):
    name: str
    email: str
    subject: str
    message: str

class OrderStatusUpdate(BaseModel):
    status: str

# --- Auth Routes ---
@api_router.post("/auth/login")
async def login(req: LoginRequest, response: Response):
    email = req.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    user_id = str(user["_id"])
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=3600, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"id": user_id, "email": user["email"], "name": user.get("name", ""), "role": user.get("role", "user"), "token": access_token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api_router.get("/auth/me")
async def get_me(request: Request):
    user = await get_current_user(request)
    return user

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
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, product: ProductCreate, request: Request):
    await require_admin(request)
    update_data = product.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
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

# --- Orders Routes ---
@api_router.post("/orders")
async def create_order(order: OrderCreate):
    order_id = f"ORD-{secrets.token_hex(4).upper()}"
    total = sum(item.get("price", 0) * item.get("quantity", 1) for item in order.items)
    doc = order.model_dump()
    doc["id"] = order_id
    doc["total"] = total
    doc["status"] = "pending"
    doc["payment_status"] = "pending" if order.payment_method == "razorpay" else "cod"
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/orders")
async def get_orders(request: Request, status: Optional[str] = None):
    await require_admin(request)
    query = {}
    if status:
        query["status"] = status
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: OrderStatusUpdate, request: Request):
    await require_admin(request)
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    updated = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return updated

# --- Reviews Routes ---
@api_router.get("/reviews")
async def get_reviews():
    reviews = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return reviews

@api_router.post("/reviews")
async def create_review(review: ReviewCreate):
    doc = review.model_dump()
    doc["id"] = secrets.token_hex(8)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return doc

# --- Contact Routes ---
@api_router.post("/contact")
async def submit_contact(contact: ContactCreate):
    doc = contact.model_dump()
    doc["id"] = secrets.token_hex(8)
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    doc["read"] = False
    await db.contacts.insert_one(doc)
    doc.pop("_id", None)
    return {"message": "Message sent successfully", "id": doc["id"]}

# --- Razorpay Routes ---
@api_router.post("/razorpay/create-order")
async def create_razorpay_order(request: Request):
    if not razorpay_client:
        raise HTTPException(status_code=400, detail="Razorpay not configured")
    body = await request.json()
    amount = int(body.get("amount", 0))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid amount")
    order = razorpay_client.order.create({
        "amount": amount,
        "currency": "INR",
        "payment_capture": 1
    })
    return {"id": order["id"], "amount": order["amount"], "currency": order["currency"]}

@api_router.post("/razorpay/verify")
async def verify_razorpay_payment(request: Request):
    if not razorpay_client:
        raise HTTPException(status_code=400, detail="Razorpay not configured")
    body = await request.json()
    try:
        razorpay_client.utility.verify_payment_signature({
            "razorpay_order_id": body["razorpay_order_id"],
            "razorpay_payment_id": body["razorpay_payment_id"],
            "razorpay_signature": body["razorpay_signature"]
        })
        await db.orders.update_one(
            {"razorpay_order_id": body["razorpay_order_id"]},
            {"$set": {"payment_status": "paid", "razorpay_payment_id": body["razorpay_payment_id"]}}
        )
        return {"status": "verified"}
    except Exception:
        raise HTTPException(status_code=400, detail="Payment verification failed")

# --- Admin Stats ---
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await require_admin(request)
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    pending_orders = await db.orders.count_documents({"status": "pending"})
    total_reviews = await db.reviews.count_documents({})
    total_contacts = await db.contacts.count_documents({"read": False})
    pipeline = [{"$group": {"_id": None, "total": {"$sum": "$total"}}}]
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

@api_router.get("/razorpay/config")
async def get_razorpay_config():
    return {"key_id": razorpay_key_id, "enabled": bool(razorpay_key_id)}

# Include router
app.include_router(api_router)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Seed Data ---
async def seed_admin():
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        hashed = hash_password(admin_password)
        await db.users.insert_one({
            "email": admin_email, "password_hash": hashed,
            "name": "Admin", "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        logger.info(f"Admin user seeded: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})
        logger.info("Admin password updated")

async def seed_products():
    count = await db.products.count_documents({})
    if count > 0:
        return
    products = [
        {"id": "bomboloni-classic", "name": "Classic Cream Bomboloni", "category": "bomboloni",
         "description": "Light, airy Italian doughnuts filled with velvety vanilla pastry cream. A timeless Florentine street food treasure.",
         "price": 180, "image": "https://images.unsplash.com/photo-1608894109526-ea487bf2c02c?w=600",
         "sizes": [{"name": "Single", "price": 180}, {"name": "Box of 6", "price": 950}, {"name": "Box of 12", "price": 1750}],
         "is_available": True, "featured": True},
        {"id": "bomboloni-nutella", "name": "Nutella Bomboloni", "category": "bomboloni",
         "description": "Warm, pillowy bomboloni generously filled with rich Nutella chocolate-hazelnut spread.",
         "price": 200, "image": "https://images.unsplash.com/photo-1551106652-a5bcf0b59234?w=600",
         "sizes": [{"name": "Single", "price": 200}, {"name": "Box of 6", "price": 1050}, {"name": "Box of 12", "price": 1950}],
         "is_available": True, "featured": True},
        {"id": "bomboloni-pistachio", "name": "Pistachio Bomboloni", "category": "bomboloni",
         "description": "Delicate bomboloni filled with authentic Sicilian pistachio cream, dusted with crushed pistachios.",
         "price": 220, "image": "https://images.unsplash.com/photo-1608894109526-ea487bf2c02c?w=600",
         "sizes": [{"name": "Single", "price": 220}, {"name": "Box of 6", "price": 1150}, {"name": "Box of 12", "price": 2150}],
         "is_available": True, "featured": False},
        {"id": "bomboloni-lemon", "name": "Lemon Curd Bomboloni", "category": "bomboloni",
         "description": "Bright, zesty lemon curd filling in a sugar-dusted bomboloni. Perfect with afternoon espresso.",
         "price": 190, "image": "https://images.unsplash.com/photo-1763905145494-ba846f94dfd8?w=600",
         "sizes": [{"name": "Single", "price": 190}, {"name": "Box of 6", "price": 1000}, {"name": "Box of 12", "price": 1850}],
         "is_available": True, "featured": False},
        {"id": "bomboloni-berry", "name": "Mixed Berry Bomboloni", "category": "bomboloni",
         "description": "Bursting with a medley of fresh strawberry, raspberry, and blueberry compote filling.",
         "price": 210, "image": "https://images.unsplash.com/photo-1769372742179-ed95c30f8b94?w=600",
         "sizes": [{"name": "Single", "price": 210}, {"name": "Box of 6", "price": 1100}, {"name": "Box of 12", "price": 2050}],
         "is_available": True, "featured": False},
        {"id": "tiramisu-classic", "name": "Classic Tiramisu", "category": "tiramisu",
         "description": "The quintessential Italian dessert. Layers of espresso-soaked ladyfingers, mascarpone cream, and cocoa.",
         "price": 450, "image": "https://images.unsplash.com/photo-1714385905983-6f8e06fffae1?w=600",
         "sizes": [{"name": "Individual", "price": 450}, {"name": "Half Kg", "price": 850}, {"name": "1 Kg", "price": 1500}],
         "is_available": True, "featured": True},
        {"id": "tiramisu-pistachio", "name": "Pistachio Tiramisu", "category": "tiramisu",
         "description": "A Sicilian twist on the classic. Pistachio cream layered with delicate sponge and white chocolate shavings.",
         "price": 520, "image": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?w=600",
         "sizes": [{"name": "Individual", "price": 520}, {"name": "Half Kg", "price": 950}, {"name": "1 Kg", "price": 1700}],
         "is_available": True, "featured": True},
        {"id": "tiramisu-strawberry", "name": "Strawberry Tiramisu", "category": "tiramisu",
         "description": "Fresh strawberries paired with mascarpone cream and a hint of amaretto liqueur.",
         "price": 480, "image": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=600",
         "sizes": [{"name": "Individual", "price": 480}, {"name": "Half Kg", "price": 900}, {"name": "1 Kg", "price": 1600}],
         "is_available": True, "featured": False},
        {"id": "tiramisu-matcha", "name": "Matcha Tiramisu", "category": "tiramisu",
         "description": "Japanese-Italian fusion. Premium matcha green tea layered with mascarpone and white chocolate.",
         "price": 500, "image": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600",
         "sizes": [{"name": "Individual", "price": 500}, {"name": "Half Kg", "price": 920}, {"name": "1 Kg", "price": 1650}],
         "is_available": True, "featured": False},
        {"id": "tiramisu-espresso", "name": "Double Espresso Tiramisu", "category": "tiramisu",
         "description": "For the coffee lover. Extra bold espresso with dark chocolate and mascarpone layers.",
         "price": 470, "image": "https://images.unsplash.com/photo-1542124948-dc391252a940?w=600",
         "sizes": [{"name": "Individual", "price": 470}, {"name": "Half Kg", "price": 880}, {"name": "1 Kg", "price": 1550}],
         "is_available": True, "featured": False},
    ]
    for p in products:
        p["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_many(products)
    logger.info(f"Seeded {len(products)} products")

async def seed_reviews():
    count = await db.reviews.count_documents({})
    if count > 0:
        return
    reviews = [
        {"id": "rev1", "customer_name": "Maria Rossi", "rating": 5, "comment": "The best bomboloni outside of Florence! The pistachio cream is heavenly.", "product_id": "bomboloni-pistachio", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "rev2", "customer_name": "Raj Patel", "rating": 5, "comment": "Their classic tiramisu is absolutely divine. Takes me back to Rome every time!", "product_id": "tiramisu-classic", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "rev3", "customer_name": "Sophie Chen", "rating": 4, "comment": "Ordered a box of Nutella bomboloni for a party. Everyone loved them!", "product_id": "bomboloni-nutella", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "rev4", "customer_name": "Arjun Mehta", "rating": 5, "comment": "The matcha tiramisu is a unique fusion that actually works brilliantly. Highly recommend.", "product_id": "tiramisu-matcha", "created_at": datetime.now(timezone.utc).isoformat()},
        {"id": "rev5", "customer_name": "Priya Sharma", "rating": 5, "comment": "Perfect delivery, beautifully packed. The lemon curd bomboloni were fresh and tangy!", "product_id": "bomboloni-lemon", "created_at": datetime.now(timezone.utc).isoformat()},
    ]
    await db.reviews.insert_many(reviews)
    logger.info("Seeded reviews")

@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await seed_admin()
    await seed_products()
    await seed_reviews()
    # Write test credentials
    creds_path = Path("/app/memory/test_credentials.md")
    creds_path.parent.mkdir(parents=True, exist_ok=True)
    creds_path.write_text(
        "# Test Credentials\n\n"
        f"## Admin\n- Email: {os.environ.get('ADMIN_EMAIL', 'admin@example.com')}\n"
        f"- Password: {os.environ.get('ADMIN_PASSWORD', 'admin123')}\n"
        "- Role: admin\n\n"
        "## Auth Endpoints\n- POST /api/auth/login\n- POST /api/auth/logout\n- GET /api/auth/me\n"
    )

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
