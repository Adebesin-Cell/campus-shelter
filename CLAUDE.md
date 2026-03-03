# Campus Shelter — Student Housing API

## Security Rules

- **NEVER** read, display, log, or reference `.env`, `.env.local`, or any environment variable files
- **NEVER** expose secrets, API keys, database URLs, JWT secrets, or SMTP credentials in code, comments, or responses
- **NEVER** hardcode sensitive values — always use `env` from `@/lib/env.ts`
- **NEVER** commit `.env` files or include credentials in pull requests

## Project Overview

A REST API for a student housing rental marketplace built for FUTA students and landlords. Students can browse, book, and review properties. Landlords can list and manage their properties.

### Tech Stack

- **Framework**: Next.js 16 (App Router, API routes only)
- **Language**: TypeScript 5 (strict mode)
- **Database**: PostgreSQL (Neon) with Prisma 7 ORM
- **Auth**: JWT (jsonwebtoken) + bcrypt password hashing
- **Validation**: Zod 4
- **Email**: Nodemailer
- **API Docs**: OpenAPI 3.0.3 / Swagger UI
- **Package Manager**: Bun (enforced — npm/yarn/pnpm will fail)
- **Linting/Formatting**: Biome
- **Git Hooks**: Husky + lint-staged

### Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/          # register, login, forgot-password, reset-password, change-password
│   │   ├── properties/    # CRUD, search, filtering, reviews
│   │   ├── bookings/      # create, list, manage
│   │   ├── leases/        # lease document management
│   │   ├── reviews/       # property reviews
│   │   ├── messages/      # student-landlord messaging
│   │   ├── maintenance/   # maintenance requests
│   │   ├── documents/     # file uploads
│   │   ├── admin/         # users, properties, analytics (admin only)
│   │   ├── ping/          # health check
│   │   └── docs/          # OpenAPI spec
│   └── api-docs/          # Swagger UI page
├── lib/
│   ├── auth.ts            # password hashing, JWT, auth helpers
│   ├── email.ts           # nodemailer transporter
│   ├── env.ts             # environment variable validation (t3-env)
│   ├── prisma.ts          # Prisma client singleton
│   ├── responses.ts       # standardized JSON response helpers
│   ├── swagger.ts         # OpenAPI spec definition
│   └── validations.ts     # Zod schemas for all endpoints
├── generated/prisma/      # auto-generated Prisma client (gitignored)
└── proxy.ts               # middleware: API key validation + CORS
prisma/
└── schema.prisma          # database schema
```

## Code Style & Conventions

### Formatting (enforced by Biome)

- **Indentation**: Tabs
- **Quotes**: Double quotes
- **Imports**: Auto-organized by Biome
- **Linting**: Biome recommended rules enabled

### Patterns to Follow

- Use `@/` path alias for all imports from `src/` (e.g., `import { prisma } from "@/lib/prisma"`)
- Use response helpers from `@/lib/responses.ts` (`success`, `created`, `badRequest`, `unauthorized`, `forbidden`, `notFound`, `serverError`)
- Use Zod schemas from `@/lib/validations.ts` with `safeParse()` for input validation
- Use `requireAuth()` and `requireRole()` from `@/lib/auth.ts` for protected routes
- Handle errors with try/catch, check for `AuthError` instances, log with `console.error("[Context]", error)` prefix
- Normalize emails to lowercase in all auth-related schemas
- Never return password fields in API responses

### Database

- Schema lives in `prisma/schema.prisma`
- Use `@@map("table_name")` for all models (snake_case table names)
- Run `bunx prisma db push` to sync schema changes
- Run `bunx prisma generate` after schema changes (or delete `src/generated/prisma/` and regenerate for clean builds)
- Use `prisma.$transaction()` for multi-step operations

## Common Commands

```bash
bun dev                    # start dev server
bun run build              # production build (includes type checking)
bun run check-types        # type check only
bun run format             # format all files with Biome
bunx prisma db push        # sync schema to database
bunx prisma generate       # regenerate Prisma client
bunx prisma studio         # open Prisma GUI
```

## Contributing

1. **Use Bun** — the project enforces it. Install with `bun install`
2. **Follow existing patterns** — check similar routes/files before creating new ones
3. **Add Zod schemas** in `src/lib/validations.ts` for any new endpoint input
4. **Add Swagger docs** in `src/lib/swagger.ts` for any new endpoint
5. **Update `proxy.ts`** if new routes need to bypass API key checks
6. **Pre-commit hooks** will auto-format staged files with Biome — don't fight it
7. **Test the build** before pushing: `bun run build`
8. **Roles**: STUDENT, LANDLORD, ADMIN — use `requireRole()` for access control
