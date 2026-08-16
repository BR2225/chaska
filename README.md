# Chaska

Chaska is a MongoDB-backed dessert ordering application with a React/Vite storefront, FastAPI API, customer and admin authentication, review moderation, server-authoritative pricing, order tracking, Cash on Delivery, and Razorpay payments.

## Architecture

- `frontend/`: React 19, Vite 8, Tailwind CSS, and an Nginx production image.
- `backend/`: FastAPI, PyMongo's async client, Argon2id, rotating cookie sessions, and Razorpay integration.
- MongoDB Atlas: products, customers, sessions, orders, payment events, reviews, contacts, and rate-limit buckets.
- `compose.production.yaml`: same-origin frontend/API deployment. Nginx serves the SPA and proxies `/api` to FastAPI.

## Local development

Create the backend environment file and replace every placeholder:

```bash
cp backend/.env.example backend/.env
```

Start the API:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements-dev.txt
uvicorn server:app --reload --port 8001
```

In a second terminal, start the web app:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`. The local frontend uses `VITE_BACKEND_URL` from `frontend/.env`; production uses the same origin and proxies `/api`.

To seed a new database's product catalog, run this once from `backend/`:

```bash
python scripts/migrate_catalog_to_mongodb.py
```

The migration preserves matching products unless `--overwrite` is intentionally supplied.

## Verification

```bash
cd backend
python -m pytest -q
python -m pip check
python -m pip_audit -r requirements.txt

cd ../frontend
npm run lint
npm audit --audit-level=low
npm run build
```

Live API tests are opt-in: set `BACKEND_TEST_URL` to a disposable test deployment. Do not run them against production because they create accounts and orders.

## Production deployment

The supported container deployment is documented in [docs/production-deployment.md](docs/production-deployment.md). After creating `backend/.env`, build and run it with:

```bash
docker compose -f compose.production.yaml up -d --build
```

The container listens on port `8080` by default. Place it behind an HTTPS load balancer or reverse proxy before exposing it publicly. CI repeats backend tests and audits, frontend lint/audit/build, and both container builds on every pull request and push to `main`.

## Security properties

- Checkout accepts product IDs, sizes, and quantities only; all prices and totals are recalculated from MongoDB.
- Customers must authenticate before using cart checkout, orders, or contact features.
- Passwords use Argon2id; legacy bcrypt hashes are upgraded after a successful login.
- Access cookies are short-lived and refresh cookies rotate against server-side MongoDB sessions.
- Login, registration, reviews, contacts, and order creation have MongoDB-backed rate limits.
- Razorpay success requires a valid signature plus a server-fetched, captured payment with the exact order ID, currency, and amount.
- Razorpay webhooks are signed, durably idempotent, and handle capture, failure, refund, and dispute events.
- `.env` files and credentials are excluded from Git and Docker build contexts.

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.
