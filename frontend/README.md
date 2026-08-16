# Chaska frontend

The storefront is a React 19 application built with Vite 8.

```bash
npm install
npm run dev
```

Development runs on `http://localhost:3000`. Configure `VITE_BACKEND_URL` in `.env` when the API is on another origin. Leave it empty in the production container so Nginx can proxy same-origin `/api` requests.

Quality commands:

```bash
npm run lint
npm audit --audit-level=low
npm run build
```

Use `npm ci` in CI and deployments so installs match `package-lock.json`. Full production instructions are in the repository's `docs/production-deployment.md`.
