# Frontend deployment

The production layout uses separate deployments under the same parent domain:

- storefront: Vercel at `https://chaska.co` and `https://www.chaska.co`;
- API: the `chaska_backend` service at `https://api.chaska.co`.

This keeps independent builds and rollbacks while allowing secure cookies to remain same-site.

## Vercel project

Import `BR2225/chaska` as one Vite project. Use these settings:

```text
Root Directory: .
Framework Preset: Vite
Install Command: npm ci
Build Command: npm run build
Output Directory: build
Node.js: 22.x
```

Do not select Vercel's multi-service mode and do not add a backend service. The repository contains only the storefront.

Set this variable for Production and the preview environments that should use the production API:

```dotenv
VITE_BACKEND_URL=https://api.chaska.co
```

Only the public API origin belongs in the frontend environment. Never copy `MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, or admin credentials into Vercel.

## Domain and API coordination

Add both `chaska.co` and `www.chaska.co` to the Vercel project and select one canonical redirect. Point `api.chaska.co` to the backend platform, not Vercel.

The backend production environment must include:

```dotenv
CORS_ORIGINS=https://chaska.co,https://www.chaska.co
ALLOWED_HOSTS=api.chaska.co,<backend-platform-hostname>
COOKIE_SAMESITE=lax
APP_ENV=production
```

The frontend sends credentialed requests. Keep the storefront and API under `*.chaska.co`; authentication on unrelated Vercel preview domains is intentionally not part of the production cookie posture. Use a dedicated staging API and staging domain for authenticated preview testing.

## Release order

1. Deploy and verify the backend at its platform hostname.
2. Attach `api.chaska.co`, configure Atlas and Razorpay, and verify `GET https://api.chaska.co/api/health`.
3. Add the exact storefront origins to backend CORS and allowed-host settings.
4. Deploy this repository with `VITE_BACKEND_URL=https://api.chaska.co`.
5. Test registration, login/refresh/logout, products, cart, COD, Razorpay, Orders, contacts, reviews, and admin operations.

Vite replaces `VITE_BACKEND_URL` at build time. Changing it requires a new Vercel deployment.
