# DolceVita - Italian Desserts Business PRD

## Problem Statement
Italian dessert (Bomboloni & Tiramisu) business website with online ordering, product catalog, admin panel, pay-on-delivery + Razorpay.

## Architecture
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **Frontend**: React + Tailwind CSS + Shadcn UI
- **Auth**: JWT with httpOnly cookies, admin role-based access
- **Payment**: COD (active) + Razorpay (ready for configuration)
- **Database**: MongoDB (test_database)

## User Personas
1. **Customer**: Browses menu, adds to cart, places orders (COD/online)
2. **Admin**: Manages products, orders, inventory, views contact messages

## Core Requirements
- Product catalog with categories (Bomboloni, Tiramisu), sizes, pricing
- Shopping cart with localStorage persistence
- Checkout with delivery details + payment method selection
- Contact form with location info
- Customer reviews/testimonials
- Admin dashboard with stats, product CRUD, order management, contact messages

## What's Been Implemented (April 2026)
- Full product catalog (10 seeded products) with category filtering
- Shopping cart (add/remove/quantity/sizes) with localStorage
- Checkout flow with COD payment + order confirmation
- Contact form with backend storage
- Customer reviews (5 seeded)
- Admin panel: login, dashboard stats, product CRUD (add/edit/delete), order status management, contact messages
- JWT authentication with admin seeding
- Razorpay integration code (ready, needs API keys)
- Warm Italian aesthetic (Cormorant Garamond + Outfit fonts)

## Prioritized Backlog
### P0
- None (core features complete)

### P1
- Razorpay key configuration for online payments
- Order tracking for customers (by order ID)
- Email notifications for orders

### P2
- Customer registration/accounts
- Order history for registered customers
- Product image upload (currently URL-based)
- Inventory management (stock tracking)
- Promo codes / discounts system

## Next Tasks
1. Configure Razorpay with real API keys
2. Add customer order tracking page
3. Add email notifications (order confirmation)
4. Customer accounts with order history
