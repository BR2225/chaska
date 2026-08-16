# Chaska - Architecture & Flow Documentation

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                        │
│                                                                 │
│   React App (Port 3000)                                         │
│   ├── Public Pages: Home, Menu, Checkout, Contact, Track Order  │
│   ├── Customer Pages: Login/Register, My Orders                 │
│   └── Admin Pages: Dashboard, Products, Orders, Messages        │
│                                                                 │
│   State Management:                                             │
│   ├── AuthContext (user session via httpOnly cookies)            │
│   └── CartContext (shopping cart via localStorage)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS API calls
                            │ (all routes prefixed with /api)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Port 8001)                   │
│                                                                 │
│   Routes:                                                       │
│   ├── /api/auth/*      → Authentication (JWT + cookies)         │
│   ├── /api/products/*  → Product catalog CRUD                   │
│   ├── /api/orders/*    → Order management                       │
│   ├── /api/my-orders   → Customer's order history               │
│   ├── /api/reviews/*   → Customer reviews                       │
│   ├── /api/contact     → Contact form submissions               │
│   ├── /api/razorpay/*  → Payment gateway (when configured)      │
│   └── /api/admin/*     → Admin stats & contacts                 │
│                                                                 │
│   Middleware: CORS, Cookie Auth                                  │
│   Security: bcrypt password hashing, JWT tokens                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │ PyMongo Async
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MongoDB Database                              │
│                                                                 │
│   Collections:                                                  │
│   ├── users          → Admin & customer accounts                │
│   ├── products       → Bomboloni & Tiramisu catalog             │
│   ├── orders         → Customer orders with status tracking     │
│   ├── reviews        → Customer testimonials                    │
│   └── contacts       → Contact form messages                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema (MongoDB Collections)

### `users`
```json
{
  "email": "customer@example.com",    // optional, unique when present
  "phone": "+919876543210",           // optional, unique when present
  "password_hash": "$argon2id$...",   // Argon2id (legacy bcrypt upgrades on login)
  "name": "Customer Name",
  "role": "customer" | "admin",
  "auth_version": 1,
  "failed_login_count": 0,
  "created_at": "2026-04-16T..."
}
```

### `sessions`
```json
{
  "id": "unguessable-session-id",
  "user_id": "...",
  "refresh_jti_hash": "sha256...",
  "created_at": "...",
  "last_used_at": "...",
  "expires_at": "..."
}
```

Expired sessions and authentication rate-limit buckets are removed using MongoDB TTL indexes.

### `products`
```json
{
  "id": "bomboloni-classic",          // custom string ID
  "name": "Classic Cream Bomboloni",
  "category": "bomboloni" | "tiramisu",
  "description": "Light, airy Italian...",
  "price": 180,                       // base price in INR
  "image": "https://...",
  "sizes": [
    { "name": "Single", "price": 180 },
    { "name": "Box of 6", "price": 950 }
  ],
  "is_available": true,
  "featured": true,
  "created_at": "2026-04-16T..."
}
```

### `orders`
```json
{
  "id": "ORD-A1B2C3D4",              // human-readable order ID
  "user_id": "...",                   // linked to logged-in user (optional)
  "items": [
    { "product_id": "bomboloni-classic", "name": "...", "size": "Single", "price": 180, "quantity": 2 }
  ],
  "customer_name": "John",
  "customer_email": "john@example.com",
  "customer_phone": "9876543210",
  "delivery_address": "123 Street, Delhi",
  "payment_method": "cod" | "razorpay",
  "payment_status": "cod" | "pending" | "paid",
  "total": 360,
  "status": "pending" | "confirmed" | "preparing" | "out_for_delivery" | "delivered" | "cancelled",
  "notes": "...",
  "created_at": "2026-04-16T..."
}
```

### `reviews`
```json
{
  "id": "rev1",
  "customer_name": "Maria Rossi",
  "rating": 5,
  "comment": "The best bomboloni...",
  "product_id": "bomboloni-pistachio",
  "created_at": "2026-04-16T..."
}
```

### `contacts`
```json
{
  "id": "...",
  "name": "Visitor Name",
  "email": "visitor@email.com",
  "subject": "Catering inquiry",
  "message": "...",
  "read": false,
  "created_at": "2026-04-16T..."
}
```

---

## Authentication Flow

```
  Customer/Admin                    Backend                     MongoDB
       │                              │                           │
       │─── POST /api/auth/register ──▶│                           │
       │ {full_name, identifier, pass} │── Argon2id hash password ▶│
       │                              │◀── user created ──────────│
       │◀── Set httpOnly cookies ──────│                           │
       │    (access_token, refresh)    │                           │
       │                              │                           │
       │─── POST /api/auth/login ─────▶│                           │
       │    {identifier, password}     │── verify hash + throttle ▶│
       │                              │◀── user found ────────────│
       │◀── Set httpOnly cookies ──────│                           │
       │                              │                           │
       │─── GET /api/auth/me ─────────▶│                           │
       │    (cookie sent automatically)│── decode JWT, find user ─▶│
       │◀── user data ────────────────│                           │
       │                              │                           │
       │─── POST /api/auth/logout ────▶│                           │
       │◀── Delete cookies ────────────│                           │
```

**Key Points:**
- Registration accepts a normalized email or international phone number
- Passwords require 8+ characters with a letter and number, reject common values, and use Argon2id
- Existing bcrypt passwords are upgraded to Argon2id after a successful login
- JWT access tokens expire in 15 minutes; refresh tokens rotate and are backed by revocable MongoDB sessions
- Tokens are stored in `httpOnly` cookies, with secure cookies enforced in production
- Login/account throttling is shared through MongoDB rather than process-local memory
- Admin user is created on startup only when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured
- Products and product prices are read exclusively from MongoDB; the one-time catalog migration populates a new database

---

## Order Flow (Customer Journey)

```
  1. BROWSE          2. ADD TO CART       3. CHECKOUT           4. TRACK
  ┌──────────┐      ┌──────────────┐    ┌───────────────┐    ┌──────────────┐
  │ /menu    │      │ CartContext   │    │ /checkout     │    │ /track-order │
  │          │──▶   │ (localStorage│──▶ │               │──▶│              │
  │ Products │      │  persisted)  │    │ Fill form     │    │ Enter order  │
  │ by       │      │              │    │ Select COD/   │    │ ID to see    │
  │ category │      │ Add/Remove   │    │ Razorpay      │    │ status       │
  │          │      │ Update qty   │    │               │    │ timeline     │
  └──────────┘      └──────────────┘    │ POST /api/    │    └──────────────┘
                                        │ orders        │
                                        └───────┬───────┘
                                                │
                                                ▼
                                        ┌───────────────┐
                                        │ Order Created  │
                                        │ + Email logged │
                                        │ + Confirmation │
                                        │   page shown   │
                                        └───────────────┘
```

**If logged in:** Order is linked to user account → visible in `/my-orders`
**If guest:** Order still created → trackable via order ID

---

## Admin Flow

```
  /admin/login → /admin/dashboard → Manage everything

  Dashboard ─── Stats overview (revenue, orders, products, reviews)
     │
     ├── /admin/products ─── View all products table
     │       ├── Create new product (dialog with sizes)
     │       ├── Edit existing product
     │       └── Delete product
     │
     ├── /admin/orders ─── View all orders (filterable by status)
     │       └── Update order status (pending → confirmed → preparing → delivered)
     │
     └── /admin/contacts ─── View customer messages from contact form
```

---

## File Structure

```
/app/
├── backend/
│   ├── server.py              # All API routes, auth, models, seeding
│   ├── .env                   # MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, Razorpay keys
│   ├── scripts/               # One-time MongoDB catalog migration
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── .env                   # REACT_APP_BACKEND_URL
│   ├── src/
│   │   ├── App.jsx            # Routes configuration
│   │   ├── index.css           # Tailwind + custom CSS vars + fonts
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx # User authentication state
│   │   │   └── CartContext.jsx # Shopping cart state (localStorage)
│   │   ├── components/
│   │   │   ├── Header.jsx      # Navigation + logo + cart + user menu
│   │   │   ├── Footer.jsx      # Footer with contact info
│   │   │   ├── AdminLayout.jsx # Admin sidebar layout wrapper
│   │   │   ├── ProductCard.jsx # Product card with size selection
│   │   │   └── CartSheet.jsx   # Slide-out cart panel
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Landing: hero, categories, featured, reviews
│   │   │   ├── Menu.jsx        # Product catalog with filters
│   │   │   ├── ProductDetail.jsx # Single product page
│   │   │   ├── Checkout.jsx    # Order form + payment selection
│   │   │   ├── TrackOrder.jsx  # Order tracking with status timeline
│   │   │   ├── Contact.jsx     # Contact form + location info
│   │   │   ├── CustomerAuth.jsx # Login/Register tabs
│   │   │   ├── MyOrders.jsx    # Customer order history
│   │   │   ├── AdminLogin.jsx  # Admin sign-in
│   │   │   ├── AdminDashboard.jsx # Stats cards + recent orders
│   │   │   ├── AdminProducts.jsx # Product CRUD table + dialog
│   │   │   ├── AdminOrders.jsx # Order management + status updates
│   │   │   └── AdminContacts.jsx # Contact messages viewer
│   │   └── components/ui/     # Shadcn UI components
│   └── package.json
│
└── memory/
    ├── PRD.md                 # Product requirements document
    └── test_credentials.md    # Login credentials for testing
```

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | None | Create customer account |
| POST | /api/auth/login | None | Login (admin or customer) |
| POST | /api/auth/logout | Any | Clear session cookies |
| GET | /api/auth/me | Any | Get current user info |
| GET | /api/products | None | List all products (filter: ?category=, ?featured=) |
| GET | /api/products/:id | None | Get single product |
| POST | /api/products | Admin | Create product |
| PUT | /api/products/:id | Admin | Update product |
| DELETE | /api/products/:id | Admin | Delete product |
| POST | /api/orders | None | Place order (links to user if logged in) |
| GET | /api/orders | Admin | List all orders (filter: ?status=) |
| GET | /api/orders/:id | None | Get order by ID (for tracking) |
| PUT | /api/orders/:id/status | Admin | Update order status |
| GET | /api/my-orders | Customer | Get logged-in user's orders |
| GET | /api/reviews | None | List reviews |
| POST | /api/reviews | None | Submit review |
| POST | /api/contact | None | Submit contact message |
| GET | /api/admin/stats | Admin | Dashboard statistics |
| GET | /api/admin/contacts | Admin | List contact messages |
| GET | /api/razorpay/config | None | Check if Razorpay is enabled |
| POST | /api/razorpay/create-order | None | Create Razorpay payment order |
| POST | /api/razorpay/verify | None | Verify Razorpay payment signature |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + Vite 8 | UI framework and build tool |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| UI Components | Shadcn UI | Dialogs, Selects, Sheets, Tables |
| Routing | React Router 7 | Client-side navigation |
| State | React Context | Auth + Cart state management |
| Backend | FastAPI | Python async API server |
| Database | MongoDB | NoSQL document store |
| DB Driver | PyMongo 4.17 | Native async MongoDB driver for Python |
| Auth | JWT (PyJWT) + bcrypt | Token-based auth with password hashing |
| Payment | Razorpay SDK | Online payment gateway (when configured) |
| Fonts | Google Fonts | Boogaloo (brand), Cormorant Garamond (headings), Outfit (body) |
