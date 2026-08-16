# Chaska Project Memory

Last updated: 2026-08-10

## Current Architecture

- Frontend: React 19, Tailwind CSS, Shadcn UI, React Router, Axios.
- Backend: FastAPI with Motor.
- Database: MongoDB is the runtime source for products, prices, reviews, users, sessions, orders, and contacts.
- Authentication: Argon2id passwords, legacy bcrypt upgrade, short-lived JWT access cookies, rotating refresh sessions, MongoDB-backed rate limits, login lockout, and secure production cookie/CORS settings.
- Order security: the backend calculates product prices and totals from MongoDB. Client-supplied prices are rejected.
- Secrets remain in ignored `.env` files and must never be committed to this memory file.

## Landing-Page Reviews

The landing-page review feature is implemented.


Everything is working now.
Frontend: http://localhost:3000 — HTTP 200
Backend: http://localhost:8001 — healthy
MongoDB Atlas: connected
Phone registration: tested successfully
Authenticated session: tested successfully
Temporary test account/session: removed
The failure was Atlas blocking the current public IP. After you added it, TLS connected successfully. I also rebuilt the backend environment with Python 3.12 and OpenSSL 3.
Hard-refresh the login page with Cmd + S


Backend:
cd /Users/baibhavrath/Chaska/chaska/backend
source .venv/bin/activate
uvicorn server:app --host 127.0.0.1 --port 8001

Run this command in Terminal:
curl -fsS https://api.ipify.org && echo
For MongoDB Atlas, append /32:
echo "$(curl -fsS https://api.ipify.org)/32"

Frontend:
cd /Users/baibhavrath/Chaska/chaska/frontend
npm start
### Frontend

- Reusable component: `frontend/src/components/ReviewsSection.js`.
- Integrated into `frontend/src/pages/Home.js`.
- Styling and animations are in `frontend/src/index.css`.
- Displays approved reviews from `GET /api/reviews`.
- Uses a modern, responsive, continuously scrolling review rail.
- Includes an average-rating summary, star ratings, reviewer initials, loading state, and polished glass-style cards.
- Includes pause/resume controls.
- Auto-scrolling pauses on hover or keyboard focus.
- `prefers-reduced-motion` disables automatic animation and leaves the rail manually scrollable.
- Duplicate animation cards are hidden from assistive technology and are not rendered in reduced-motion mode.
- The review form is an accessible dialog with:
  - full name;
  - private email address;
  - 1–5 star rating;
  - review/comment with a character counter.
- The form provides validation, loading, error, and success states.

### Backend and MongoDB

- Review input model requires:
  - `customer_name`: 2–120 characters;
  - valid `email`;
  - `rating`: 1–5;
  - `comment`: 10–1000 characters.
- Names and comments are whitespace-normalized.
- `POST /api/reviews` is limited to five submissions per IP per hour.
- New website submissions are stored with:
  - `status: "pending"`;
  - `source: "website"`.
- Reviewer email is stored privately for moderation and is never returned by the public review endpoint.
- `GET /api/reviews` returns only documents with `status: "approved"` and uses an explicit public-field projection.
- MongoDB has an index on `(status, created_at)` for the public review query.
- Five sample reviews currently exist in MongoDB with `status: "approved"` and `source: "sample"`.
- Sample reviews are visibly labelled as sample content in the UI; approved website submissions are labelled as community reviews.
- Sample/catalog migration script: `backend/scripts/migrate_catalog_to_mongodb.py`.

### Publishing Workflow

1. A visitor submits a review from the landing-page dialog.
2. The backend validates and stores it as `pending`.
3. It remains hidden from `GET /api/reviews` while pending.
4. Set its MongoDB `status` to `approved` after moderation.
5. It then appears automatically in the landing-page review rail.

An admin review-moderation interface has not been added yet; approval currently happens directly in MongoDB.

## Review Feature Verification

- Frontend production build: passed.
- Backend security/model tests: 16 passed.
- Python compilation and diff checks: passed.
- MongoDB startup/index initialization: passed.
- Live MongoDB review count: 5 approved sample reviews.
- Public review endpoint returned 5 reviews.
- Publicly exposed reviewer email fields: 0.

## Relevant Files

- `frontend/src/components/ReviewsSection.jsx`
- `frontend/src/pages/Home.jsx`
- `frontend/src/index.css`
- `backend/server.py`
- `backend/scripts/migrate_catalog_to_mongodb.py`
- `backend/tests/test_auth_security_unit.py`
- `backend/tests/test_italian_desserts.py`
- `memory/architecture.md`

