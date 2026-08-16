# Chaska storefront architecture

## Repository boundary

This repository is frontend-only. It contains the React 19/Vite 8 storefront, static assets, frontend CI, and Vercel configuration. The FastAPI API, MongoDB access, payment verification, server-side pricing, tests, Docker image, and backend deployment configuration live in [BR2225/chaska_backend](https://github.com/BR2225/chaska_backend).

```text
Browser
  |
  | HTTPS + credentialed requests
  v
chaska.co (Vercel/Vite)
  |
  | VITE_BACKEND_URL=https://api.chaska.co
  v
api.chaska.co (FastAPI service)
  |
  +-- MongoDB Atlas
  +-- Razorpay API and webhook
```

## Frontend structure

```text
src/
  App.jsx                 routes and lazy-loaded pages
  components/             shared storefront and UI components
  config/api.js           build-time API-origin normalization
  contexts/AuthContext.jsx cookie-session state and auth actions
  contexts/CartContext.jsx local cart state
  lib/http.js             credentialed Axios client and refresh retry
  lib/razorpay.js         Razorpay checkout loader
  pages/                  customer and admin screens
public/                   brand assets
vercel.json               SPA route fallback
```

## Runtime contract

- All API paths remain prefixed with `/api`.
- `VITE_BACKEND_URL` is the API origin and must not end with a path or contain a secret.
- Axios uses `withCredentials: true`; the API owns HTTP-only access and refresh cookies.
- The access-cookie refresh is single-flight so concurrent 401 responses do not rotate the refresh session repeatedly.
- `/checkout`, `/my-orders`, the cart entry point, menu add-to-cart, and contact submission require a customer session in the UI; the API enforces authorization independently.
- Product display prices are informational. The API recalculates every order from MongoDB and verifies Razorpay amounts server-side.

## Deployment contract

- The storefront is built from the repository root with `npm ci && npm run build`; output is `build/`.
- Vercel serves the SPA and rewrites non-file routes to `index.html`.
- The API is deployed and rolled back independently from the backend repository.
- Production uses `chaska.co` and `api.chaska.co` so secure `SameSite=Lax` cookies remain same-site.
- Backend CORS must list exact storefront origins and allow credentials; wildcard origins are invalid for this authentication design.
