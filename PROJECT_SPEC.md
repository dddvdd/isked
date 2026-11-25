# Project Specification: Open-Source Calendly Clone ($0/mo Stack)

## 1. Project Overview & Goals
Build a full-stack scheduling application modeled after Calendly. The application allows hosts to configure their availability, create customizable event types with descriptions and dynamic invitee forms, share public booking links with automatic timezone conversion, handle post-booking confirmations or custom redirects, and track booking metrics via a built-in analytics dashboard.

**Target Hosting & Cost Constraint:** 100% Free Tier compatible (Vercel + Supabase + Resend).

---

## 2. Tech Stack
- **Framework:** Next.js 15+ (App Router, Server Actions, TypeScript)
- **Styling & UI:** Tailwind CSS, `shadcn/ui` (Radix Primitives), `lucide-react` icons
- **Database & Auth:** Supabase (PostgreSQL + Supabase Auth with Email/Google OAuth)
- **ORM:** Prisma ORM (`@prisma/client`)
- **Date & Timezone Handling:** `date-fns`, `@date-fns/tz` (or `luxon`)
- **Forms & Validation:** `react-hook-form`, `zod`, `@hookform/resolvers`
- **Email & Calendar Invites:** `resend` + `ics` (for generating `.ics` calendar attachments)
- **Analytics Charts:** `recharts`

---

## 3. Core Features & Functional Requirements

### A. Host Dashboard & Event Types (`/dashboard/event-types`)
- Create, edit, toggle active/inactive, and delete Event Types.
- **Event Type Fields:**
  - `title` (e.g., "30 Minute Discovery Call")
  - `slug` (URL-friendly identifier, e.g., `30-min-call`)
  - `description` (Markdown/rich-text description displayed on the booking page)
  - `durationMinutes` (15, 30, 45, 60, or custom)
  - `bufferBeforeMinutes` & `bufferAfterMinutes` (padding around meetings)
  - `locationType` (Google Meet link, Zoom link, Phone call, or Custom text)
  - `customQuestions` (JSON array defining dynamic invitee form fields: text, textarea, select, checkbox, required/optional)
  - `postBookingBehavior`: Either `"CONFIRMATION_PAGE"` or `"REDIRECT"`
  - `redirectUrl` (Optional URL to redirect invitee upon booking, appending query params like `?event_type=...&invitee_name=...&start_time=...`)

### B. Availability Engine (`/dashboard/availability`)
- **Weekly Recurring Hours:** Configure start and end times per day of the week (Monday–Sunday) in the host's primary timezone. Support multiple shifts per day (e.g., 09:00–12:00 and 13:00–17:00).
- **Date Overrides:** Allow hosts to block specific dates (e.g., holidays/PTO) or set custom hours for a specific calendar date.

### C. Public Booking Flow (`/[username]/[eventSlug]`)
- **Two-Column Responsive Layout:**
  - **Left Panel:** Host avatar, host name, Event Title, duration badge, location indicator, and formatted `description`.
  - **Right Panel (Step 1 - Date & Time):** Interactive monthly calendar disabling past dates and unavailable days. Clicking a date fetches available time slots converted to the invitee's detected browser timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), with a dropdown allowing the invitee to switch timezones manually.
  - **Right Panel (Step 2 - Invitee Form):** Displays selected date/time, standard inputs (`Name`, `Email`, `Additional Notes`), plus dynamically rendered inputs from `EventType.customQuestions`.
- **Double-Booking Prevention:** Wrap booking creation in a Prisma interactive transaction (`prisma.$transaction`) that re-verifies no overlapping `CONFIRMED` booking exists for `[startTime - bufferBefore, endTime + bufferAfter]` before inserting.
- **Confirmation / Redirect Handling:**
  - Trigger an async email via Resend containing booking details, cancellation link, and an attached `.ics` file.
  - If `postBookingBehavior === "REDIRECT"` and `redirectUrl` is valid, perform a client-side redirect passing booking metadata as URL search parameters.
  - Otherwise, redirect to `/booking/[bookingUid]/confirmed` showing full summary details and "Add to Calendar" links.

