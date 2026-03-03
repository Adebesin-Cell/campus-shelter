# Campus Shelter – Student Housing API 🏠

Campus Shelter is a RESTful backend for a student housing rental marketplace tailored to FUTA students and landlords. The API allows students to browse, book, review and message, while landlords can list and manage properties. Administrators have full control over users, properties and analytics.

---

## 🚀 Tech Stack

- **Framework:** Next.js 16 (App Router, API routes only)
- **Language:** TypeScript 5 (strict mode)
- **Database:** PostgreSQL (Neon) with Prisma 7 ORM
- **Authentication:** JWT + bcrypt
- **Validation:** Zod 4
- **Email:** Nodemailer
- **API Docs:** OpenAPI 3.0.3 / Swagger UI
- **Package Manager:** Bun (enforced)
- **Linting/Formatting:** Biome
- **Git Hooks:** Husky + lint-staged

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/          # endpoint folders for auth, bookings, properties, etc.
│   └── api-docs/     # Swagger UI page
├── lib/              # shared helpers (auth, email, prisma, validations, etc.)
└── proxy.ts          # middleware: API key validation + CORS

prisma/schema.prisma  # database schema
```

Refer to `CLAUDE.md` for a detailed overview, coding conventions, and development guidelines.

---

## 🛠️ Getting Started

```bash
# install dependencies (bun enforced)
bun install

# development server
bun dev

# type checking
bun run check-types

# format code
bun run format

# prisma database sync
bunx prisma db push
bunx prisma generate
```

> **Note:** never use `npm`, `yarn`, or `pnpm` – they will fail.

---

## ✅ Contributing

1. Follow existing route patterns when adding new features.
2. Add Zod schemas in `src/lib/validations.ts` and Swagger docs in `src/lib/swagger.ts`.
3. Use `@/` alias for imports and response helpers from `@/lib/responses.ts`.
4. Protect routes with `requireAuth()`/`requireRole()` from `@/lib/auth.ts`.
5. Normalize emails and never return passwords in responses.
6. Run `bun run build` before pushing to ensure the project compiles.

---

## 📦 Common Commands

```bash
bun dev                    # start dev server
bun run build              # production build (includes type checking)
bun run check-types        # type check only
bun run format             # format all files with Biome
bunx prisma db push        # sync schema to database
bunx prisma generate       # regenerate Prisma client
bunx prisma studio         # open Prisma GUI
```

---

## 🔒 Security Reminder

- Never commit `.env` files or expose secrets.
- Use `env` from `@/lib/env.ts` for configuration.
- Handle errors with try/catch and log with `console.error("[Context]", error)`.

---

Thanks for using Campus Shelter! 🎓🏡
