# Campus Shelter – Backend API

RESTful backend for a student housing marketplace tailored to FUTA students and landlords. Students browse, book, review, and message. Landlords list and manage properties. Admins oversee users, properties, and analytics.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   Next.js 16 App Router                  │
│                  (API routes only — no UI)                │
│                                                          │
│  ┌────────────┐                                          │
│  │ proxy.ts   │ ─► API key validation + CORS headers     │
│  │ middleware  │    (runs before every /api/* request)    │
│  └─────┬──────┘                                          │
│        ▼                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │  Route     │  │  lib/auth.ts │  │ lib/validations  │ │
│  │  Handlers  │──│  JWT verify  │──│ Zod schemas      │ │
│  │  (app/api) │  │  RBAC checks │  │ Input parsing    │ │
│  └─────┬──────┘  └──────────────┘  └──────────────────┘ │
│        │                                                 │
│  ┌─────▼──────┐  ┌──────────────┐                        │
│  │ lib/       │  │ lib/         │                        │
│  │ responses  │  │ email.ts     │                        │
│  │ .ts        │  │ (Nodemailer) │                        │
│  └────────────┘  └──────────────┘                        │
│        │                                                 │
│  ┌─────▼──────────────────────────────────────────────┐  │
│  │              Prisma 7 ORM (PrismaPg)               │  │
│  └─────┬──────────────────────────────────────────────┘  │
└────────┼─────────────────────────────────────────────────┘
         │
    ┌────▼────┐
    │ Neon    │
    │ Postgres│
    └─────────┘
```

### Request Lifecycle

1. **Middleware** (`proxy.ts`) — validates `x-api-key` header, sets CORS headers, handles `OPTIONS` preflight.
2. **Authentication** — route handler calls `requireAuth(request)` which extracts and verifies the JWT from the `Authorization: Bearer` header.
3. **Authorisation** — `requireRole(user, "ADMIN")` (or other roles) enforces role-based access.
4. **Validation** — request body is parsed with Zod via `safeParse()`. Invalid input returns `400` with field-level errors.
5. **Business logic** — Prisma queries, status checks, data transformations.
6. **Response** — standardised JSON via helpers: `success()`, `paginated()`, `badRequest()`, `notFound()`, `forbidden()`, `serverError()`.

---

## Design Choices & Software Engineering Principles

### Separation of Concerns

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **Middleware** | `src/proxy.ts` | Cross-cutting: API key, CORS |
| **Route handlers** | `src/app/api/**/route.ts` | HTTP concerns: parse request, call logic, return response |
| **Auth** | `src/lib/auth.ts` | JWT signing/verification, password hashing, role checks |
| **Validation** | `src/lib/validations.ts` | All Zod schemas in one place |
| **Responses** | `src/lib/responses.ts` | Standardised response envelope |
| **Data** | `prisma/schema.prisma` | Single source of truth for the data model |

### DRY (Don't Repeat Yourself)

- **Response helpers** — every endpoint uses `success()`, `badRequest()`, `notFound()`, etc. instead of manually constructing `NextResponse.json()` objects.
- **Auth helpers** — `requireAuth()` and `requireRole()` are reused across all protected routes.
- **Validation schemas** — defined once in `validations.ts`, imported wherever needed.

### Fail-Fast Validation

Every endpoint validates input with Zod's `safeParse()` before touching the database. Invalid requests are rejected immediately with `400` and structured error details — no wasted DB queries.

### Defence in Depth

Security is enforced at multiple layers:
1. **API key** — middleware rejects requests without a valid `x-api-key`.
2. **JWT authentication** — `requireAuth()` verifies token signature and expiry.
3. **Role-based authorisation** — `requireRole()` checks the user's role enum.
4. **Business rules** — e.g., landlords must be `VERIFIED` to create properties; students must have an `APPROVED` booking to leave reviews.

### Consistent Error Handling

All route handlers follow the same try/catch pattern:
```typescript
try {
  // auth → validate → query → respond
} catch (error) {
  if (error instanceof AuthError) {
    return error.message === "Forbidden" ? forbidden("...") : unauthorized("...");
  }
  console.error("[Context]", error);
  return serverError("...");
}
```

Errors are logged with context prefixes (e.g. `[Admin Verify Landlord Error]`) and never expose internal details to the client.

### Single Source of Truth

- The **Prisma schema** is the sole definition of the data model. TypeScript types are auto-generated from it.
- **Zod schemas** are the sole definition of valid input shapes.
- **Environment variables** are validated at startup via `@t3-oss/env-nextjs` — the app won't boot with missing config.

---

## User Flows

### Authentication

```
POST /auth/register  ──► bcrypt hash password ──► store user ──► return JWT
POST /auth/login     ──► bcrypt compare ──► sign JWT (7d expiry) ──► return token
GET  /auth/me        ──► verify JWT ──► return current user (no password)
```

Password reset uses a secure token flow:
```
POST /forgot-password  ──► generate 64-char hex token ──► store with 1h expiry ──► email link
POST /reset-password   ──► validate token ──► hash new password ──► mark token used
```

### Landlord Verification

```
Register with role=LANDLORD ──► landlordStatus = PENDING
                                      │
Admin: PATCH /admin/users/:id/verify  │
       body: { status: "VERIFIED" }   │
                   │                  │
    ┌──────────────┼──────────────┐   │
    ▼              ▼              ▼   │
VERIFIED       REJECTED       SUSPENDED
    │
    ▼
Can create properties (POST /properties checks status)
```

### Property Lifecycle

```
Landlord: POST /properties  ──► status = PENDING_APPROVAL
                                      │
Admin: PATCH /admin/properties/:id/approve
       body: { status: "APPROVED" }
                   │
    ┌──────────────┼───────────────┐
    ▼              ▼               ▼
APPROVED        REJECTED        ARCHIVED
    │
    ▼
Visible in GET /properties listings
```

### Booking → Lease → Review

```
Student: POST /bookings        ──► status = PENDING
Landlord: PATCH /bookings/:id  ──► APPROVED or REJECTED
                                       │
                                   APPROVED
                                       │
                    ┌──────────────────┼──────────────────┐
                    ▼                  ▼                  ▼
           POST /leases        POST /reviews      POST /maintenance
           (landlord creates)  (student, 1 per    (student submits
                                property)          request)
```

---

## Tech Stack

| Concern | Technology |
|---------|------------|
| Framework | Next.js 16 (App Router, API-only) |
| Language | TypeScript 5 (strict) |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 (PrismaPg adapter) |
| Auth | JWT (jsonwebtoken) + bcrypt |
| Validation | Zod 4 |
| Email | Nodemailer |
| API docs | OpenAPI 3.0.3 / Swagger UI |
| Linting | Biome |
| Git hooks | Husky + lint-staged |
| Package manager | Bun (enforced) |

---

## Project Structure

```
src/
├── app/api/
│   ├── auth/           # register, login, me, forgot/reset/change-password
│   ├── properties/     # CRUD, search, filtering, reviews
│   ├── bookings/       # create, list, approve/reject
│   ├── leases/         # create, view
│   ├── reviews/        # create
│   ├── messages/       # send, list
│   ├── maintenance/    # create, list, update status
│   ├── documents/      # file upload
│   ├── admin/
│   │   ├── users/      # list users, verify landlord
│   │   ├── properties/ # approve/reject, update, delete
│   │   └── analytics/  # platform stats
│   ├── ping/           # health check
│   └── docs/           # OpenAPI spec
├── lib/
│   ├── auth.ts         # JWT, bcrypt, RBAC helpers
│   ├── email.ts        # Nodemailer transporter
│   ├── env.ts          # Type-safe env validation
│   ├── prisma.ts       # Prisma singleton
│   ├── responses.ts    # Response helpers
│   ├── swagger.ts      # OpenAPI spec definition
│   └── validations.ts  # All Zod schemas
└── proxy.ts            # Middleware (API key + CORS)

prisma/schema.prisma    # Database schema
```

---

## API Endpoints

### Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Register (student or landlord) |
| POST | `/api/auth/login` | No | Login, returns JWT |
| GET | `/api/auth/me` | Yes | Current user profile |
| POST | `/api/auth/forgot-password` | No | Request password reset email |
| POST | `/api/auth/reset-password` | No | Reset password with token |
| POST | `/api/auth/change-password` | Yes | Change password |

### Properties
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/properties` | No | — | List with filtering & pagination |
| POST | `/api/properties` | Yes | L/A | Create (landlord must be verified) |
| GET | `/api/properties/:id` | No | — | Details with reviews |
| PATCH | `/api/properties/:id` | Yes | L | Update own property |
| DELETE | `/api/properties/:id` | Yes | L/A | Delete property |
| GET | `/api/properties/:id/reviews` | No | — | Paginated reviews |

### Bookings
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/bookings` | Yes | Any | List (scoped by role) |
| POST | `/api/bookings` | Yes | S | Create booking |
| PATCH | `/api/bookings/:id` | Yes | L | Approve or reject |

### Leases, Reviews, Messages, Maintenance
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| POST | `/api/leases` | Yes | L | Create lease for approved booking |
| GET | `/api/leases/:id` | Yes | Any | View lease |
| POST | `/api/reviews` | Yes | S | Review (1 per property) |
| GET | `/api/messages` | Yes | Any | List conversations |
| POST | `/api/messages` | Yes | Any | Send message |
| GET | `/api/maintenance` | Yes | Any | List requests (scoped) |
| POST | `/api/maintenance` | Yes | S | Submit request |
| PATCH | `/api/maintenance/:id` | Yes | L/A | Update status |

### Admin
| Method | Path | Auth | Role | Description |
|--------|------|------|------|-------------|
| GET | `/api/admin/users` | Yes | A | List users (filter by role) |
| PATCH | `/api/admin/users/:id/verify` | Yes | A | Verify/reject landlord |
| PATCH | `/api/admin/properties/:id/approve` | Yes | A | Approve/reject property |
| PATCH | `/api/admin/properties/:id` | Yes | A | Update property |
| DELETE | `/api/admin/properties/:id` | Yes | A | Delete property |
| GET | `/api/admin/analytics` | Yes | A | Platform analytics |

**Legend**: S = Student, L = Landlord, A = Admin

---

## Data Model

```
User ──┬── Property ──┬── Booking ── Lease
       │              ├── Review
       │              ├── Availability
       │              └── MaintenanceRequest
       ├── Message (sender/receiver)
       ├── Document
       └── PasswordReset
```

**Roles**: `STUDENT`, `LANDLORD`, `ADMIN`
**Landlord statuses**: `PENDING`, `VERIFIED`, `REJECTED`, `SUSPENDED`
**Property statuses**: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `ARCHIVED`
**Booking statuses**: `PENDING`, `APPROVED`, `REJECTED`

---

## Getting Started

```bash
# install (bun enforced — npm/yarn/pnpm will fail)
bun install

# configure environment
cp .env.example .env
# set DATABASE_URL, JWT_SECRET, API_KEY, SMTP_* vars

# sync database
bunx prisma db push
bunx prisma generate

# start dev server
bun dev
```

### Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start dev server |
| `bun run build` | Production build (includes type check) |
| `bun run check-types` | Type check only |
| `bun run format` | Format with Biome |
| `bunx prisma studio` | Open Prisma GUI |
| `bunx prisma db push` | Sync schema to database |

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Min 8 chars, for signing tokens |
| `API_KEY` | Yes | Min 16 chars, validated in middleware |
| `SMTP_HOST` | No | Defaults to `smtp.gmail.com` |
| `SMTP_PORT` | No | Defaults to `587` |
| `SMTP_USER` | Yes* | Email for sending password resets |
| `SMTP_PASS` | Yes* | App-specific password |

*Required if password reset emails are enabled.

---

## Contributing

1. Follow existing route patterns.
2. Add Zod schemas in `validations.ts` and Swagger docs in `swagger.ts`.
3. Use `@/` alias for imports and response helpers from `@/lib/responses.ts`.
4. Protect routes with `requireAuth()` / `requireRole()`.
5. Normalise emails to lowercase. Never return passwords.
6. Run `bun run build` before pushing.