### D. Booking Management (`/dashboard/bookings`)
- Filter bookings by **Upcoming**, **Past**, and **Cancelled**.
- View submitted `formResponses` from the invitee.
- Ability for either the host or invitee (via unique token link `/booking/[bookingUid]/cancel`) to cancel a meeting with an optional cancellation reason.

### E. Built-in Analytics (`/dashboard/analytics`)
- Track page views via a lightweight server action (`recordPageView(eventTypeId)`) when `/[username]/[eventSlug]` loads.
- Display KPI cards & Recharts visualizations:
  1. **Total Bookings** (with period-over-period comparison)
  2. **Conversion Rate** (`Confirmed Bookings / Unique Link Views`)
  3. **Cancellation Rate** (`Cancelled Bookings / Total Bookings`)
  4. **Popular Event Types** (Bar chart)
  5. **Bookings by Day of Week / Hour** (Activity distribution)

---

## 4. Database Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model User {
  id            String         @id @default(uuid())
  email         String         @unique
  username      String         @unique
  name          String?
  avatarUrl     String?
  timezone      String         @default("UTC")
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  eventTypes    EventType[]
  availabilities Availability[]
  dateOverrides DateOverride[]
  bookings      Booking[]
}

enum PostBookingBehavior {
  CONFIRMATION_PAGE
  REDIRECT
}

model EventType {
  id                  String              @id @default(uuid())
  userId              String
  user                User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  title               String
  slug                String
  description         String?             @db.Text
  durationMinutes     Int                 @default(30)
  bufferBeforeMinutes Int                 @default(0)
  bufferAfterMinutes  Int                 @default(0)
  location            String?
  isActive            Boolean             @default(true)
  customQuestions     Json                @default("[]") // Array<{ id, label, type, required, options? }>
  postBookingBehavior PostBookingBehavior @default(CONFIRMATION_PAGE)
  redirectUrl         String?
  createdAt           DateTime            @default(now())
  updatedAt           DateTime            @updatedAt
  bookings            Booking[]
  pageViews           PageView[]

  @@unique([userId, slug])
}

model Availability {
  id        String @id @default(uuid())
  userId    String
  user      User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  dayOfWeek Int    // 0 = Sunday, 6 = Saturday
  startTime String // "HH:mm" in 24-hour format (e.g., "09:00")
  endTime   String // "HH:mm" in 24-hour format (e.g., "17:00")

  @@index([userId, dayOfWeek])
}

model DateOverride {
  id            String   @id @default(uuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date          DateTime @db.Date
  isUnavailable Boolean  @default(false)
  startTime     String?  // "HH:mm" if custom hours apply
  endTime       String?  // "HH:mm" if custom hours apply

  @@unique([userId, date])
}

enum BookingStatus {
  CONFIRMED
  CANCELLED
}

model Booking {
  id                 String        @id @default(uuid())
  uid                String        @unique @default(cuid())
  eventTypeId        String
  eventType          EventType     @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)
  hostId             String
  host               User          @relation(fields: [hostId], references: [id], onDelete: Cascade)
  inviteeName        String
  inviteeEmail       String
  inviteeTimezone    String
  startTime          DateTime      // Always stored in UTC
  endTime            DateTime      // Always stored in UTC
  formResponses      Json          @default("{}")
  status             BookingStatus @default(CONFIRMED)
  cancellationReason String?
  createdAt          DateTime      @default(now())
  updatedAt          DateTime      @updatedAt

  @@index([hostId, startTime, endTime])
}

