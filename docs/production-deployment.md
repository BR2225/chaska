# Production deployment

This deployment serves the React application and `/api` from one public origin. That keeps secure cookies and Razorpay callbacks straightforward and avoids unnecessary cross-origin exposure.

## 1. Prepare infrastructure

- Use a Linux host or container platform with Docker and Compose.
- Put port `8080` behind an HTTPS load balancer or trusted reverse proxy. Redirect HTTP to HTTPS at that edge.
- Use a dedicated MongoDB Atlas database user with only the permissions this application needs. Restrict Atlas network access to deployment egress addresses and enable backups and alerts.
- Store `.env` values in the platform's secret manager when available. Never bake them into either image.
- Rotate any database, admin, JWT, or Razorpay credentials that have previously been shared in chat, screenshots, logs, or source files before launch.

## 2. Configure the API

Copy `backend/.env.example` to `backend/.env`. Production must include these settings:

```dotenv
APP_ENV=production
MONGODB_URI=mongodb+srv://<dedicated-user>:<url-encoded-password>@<cluster>/<database>
DB_NAME=chaska
JWT_SECRET=<at-least-32-random-characters>
ALLOWED_HOSTS=shop.example.com,127.0.0.1,localhost
CORS_ORIGINS=https://shop.example.com
TRUST_PROXY_HEADERS=true
COOKIE_SAMESITE=lax
```

Generate a JWT secret with a cryptographically secure generator, for example `openssl rand -hex 32`. Do not reuse the admin password, MongoDB password, or Razorpay secret.

`TRUST_PROXY_HEADERS=true` is safe with the included Nginx configuration because it replaces client-supplied forwarding headers. If the API is deployed separately, enable this only behind a proxy that performs the same sanitization.

For the first startup only, set both `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD`. After the admin is stored in MongoDB, remove both bootstrap values and restart; normal admin login continues using the stored Argon2id hash.

## 3. Configure Razorpay

For live online payments, also set:

```dotenv
RAZORPAY_KEY_ID=rzp_live_<value>
RAZORPAY_KEY_SECRET=<secret>
RAZORPAY_WEBHOOK_SECRET=<separate-webhook-secret>
```

In the Razorpay dashboard:

1. Enable automatic capture so successful payments reach the `captured` state expected by the API.
2. Create a webhook for `https://shop.example.com/api/payments/razorpay/webhook`.
3. Subscribe to `payment.captured`, `order.paid`, `payment.failed`, `refund.processed`, and `payment.dispute.created`.
4. Enter the same dedicated webhook secret in Razorpay and `backend/.env`.
5. Complete an end-to-end live-mode smoke test with the smallest valid order, then refund it and confirm the order records the refund.

The key secret and webhook secret must remain backend-only. The frontend obtains only the public key ID and provider order ID from the API.

## 4. Build and start

From the repository root:

```bash
docker compose -f compose.production.yaml build
docker compose -f compose.production.yaml up -d
docker compose -f compose.production.yaml ps
```

Set `CHASKA_HTTP_PORT` if the host port must differ from `8080`. The backend is not published to the host; it is reachable only through the frontend proxy.

Verify before routing customer traffic:

```bash
curl --fail http://127.0.0.1:8080/healthz
curl --fail http://127.0.0.1:8080/api/health
```

Then verify through the public HTTPS origin: registration, login/logout, session refresh, menu loading, COD checkout, Razorpay checkout, Orders, order tracking, review submission, contact submission, and admin order updates.

## 5. Operate safely

- Ship application and proxy logs to centralized storage, redact PII, and alert on repeated 5xx responses, failed webhooks, unhealthy containers, MongoDB connection failures, and payment disputes.
- Keep at least one tested Atlas backup and rehearse restore procedures.
- Roll out immutable image tags and keep the previous known-good images available for rollback.
- Run the repository CI gates before deployment; do not bypass failed tests, audits, lint, or image builds.
- Review pending customer reviews before changing their MongoDB `status` to `approved`.
- Rotate admin and payment credentials on staff changes and immediately after suspected exposure.
- Scale the backend by adding container replicas, not by mutating running containers. MongoDB indexes and payment-event idempotency support multiple instances.
