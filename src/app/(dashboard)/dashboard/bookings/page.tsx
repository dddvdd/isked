import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  BookingsDashboardClient,
  type DashboardBookingItem,
} from "@/components/booking/BookingsDashboardClient";

function parseFormResponses(raw: unknown): {
  notes: string | null;
  answers: { label: string; value: string | boolean }[];
} {
  if (!raw || typeof raw !== "object") {
    return { notes: null, answers: [] };
  }
  const obj = raw as Record<string, unknown>;
  const notes = typeof obj.notes === "string" ? obj.notes : null;
  const answersObj =
    obj.answers && typeof obj.answers === "object"
      ? (obj.answers as Record<string, unknown>)
      : {};

  const answers: { label: string; value: string | boolean }[] = [];
  for (const entry of Object.values(answersObj)) {
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      if (
        typeof e.label === "string" &&
        (typeof e.value === "string" || typeof e.value === "boolean")
      ) {
        answers.push({ label: e.label, value: e.value });
      }
    }
  }
  return { notes, answers };
}

export default async function BookingsPage() {
  const user = await requireCurrentUser();

  const allBookings = await prisma.booking.findMany({
    where: { hostId: user.id },
    include: {
      eventType: {
        select: { title: true, location: true },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const now = new Date();
  const upcoming: DashboardBookingItem[] = [];
  const past: DashboardBookingItem[] = [];
  const cancelled: DashboardBookingItem[] = [];

  for (const b of allBookings) {
    const parsed = parseFormResponses(b.formResponses);
    const item: DashboardBookingItem = {
      id: b.id,
      uid: b.uid,
      eventTitle: b.eventType.title,
      location: b.eventType.location,
      inviteeName: b.inviteeName,
      inviteeEmail: b.inviteeEmail,
      inviteeTimezone: b.inviteeTimezone,
      startTimeIso: b.startTime.toISOString(),
      endTimeIso: b.endTime.toISOString(),
      status: b.status,
      cancellationReason: b.cancellationReason,
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
      upcoming={upcoming}
      past={past}
      cancelled={cancelled}
    />
  );
}

