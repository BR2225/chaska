# Chaska storefront

React/Vite storefront for Chaska. The FastAPI service lives in the separate [chaska_backend repository](https://github.com/BR2225/chaska_backend).

## Local development

```bash
cp .env.example .env
npm ci
npm run dev
```

Set `VITE_BACKEND_URL=http://localhost:8001` while the API runs locally. Open `http://localhost:3000`.

## Verification

```bash
npm run lint
npm audit --audit-level=low
npm run build
```

## Deployment

Deploy this repository to Vercel as a Vite project with the repository root (`.`) as the root directory. Set this production environment variable:

```dotenv
VITE_BACKEND_URL=https://api.chaska.co
```

The checked-in `vercel.json` provides the single-page application fallback. The API must allow the exact storefront origins and set secure authentication cookies. See [docs/frontend-deployment.md](docs/frontend-deployment.md) for the complete setup and release order.

Do not put MongoDB, JWT, admin, or Razorpay secrets in Vercel. A `VITE_` variable is compiled into public browser JavaScript and is never secret.

See [SECURITY.md](SECURITY.md) for responsible vulnerability reporting.
