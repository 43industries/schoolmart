# SchoolMart debug audit

Date: 2026-09-14  
Scope: local monorepo (`localhost:3000` web + `localhost:4000` API)  
Tracks: security/quality review, audit+smoke fixes, observability, IDE debugger

## Severity legend

| Level | Meaning |
|-------|---------|
| Critical | Exploitable or data-loss in production as configured |
| High | Likely to break auth/sessions or money flows |
| Medium | Operational / maintainability risk |
| Low | Tech debt; acceptable short-term |

## Findings

### Auth dual path (cookies + sessionStorage Bearer) — High

- Login sets httpOnly cookies **and** returns tokens in JSON ([`apps/api/src/modules/auth/auth.routes.ts`](../apps/api/src/modules/auth/auth.routes.ts)).
- Web stores `accessToken` in `sessionStorage` and sends `Authorization: Bearer` ([`apps/web/src/lib/api.ts`](../apps/web/src/lib/api.ts)).
- Middleware accepts Bearer **or** cookie ([`apps/api/src/middleware/auth.ts`](../apps/api/src/middleware/auth.ts)).
- **Gap (pre-fix):** client did not call `POST /auth/refresh` on bootstrap, so hard refresh cleared `sessionStorage` and looked logged-out even if refresh cookie existed.
- **Fix in this pass:** bootstrap refresh when no session token; then `me()`.

### Soft secret defaults — Critical (production) / Low (local)

- [`apps/api/src/config.ts`](../apps/api/src/config.ts) falls back to `dev-secret-change-me` / `dev-cookie-secret` if env unset.
- **Deferred:** hosted secret rotation. Local `.env` should always set strong values before any shared deploy.

### CORS / env pitfalls — High (cross-origin deploys)

- API CORS allowlist: `WEB_URL`, localhost, and LAN only in development ([`apps/api/src/index.ts`](../apps/api/src/index.ts)).
- Web build-time `NEXT_PUBLIC_API_URL` must match the live API.
- Prod cookies use `SameSite=None; Secure` when `NODE_ENV=production`.

### Wallet mock fund — Medium

- `POST /parents/wallets/fund` credits balance with mock M-PESA reference (no payment rail).
- Wallets only for **ACTIVE** parent–child links.
- Acceptable for demo; not production payment-safe.

### Parent register → login handoff — Medium

- Register creates user + pending/approved link request; redirects to login (no auto-login).
- Wallet UI empty until school approves link (or seed ACTIVE links).

### Test gap — Medium

- Only API Vitest: `schemas.test.ts`, `shared.test.ts`.
- No web unit tests, no e2e (Playwright/Cypress).
- **This pass:** add login identifier resolution unit tests.

### Rate limit — Low

- Global 100 req/min per IP. Unlikely to block normal login; may affect aggressive smoke scripts.

## Fixed in this pass vs deferred

| Item | Status |
|------|--------|
| Client `/auth/refresh` on bootstrap | Fixed |
| Login email/phone lookup + race (prior commits) | Fixed |
| API `requestId` on errors + always-on warn/error logs | Fixed |
| `ApiError.requestId` on web | Fixed |
| Logout without body (`Content-Type` only when body present) | Fixed |
| `.vscode` launch/tasks | Fixed |
| Login identifier unit tests | Fixed |
| ESLint configs (API/shared flat; web `.eslintrc.json`) | Fixed |
| Real M-PESA / e2e suite / prod secret rotation | Deferred |

## How to debug in Cursor / VS Code

1. Open the repo root in Cursor.
2. Press **F5** (or Run and Debug).
3. Pick **Debug API**, **Debug Web (Next)**, or **Debug API + Web**.
4. Set breakpoints in `apps/api/src/**/*.ts` or `apps/web/src/**/*.tsx`.
5. Ensure root `.env` exists (`DATABASE_URL`, `JWT_SECRET`, etc.).

## Smoke results

API/cookie smoke against local `localhost:4000` (2026-09-14). Password: `Demo@SchoolMart2026`.

| Check | Result |
|-------|--------|
| `GET /health` | PASS |
| Parent login `parent1@demo.ke` | PASS (`/users/me` returns profile) |
| Hard refresh via cookie `POST /auth/refresh` then `me` | PASS |
| Admin login `admin@schoolmart.demo` | PASS (`SUPER_ADMIN`) |
| Wallet fund + rule (ACTIVE child) | PASS (fund balance + rule id) |
| Logout clears session | PASS (refresh rejected after logout) |
| Error responses include `requestId` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS (web: 2 pre-existing hooks warnings only) |
| `pnpm test` | PASS (20 tests, including 6 auth-login) |

### Extra fix found by smoke

- Web `api()` always sent `Content-Type: application/json` even with no body, which made Fastify reject `POST /auth/logout` (`Unsupported Media Type`). Fixed: set Content-Type only when a body is present.
