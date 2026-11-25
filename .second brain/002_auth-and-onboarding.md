# Session 002 - Supabase Auth, Proxy & Onboarding
**Date:** 2026-11-25
**Status:** Completed (pending `.env` credentials for `npx prisma db push`)

## Files Created or Modified
- `src/lib/supabase/client.ts` — Browser Supabase client via `@supabase/ssr`
- `src/lib/supabase/server.ts` — Server Supabase client using async `cookies()`
- `src/lib/supabase/proxy.ts` — Session refresh & `/dashboard/*` route protection helper
- `src/proxy.ts` — Next.js 16 Proxy entry point (replaces `middleware.ts`)
- `src/lib/auth.ts` — `ensureUserOnboarded`, `getCurrentUser`, `requireCurrentUser` (provisions `User` with unique `username`, `"UTC"` timezone, and Mon–Fri `09:00`–`17:00` `Availability`)
- `src/actions/auth.ts` — `signOutAction` server action
- `src/app/auth/callback/route.ts` — OAuth / email confirmation code exchange + onboarding
- `src/app/(auth)/login/page.tsx` — Email/Password sign-in & sign-up + Google OAuth UI
- `src/app/(dashboard)/layout.tsx` — Authenticated dashboard sidebar layout
- `src/app/(dashboard)/dashboard/page.tsx` — Redirects `/dashboard` to `/dashboard/event-types`
- `src/app/(dashboard)/dashboard/event-types/page.tsx` — Initial Event Types page shell
- `src/app/page.tsx` — Landing page with links to `/login` and `/dashboard/event-types`
- `src/components/ui/card.tsx`, `input.tsx`, `label.tsx` — Added `shadcn/ui` components

## Summary of Progress
- Implemented Supabase SSR auth helpers and Next.js 16 `src/proxy.ts` route protection.
- Built `/login`, `/auth/callback`, and `ensureUserOnboarded` to automatically assign a unique `username`, default `UTC` timezone, and Mon–Fri `09:00`–`17:00` `Availability` on first login.
- Created the `(dashboard)` layout shell and `/dashboard/event-types` starter route.
- Verified TypeScript (`npx tsc --noEmit`) and production build (`npm run build` exited with code `0`).

## Architectural Decisions & Important Notes
- **Next.js 16 Proxy:** Next.js `16.4.6` uses `src/proxy.ts` exporting `proxy(request)` instead of `middleware.ts`.
- **Dashboard URLs:** Routes live under `src/app/(dashboard)/dashboard/...` so URLs match `/dashboard/event-types`, `/dashboard/availability`, `/dashboard/bookings`, and `/dashboard/analytics` from `PROJECT_SPEC.md`.
- **shadcn/ui v4 Button:** `Button` uses Base UI rather than Radix `asChild`; styled `<Link>` elements use `buttonVariants(...)` from `@/components/ui/button`.
- **Pending DB Push:** `npx prisma db push` has not been run yet because `.env` still has empty `DATABASE_URL` / `DIRECT_URL`.

## Next Steps (Queue for Next Session)
1. **Database Push (when `.env` is ready):** Run `npx prisma db push` to sync `prisma/schema.prisma` to Supabase PostgreSQL.
2. **Event Type CRUD & Form Builder (Step 3):** Build `src/actions/event-types.ts`, `/dashboard/event-types` list/create/toggle/delete UI, and `/dashboard/event-types/[id]` editor with `customQuestions` JSON builder, Markdown `description`, and `postBookingBehavior` (`CONFIRMATION_PAGE` vs `REDIRECT`) settings.