model PageView {
  id          String    @id @default(uuid())
  eventTypeId String
  eventType   EventType @relation(fields: [eventTypeId], references: [id], onDelete: Cascade)
  viewedAt    DateTime  @default(now())

  @@index([eventTypeId, viewedAt])
}
```

---

## 5. Slot Calculation Algorithm (`lib/slots.ts`)
When `getAvailableSlots(username, eventSlug, dateString, inviteeTimezone)` is called:
1. Fetch `User`, `EventType`, `Availability` for the target day of week, and any `DateOverride` matching `dateString` in the **host's timezone**.
2. If `DateOverride?.isUnavailable === true` or no availability rules exist, return `[]`.
3. Construct UTC `Date` intervals for the host's working window(s) on that date using the host's `timezone`.
4. Query all `CONFIRMED` bookings for `hostId` overlapping that UTC day window (expanded by max buffer minutes).
5. Expand each existing booking's blocked interval to `[booking.startTime - bufferBeforeMinutes, booking.endTime + bufferAfterMinutes]`.
6. Subtract blocked intervals from the host's working intervals.
7. Slice remaining free intervals into candidate slots of length `durationMinutes` (stepping by `durationMinutes` or 15-minute increments), filtering out any slot where `slotStart <= new Date()`.
8. Return ISO UTC strings; format them into `inviteeTimezone` on the client.

---

## 6. Recommended Directory Structure
```text
src/
├── app/
│   ├── (auth)/login/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                  # Sidebar navigation
│   │   ├── event-types/
│   │   │   ├── page.tsx                # List & create event types
│   │   │   └── [id]/page.tsx           # Edit event, form builder, redirect settings
│   │   ├── availability/page.tsx       # Weekly schedule + date overrides
│   │   ├── bookings/page.tsx           # Upcoming/Past/Cancelled tabs
│   │   └── analytics/page.tsx          # Recharts metrics & conversion rates
│   ├── [username]/[eventSlug]/page.tsx # Public booking page
│   └── booking/[uid]/
│       ├── confirmed/page.tsx          # Default confirmation view
│       └── cancel/page.tsx             # Public cancellation view
├── components/
│   ├── booking/                        # CalendarPicker, SlotList, InviteeForm
│   ├── event-types/                    # CustomQuestionBuilder, EventEditorForm
│   └── ui/                             # shadcn/ui components
├── lib/
│   ├── prisma.ts                       # Singleton Prisma client
│   ├── supabase/                       # Server & client Supabase helpers
│   ├── slots.ts                        # Core availability & timezone math
│   └── email.ts                        # Resend + .ics generator
└── actions/
    ├── event-types.ts
    ├── availability.ts
    ├── bookings.ts
    └── analytics.ts
```

---

## 7. Step-by-Step Implementation Order for AI
1. **Scaffold & Setup:** Initialize Next.js with TypeScript, Tailwind CSS, `shadcn/ui`, and Prisma. Configure `.env` with `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `RESEND_API_KEY`.
2. **Database & Auth:** Push the Prisma schema (`npx prisma db push`), set up Supabase Auth middleware, and create an onboarding trigger/check that assigns a default `username`, `timezone`, and Mon–Fri 9:00–17:00 `Availability` on first login.
3. **Event Type CRUD & Form Builder:** Build `/dashboard/event-types` including the dynamic `customQuestions` JSON editor, Markdown `description` editor, and `postBookingBehavior` (`CONFIRMATION_PAGE` vs `REDIRECT`) toggle.
4. **Availability Manager:** Build `/dashboard/availability` with weekly time-range selectors and a calendar picker for `DateOverride` entries.
5. **Slot Engine & Public Booking Page:** Implement `lib/slots.ts` with unit tests for DST/timezone edge cases, then build `/[username]/[eventSlug]` with transactional booking creation and redirect/confirmation routing.
6. **Email Notifications & Cancellation:** Integrate Resend + `.ics` attachments on booking creation and build `/booking/[uid]/cancel`.
7. **Analytics Dashboard:** Wire up `PageView` tracking on the public booking page and build `/dashboard/analytics` with Recharts.