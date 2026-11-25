# Session 000 - Project Initialization & Architecture Overview
**Date:** 2026-11-25
**Status:** Completed

## Files Created or Modified
- `.second brain/000_init.md` — Initialized `.second brain` memory log with architecture overview from `PROJECT_SPEC.md` and queued Step 1.

## Summary of Progress
- Read `AGENTS.md` and `PROJECT_SPEC.md`.
- Created the `.second brain/` directory and `000_init.md` per the Mandatory Setup rule.
- Verified local Node.js (`v24.13.0`) and npm (`11.18.0`) environment.

## Architectural Decisions & Important Notes
- **Target Stack ($0/mo Free Tier):**
  - **Framework:** Next.js 15+ (App Router, Server Actions, TypeScript) with `src/` directory.
  - **Styling & UI:** Tailwind CSS, `shadcn/ui` (Radix Primitives), `lucide-react`.
  - **Database & Auth:** Supabase (PostgreSQL + Supabase Auth with Email/Google OAuth).
  - **ORM:** Prisma ORM (`@prisma/client`).
  - **Date & Timezone Handling:** `date-fns`, `@date-fns/tz` (or `luxon`). All `Booking.startTime` and `Booking.endTime` values must be stored in UTC; host availability is evaluated in `User.timezone` and converted to `inviteeTimezone` on the client.
  - **Forms & Validation:** `react-hook-form`, `zod`, `@hookform/resolvers`.
  - **Email & Calendar Invites:** `resend` + `ics`.
  - **Analytics:** `recharts` + `PageView` tracking.
- **Core Data Models:** `User`, `EventType`, `Availability`, `DateOverride`, `Booking`, `PageView`.
- **Required `.env` Keys:** `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_API_KEY`.

## Next Steps (Queue for Next Session)
1. **Scaffold & Setup (Step 1):** Initialize Next.js (App Router, TypeScript, Tailwind CSS, `src/`), install core dependencies (`@prisma/client`, `prisma`, `lucide-react`, `date-fns`, `@date-fns/tz`, `zod`, `react-hook-form`, `@hookform/resolvers`, `resend`, `ics`, `recharts`, `@supabase/ssr`, `@supabase/supabase-js`), initialize `shadcn/ui`, create `prisma/schema.prisma` from `PROJECT_SPEC.md`, and scaffold `.env.example` / `.env` placeholders.
2. **Database & Auth (Step 2):** Push Prisma schema (`npx prisma db push`), set up Supabase Auth middleware, and create onboarding logic for default `username`, `timezone`, and Mon–Fri 9:00–17:00 `Availability`.

