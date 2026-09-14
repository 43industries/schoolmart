# SchoolMart

Parent-funded student commerce and delivery platform for Kenyan schools.

## Architecture

- **Monorepo:** pnpm + Turborepo
- **Web:** Next.js 15, React, TypeScript, Tailwind CSS
- **API:** Fastify, TypeScript, REST `/api/v1`
- **Database:** PostgreSQL 16 + Prisma
- **Auth:** Custom sessions (JWT access + revocable refresh tokens), backend RBAC

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL and Redis)

### Setup

```bash
# Clone and install
pnpm install

# Copy environment
cp .env.example .env

# Start database
docker compose up -d

# Run migrations and seed
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# Start development
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:4000
- API Health: http://localhost:4000/health

## Demo Accounts

All demo accounts use password: `Demo@SchoolMart2026`

| Role | Email | Portal |
|------|-------|--------|
| Super Admin | admin@schoolmart.demo | /admin |
| School Admin | admin@greenfield.demo | /school |
| Parent | parent1@demo.ke | /parent |
| Student | student.brian@demo.ke | /student |
| Vendor (Kitchen) | vendor.kitchen@demo.ke | /vendor |
| Vendor (Stationery) | vendor.stationery@demo.ke | /vendor |
| Finance | finance@schoolmart.demo | /admin |
| Support | support@schoolmart.demo | /admin |

Demo student collection PIN: `1234`

## Project Structure

```
schoolmart/
  apps/
    web/          # Next.js frontend
    api/          # Fastify REST API
  packages/
    db/           # Prisma schema, client, seed
    shared/       # Enums, Zod schemas, utilities
    config/       # Shared TS/ESLint config
```

## Phase 1 Features

- [x] Project scaffolding (monorepo, Docker, env)
- [x] Database schema (identity, schools, forward-compatible stubs)
- [x] Authentication (register, login, logout, refresh, password reset)
- [x] RBAC (8 roles, backend-enforced)
- [x] School management (CRUD, public listing)
- [x] Student management (school-scoped)
- [x] Parent-student linking (with school approval workflow)
- [x] Audit logging
- [x] Marketing website (landing, about, how-it-works, FAQ)
- [x] Parent portal (dashboard, children, link child, settings)
- [x] School admin portal (dashboard, students, parent link approvals)
- [x] Super admin portal (dashboard, schools, audit logs)
- [x] Demo seed data
- [x] Unit tests (schemas, phone, money utilities)

## Phase 2 Features

- [x] Vendors (admin CRUD + approval status)
- [x] Categories and products with inventory
- [x] School-specific catalog approval (vendors + products)
- [x] Parent catalog search/filter by school
- [x] Parent cart (add/update items, stock checks)
- [x] Portal UI: `/parent/shop`, `/parent/cart`, `/school/catalog`, `/admin/vendors`, `/admin/products`

## Deploy

Recommended split: **Vercel (web)** + **Render or Railway (API + Postgres)**.

> **Laptop Chrome vs Cursor:** Cursor uses `http://localhost:3000` → local API `:4000`. On Vercel, prefer **same-origin proxy**: set `API_ORIGIN` to your Render host (no `/api/v1`). The browser calls `/api/v1` on Vercel; Next rewrites to Render. That avoids `NEXT_PUBLIC_*` / Turbo env issues and CORS. After changing env, **redeploy** (and clear any overridden Build Command in Vercel UI so `vercel.json` is used).

### 1a. Render — API + Postgres (current production)

