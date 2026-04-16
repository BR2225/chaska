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
                            │ Motor (async driver)
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
  "email": "customer@example.com",    // unique index
  "password_hash": "$2b$12...",       // bcrypt hashed
  "name": "Customer Name",
  "role": "customer" | "admin",
  "created_at": "2026-04-16T..."
}
```

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
       │    {name, email, password}    │── bcrypt hash password ──▶│
       │                              │◀── user created ──────────│
       │◀── Set httpOnly cookies ──────│                           │
       │    (access_token, refresh)    │                           │
       │                              │                           │
       │─── POST /api/auth/login ─────▶│                           │
       │    {email, password}          │── verify bcrypt hash ────▶│
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
- Passwords are hashed with bcrypt (never stored plain)
- JWT access tokens expire in 1 hour, refresh tokens in 7 days
- Tokens stored as httpOnly cookies (not accessible via JavaScript = XSS-safe)
- Admin user is auto-seeded on server startup

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
│   ├── .env                   # MONGO_URL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, RAZORPAY keys
│   └── requirements.txt       # Python dependencies
│
├── frontend/
│   ├── .env                   # REACT_APP_BACKEND_URL
│   ├── src/
│   │   ├── App.js             # Routes configuration
│   │   ├── index.css           # Tailwind + custom CSS vars + fonts
│   │   ├── contexts/
│   │   │   ├── AuthContext.js  # User authentication state
│   │   │   └── CartContext.js  # Shopping cart state (localStorage)
│   │   ├── components/
│   │   │   ├── Header.js       # Navigation + logo + cart + user menu
│   │   │   ├── Footer.js       # Footer with contact info
│   │   │   ├── AdminLayout.js  # Admin sidebar layout wrapper
│   │   │   ├── ProductCard.js  # Product card with size selection
│   │   │   └── CartSheet.js    # Slide-out cart panel
│   │   ├── pages/
│   │   │   ├── Home.js         # Landing: hero, categories, featured, reviews
│   │   │   ├── Menu.js         # Product catalog with filters
│   │   │   ├── ProductDetail.js# Single product page
│   │   │   ├── Checkout.js     # Order form + payment selection
│   │   │   ├── TrackOrder.js   # Order tracking with status timeline
│   │   │   ├── Contact.js      # Contact form + location info
│   │   │   ├── CustomerAuth.js # Login/Register tabs
│   │   │   ├── MyOrders.js     # Customer order history
│   │   │   ├── AdminLogin.js   # Admin sign-in
│   │   │   ├── AdminDashboard.js # Stats cards + recent orders
│   │   │   ├── AdminProducts.js  # Product CRUD table + dialog
│   │   │   ├── AdminOrders.js    # Order management + status updates
│   │   │   └── AdminContacts.js  # Contact messages viewer
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
| Frontend | React 19 | UI framework |
| Styling | Tailwind CSS 3.4 | Utility-first CSS |
| UI Components | Shadcn UI | Dialogs, Selects, Sheets, Tables |
| Routing | React Router 7 | Client-side navigation |
| State | React Context | Auth + Cart state management |
| Backend | FastAPI | Python async API server |
| Database | MongoDB | NoSQL document store |
| DB Driver | Motor 3.3 | Async MongoDB driver for Python |
| Auth | JWT (PyJWT) + bcrypt | Token-based auth with password hashing |
| Payment | Razorpay SDK | Online payment gateway (when configured) |
| Fonts | Google Fonts | Boogaloo (brand), Cormorant Garamond (headings), Outfit (body) |
