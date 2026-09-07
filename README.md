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

## Local database note

Prefer `docker compose up -d` for Postgres + Redis. If Docker Desktop is unavailable, a local PostgreSQL instance works with the same `DATABASE_URL` in `.env` (user `schoolmart` / password `schoolmart_dev` / database `schoolmart`). Redis is optional until Phase 3.

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development |
| `pnpm build` | Build all apps |
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