## Customer-Only Ordering

Updated: 2026-08-10

- The main navigation label formerly shown as `Track Order` is now `Orders` and links to `/my-orders`.
- The customer account menu also uses the label `Orders`.
- `/checkout` and `/my-orders` are wrapped in the reusable `frontend/src/components/CustomerRoute.jsx` guard.
- Visitors who open checkout without a session are redirected to `/login` and returned to checkout after successful login or registration.
- Admin accounts are redirected away from customer-only pages.
- `POST /api/orders` now requires an authenticated account with `role: "customer"`.
- Every new order is always associated with the authenticated customer's `user_id`.
- `GET /api/my-orders` also requires the customer role.
- The backend returns `401` without a valid session and `403` for a logged-in non-customer account.
- Public capability-token tracking remains available for previously created guest orders and order-confirmation links.
- Verification completed with a successful frontend production build and 19 passing backend security/model tests.

## Production Hardening and Release Preparation

Updated: 2026-08-16

- The repository-local Git identity is `BR2225 <baibhavkumarrath@gmail.com>`.
- Backend runtime dependencies were upgraded and separated from development tooling. FastAPI is 0.141.1, Starlette resolves to 1.6.0, PyMongo is 4.17.0, PyJWT is 2.13.0, python-dotenv is 1.2.2, and Uvicorn is 0.40.0.
- Backend production startup now requires a strong JWT secret, explicit CORS origins, and explicit allowed hosts. Razorpay keys must be configured as a pair, production accepts live-mode keys only, and live online payments require a webhook secret.
- Admin bootstrap credentials are optional but must be configured together. They should be removed after the first successful seed because the stored admin account uses an Argon2id hash.
- FastAPI documentation is disabled in production, trusted-host and gzip middleware are enabled, cross-site mutation requests are rejected, and security/HSTS response headers are applied.
- Order creation has a customer rate limit and refuses Razorpay orders when the provider is unavailable.
- Razorpay order creation uses a MongoDB concurrency lock and the server-authoritative total. Payment confirmation requires signature verification plus a server-to-server payment fetch proving captured status, exact provider order ID, INR currency, and exact amount.
- Razorpay webhooks use raw-body HMAC verification and durable MongoDB idempotency. Capture, failure, refund, and dispute events update payment state without double-applying an event.
- The frontend lazily loads the official Razorpay checkout script, disables online payment when configuration is unavailable, safely reuses pending orders, supports payment retry from Orders, and preserves uncertain verification as processing instead of falsely confirming it.
- A shared Axios client now rotates the refresh session once and retries a failed authenticated request, preventing an access-cookie expiry from interrupting checkout or admin work.
- Route-level code splitting reduced the main production JavaScript chunk to approximately 333 kB, and ESLint is now a required quality gate.
- Production images were added for a non-root FastAPI backend and an unprivileged Nginx frontend. Compose uses a private backend network, read-only filesystems, dropped capabilities, `no-new-privileges`, health checks, and same-origin `/api` proxying with sanitized forwarding headers.
- GitHub Actions now runs backend tests/dependency checks, frontend lint/audit/build, and both production image builds on pushes and pull requests.
- Deployment, TLS, Atlas, secret rotation, backup, rollback, monitoring, and Razorpay webhook/capture instructions are documented in `docs/production-deployment.md`.

### Final verification

- Backend: Python compilation passed; 26 unit/model tests passed; 35 opt-in live API tests skipped; `pip check` passed; `pip-audit` found no known vulnerabilities.
- Frontend: ESLint passed with zero warnings; Vite production build passed; `npm audit` found zero vulnerabilities; the container build's clean `npm ci` also audited 458 packages with zero vulnerabilities.
- Containers: backend and frontend images built successfully. The backend imported under non-root/read-only restrictions, and the frontend became healthy and served the `/login` SPA fallback under non-root/read-only restrictions.
- Compose schema validation and Git whitespace checks passed.

### Required before accepting real customer traffic

- Rotate every credential previously shared in chat, screenshots, or local notes, especially the MongoDB database-user password, and update the deployment secret store.
- Configure a real HTTPS domain, Atlas IP restrictions/backups, live Razorpay keys, automatic capture, and the signed webhook subscriptions listed in the deployment guide.
- Email/phone ownership verification and self-service password recovery still require an external email/SMS provider and are not implemented. Do not market registration as verified identity until those flows are added.