1. [Render](https://render.com) → New **Web Service** from GitHub `43industries/schoolmart`.
2. Add a **PostgreSQL** database and copy its `DATABASE_URL` into the web service.
3. Service settings (monorepo **root**, not `apps/api`):

| Setting | Value |
|---------|--------|
| Root Directory | *(empty / repo root)* |
| Build Command | `pnpm install && pnpm build:api` |
| Start Command | `pnpm start:api` |
| Node | **20+** |
| Health Check Path | `/health` |

4. Environment variables:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | From Render Postgres |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Long random string |
| `COOKIE_SECRET` | Long random string |
| `WEB_URL` | Your Vercel origin, e.g. `https://schoolmart-api.vercel.app` |
| `DEMO_PASSWORD` | Only if you seed demo accounts |

5. Deploy. Check `https://<your-service>.onrender.com/health` → `{"status":"ok",...}`.
6. Optional seed against the Render DB: `pnpm db:seed` (from a machine with `DATABASE_URL` set).

Copy the public API base for Vercel: `https://<your-service>.onrender.com/api/v1`.

### 1b. Railway — API + Postgres (alternative)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select `43industries/schoolmart`.
2. Add a **PostgreSQL** plugin to the project.
3. On the API service (the GitHub-linked service):
   - Leave **Root Directory** empty (monorepo root).
   - Railway will use [`railway.toml`](railway.toml): builds with `pnpm build:api`, starts with `pnpm start:api` (runs migrations, then the API).
4. Set variables on the API service (Variables tab):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | From the Postgres plugin (Railway can reference `${{Postgres.DATABASE_URL}}`) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | Long random string |
| `COOKIE_SECRET` | Long random string |
| `WEB_URL` | Your Vercel URL, e.g. `https://schoolmart.vercel.app` |
| `DEMO_PASSWORD` | Only if you seed demo accounts |

5. Deploy. Open the public URL → check `https://<your-api>/health`.
6. Optional seed (one-off in Railway shell / local against prod DB):

```bash
pnpm db:seed
```

Copy the Railway public API URL, e.g. `https://schoolmart-api-production.up.railway.app`.

### 2. Vercel — web

1. Import the same GitHub repo into [Vercel](https://vercel.com).
2. Set **Root Directory** to `apps/web` and **include files outside the root directory**.
3. Env (Production — and Preview if you use preview URLs):

| Variable | Value |
|----------|--------|
| `API_ORIGIN` | `https://<your-service>.onrender.com` (**recommended** — no `/api/v1` suffix) |
| `NEXT_PUBLIC_API_URL` | Optional. Only if you want the browser to call Render directly: `https://<your-service>.onrender.com/api/v1` |

If both are unset, the Vercel build fails on purpose. Prefer `API_ORIGIN` only.

4. **Build & Development Settings:** leave **Build Command** empty (use `vercel.json`) or set exactly:  
   `cd ../.. && pnpm --filter @schoolmart/web build`  
   Do **not** keep an old Turbo build command override.
5. **Redeploy** after setting env (disable build cache once).
6. Set the API host’s `WEB_URL` to the Vercel origin. With the proxy, browsers talk to Vercel only; `WEB_URL` still matters for cookies/CORS on direct API calls.

### Cross-origin auth

Production cookies use `SameSite=None; Secure` for direct browser→API calls. With the **`API_ORIGIN` proxy**, the browser stays same-origin to Vercel (`/api/v1`), which avoids loopback/CORS problems.

### Login checklist if Chrome fails but Cursor works

1. Confirm you are on the **Vercel** URL in Chrome (not only Cursor’s localhost).
2. DevTools → Network → login should be `https://<vercel>/api/v1/auth/login` (proxy) or `https://<render>/api/v1/auth/login` (direct) — **never** `localhost:4000`.
3. Open `https://<render-host>/health` in Chrome — must return OK.
4. Vercel has `API_ORIGIN` (or `NEXT_PUBLIC_API_URL`) + fresh redeploy; no stale Build Command override.

### Local database note

Prefer `docker compose up -d` for Postgres + Redis. If Docker Desktop is unavailable, a local PostgreSQL instance works with the same `DATABASE_URL` in `.env` (user `schoolmart` / password `schoolmart_dev` / database `schoolmart`). Redis is optional until Phase 3.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development |
| `pnpm build` | Build all apps |
| `pnpm build:web` | Build web + shared deps (Vercel) |
| `pnpm build:api` | Build API + shared/db deps (Render/Railway) |
| `pnpm start:api` | Migrate DB then start API |
| `pnpm test` | Run all tests |
| `pnpm lint` | Lint all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:migrate` | Run database migrations |
| `pnpm db:seed` | Seed demo data |
| `pnpm db:studio` | Open Prisma Studio |

## API Endpoints (Phase 1)

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/refresh
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/schools
GET    /api/v1/schools/:id
GET    /api/v1/schools/:id/students        (school admin)
POST   /api/v1/schools/:id/students        (school admin)
GET    /api/v1/schools/:id/parent-links/pending  (school admin)
POST   /api/v1/schools/:id/parent-links/:linkId/approve
POST   /api/v1/schools/:id/parent-links/:linkId/reject
GET    /api/v1/parents/children
POST   /api/v1/parents/children/link
POST   /api/v1/admin/schools               (super admin)
PATCH  /api/v1/admin/schools/:id
POST   /api/v1/admin/users
GET    /api/v1/admin/audit-logs
```

## Roadmap

- **Phase 2:** Marketplace (vendors, catalog, cart)
- **Phase 3:** Orders & payments (M-PESA mock, state machine)
- **Phase 4:** Student wallet (funding, rules, ledger)
- **Phase 5:** School operations (delivery batches, collection)
- **Phase 6:** Student experience (PIN/QR, collection UI)
- **Phase 7:** Vendor operations
- **Phase 8:** Logistics
- **Phase 9:** Admin finance
- **Phase 10:** Notifications, support, analytics
