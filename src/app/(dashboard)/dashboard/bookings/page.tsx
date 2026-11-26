import { Suspense } from "react";
import { connection } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BookingsDashboardClient,
  type DashboardBookingItem,
} from "@/components/booking/BookingsDashboardClient";

function parseFormResponses(raw: unknown): {
  addressText: string | null;
  notes: string | null;
  answers: { label: string; value: string | boolean | string[] }[];
} {
  if (!raw || typeof raw !== "object") {
    return { addressText: null, notes: null, answers: [] };
  }
  const obj = raw as Record<string, unknown>;
  const notes = typeof obj.notes === "string" ? obj.notes : null;

  let addressText: string | null = null;
  if (obj.address && typeof obj.address === "object") {
    const addr = obj.address as Record<string, unknown>;
    const parts = [addr.barangay, addr.municipality, addr.province].filter(
      (p): p is string => typeof p === "string" && p.trim().length > 0
    );
    if (parts.length > 0) {
      addressText = parts.join(", ");
    }
  }

  const answersObj =
    obj.answers && typeof obj.answers === "object"
      ? (obj.answers as Record<string, unknown>)
      : {};

  const answers: { label: string; value: string | boolean | string[] }[] = [];
  for (const entry of Object.values(answersObj)) {
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (
        typeof e.label === "string" &&
        (typeof e.value === "string" ||
          typeof e.value === "boolean" ||
          (Array.isArray(e.value) &&
            e.value.every((v) => typeof v === "string")))
      ) {
        answers.push({
          label: e.label,
          value: e.value as string | boolean | string[],
        });
      }
    }
  }
  return { addressText, notes, answers };
}

async function BookingsContent() {
  await connection();
  const user = await requireCurrentUser();

  const [eventTypes, allBookings] = await Promise.all([
    prisma.eventType.findMany({
      where: { userId: user.id },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.booking.findMany({
      where: { hostId: user.id },
      include: {
        eventType: {
          select: { id: true, title: true, location: true },
        },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const now = new Date();
  const upcoming: DashboardBookingItem[] = [];
  const past: DashboardBookingItem[] = [];
  const cancelled: DashboardBookingItem[] = [];

  for (const b of allBookings) {
    const parsed = parseFormResponses(b.formResponses);
    const item: DashboardBookingItem = {
      id: b.id,
      uid: b.uid,
      eventTypeId: b.eventType.id,
      eventTitle: b.eventType.title,
      location: b.eventType.location,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      inviteeTimezone: b.inviteeTimezone,
      startTimeIso: b.startTime.toISOString(),
      endTimeIso: b.endTime.toISOString(),
      status: b.status,
      cancellationReason: b.cancellationReason,
      addressText: parsed.addressText,
      notes: parsed.notes,
      answers: parsed.answers,
    };

    if (b.status === "CANCELLED") {
      cancelled.unshift(item);
    } else if (b.endTime >= now) {
      upcoming.push(item);
    } else {
      past.unshift(item);
    }
  }

  return (
    <BookingsDashboardClient
      hostTimezone={user.timezone}
      eventTypes={eventTypes}
      upcoming={upcoming}
      past={past}
      cancelled={cancelled}
    />
  );
}

function BookingsFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="h-8 w-36 animate-pulse rounded bg-muted" />
      <div className="h-9 w-72 animate-pulse rounded-lg bg-muted" />
      <div className="space-y-3">
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsFallback />}>
      <BookingsContent />
    </Suspense>
  );
}
