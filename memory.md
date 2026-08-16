# Chaska project memory

Last updated: 2026-08-16

## Repository split

- `https://github.com/BR2225/chaska` is the frontend-only React/Vite storefront.
- `https://github.com/BR2225/chaska_backend` is the FastAPI API, MongoDB integration, backend tests, Docker image, and Render blueprint.
- Both repositories use the local Git identity `BR2225 <baibhavkumarrath@gmail.com>`.
- Backend history was preserved when it was extracted; it was not copied as a single unrelated code dump.
- Local ignored frontend and backend `.env` files were moved to the appropriate repository and remain untracked.

## Production topology

- Storefront: Vercel, `https://chaska.co` (and optional `www` redirect).
- API: independently deployed Docker service, `https://api.chaska.co`.
- Database: MongoDB Atlas, reachable only from approved backend egress networks.
- Frontend build variable: `VITE_BACKEND_URL=https://api.chaska.co`.
- The backend allows the exact storefront origins through credentialed CORS and uses secure HTTP-only cookies.
- Keep the frontend and API under the same parent domain so `SameSite=Lax` authentication works without weakening the production cookie policy.

## Implemented storefront behavior

- React 19, Vite 8, Tailwind CSS, Shadcn UI, React Router, and Axios.
- Customer registration/login, rotating-session refresh, logout, and customer route guards.
- Menu, product details, authenticated cart/add-to-cart and checkout, Orders, contacts, and reviews.
- Modern auto-scrolling review component with accessible controls and reduced-motion support.
- COD and Razorpay checkout, pending-payment reuse, and payment retry from Orders.
- Admin dashboard, products, orders, and contacts.
- Route-level code splitting and a shared credentialed HTTP client.

## Backend security contract

- MongoDB is authoritative for products, prices, users, sessions, orders, reviews, contacts, rate limits, and payment events.
- Order totals are recalculated on the server; browser-supplied prices are never trusted.
- Passwords use Argon2id; legacy bcrypt hashes upgrade after successful login.
- Access cookies are short-lived and refresh sessions rotate and can be revoked in MongoDB.
- Razorpay confirmation requires signature verification and a server-to-server check of captured state, provider order, INR currency, and exact amount.
- Razorpay webhooks are HMAC-verified and idempotently stored.
- Reviews are submitted as pending; only approved reviews are returned publicly and reviewer email remains private.

## Deployment and secret rules

- Vercel deploys only this frontend repository from root; no frontend Dockerfile and no Vercel multi-service configuration are needed.
- The backend deploys only from `chaska_backend` and includes its own Dockerfile, CI, health check, and platform configuration.
- Never put MongoDB, JWT, Razorpay secret, webhook secret, or admin credentials in a `VITE_` variable.
- Never commit `.env` files. Rotate any credential previously exposed in chat, screenshots, source code, build output, or Git history.
- Configure the backend and custom API domain before building the production frontend because Vite embeds its API origin at build time.

## Remaining production work

- Rotate the previously shared MongoDB credential before accepting traffic.
- Configure restricted Atlas network access, backups, alerts, and a least-privilege database user.
- Deploy the backend and attach `api.chaska.co`.
- Configure live Razorpay keys, automatic capture, signed webhooks, refunds, and dispute monitoring.
- Deploy the frontend with the final API URL and complete end-to-end release tests.
- Email/phone ownership verification, password recovery, and a review-moderation UI still need external providers/product work.

## Verification baseline

- Backend extraction: 26 tests passed, 35 opt-in live API tests skipped, `pip check` passed, and `pip-audit` found no known vulnerabilities.
- Frontend must pass `npm run lint`, `npm audit --audit-level=low`, and `npm run build` after every change.
