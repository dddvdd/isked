import { TZDate } from "@date-fns/tz";
import { prisma } from "@/lib/prisma";
import { isValidTimezone } from "@/lib/timezones";
import {
  computeAvailableSlots,
  type AvailabilityRuleInput,
  type ComputeSlotsOptions,
  type DateOverrideInput,
  type ExistingBookingInput,
} from "@/lib/slot-math";

export {
  computeAvailableSlots,
  type AvailabilityRuleInput,
  type ComputeSlotsOptions,
  type DateOverrideInput,
  type ExistingBookingInput,
};

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/**
 * Fetches available UTC ISO slot strings for a given host, event slug, date ("YYYY-MM-DD"),
 * and invitee timezone.
 */
export async function getAvailableSlots(
  username: string,
  eventSlug: string,
  dateString: string,
  inviteeTimezone: string
): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      availabilities: true,
      eventTypes: {
        where: { slug: eventSlug, isActive: true },
        take: 1,
      },
    },
  });

  const eventType = user?.eventTypes[0];
  if (!user || !eventType) {
    return [];
  }

  const { year, month, day } = parseYmd(dateString);
  const safeInviteeTz = isValidTimezone(inviteeTimezone)
    ? inviteeTimezone
    : user.timezone;

  const windowStart = new Date(
    new TZDate(year, month - 1, day - 2, 0, 0, 0, 0, safeInviteeTz).getTime()
  );
  const windowEnd = new Date(
    new TZDate(year, month - 1, day + 3, 0, 0, 0, 0, safeInviteeTz).getTime()
  );

  const [overrides, confirmedBookings] = await Promise.all([
    prisma.dateOverride.findMany({
      where: {
        userId: user.id,
        date: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    }),
    prisma.booking.findMany({
      where: {
        hostId: user.id,
        status: "CONFIRMED",
        startTime: { lt: windowEnd },
        endTime: { gt: windowStart },
      },
      include: {
        eventType: {
          select: {
            bufferBeforeMinutes: true,
            bufferAfterMinutes: true,
          },
        },
      },
    }),
  ]);

  return computeAvailableSlots({
    dateString,
    inviteeTimezone: safeInviteeTz,
    hostTimezone: user.timezone,
    durationMinutes: eventType.durationMinutes,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    availabilities: user.availabilities.map((a) => ({
      dayOfWeek: a.dayOfWeek,
      startTime: a.startTime,
      endTime: a.endTime,
    })),
    dateOverrides: overrides.map((ov) => ({
      date: ov.date.toISOString().slice(0, 10),
      isUnavailable: ov.isUnavailable,
      startTime: ov.startTime,
      endTime: ov.endTime,
    })),
    bookings: confirmedBookings.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      bufferBeforeMinutes: b.eventType.bufferBeforeMinutes,
      bufferAfterMinutes: b.eventType.bufferAfterMinutes,
    })),
  });
}

/**
 * Computes which "YYYY-MM-DD" dates in a given month ("YYYY-MM") have at least one
 * available slot in `inviteeTimezone`.
 */
export async function getAvailableDatesForMonth(
  username: string,
  eventSlug: string,
  yearMonth: string,
  inviteeTimezone: string
): Promise<string[]> {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return [];

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      availabilities: true,
      eventTypes: {
        where: { slug: eventSlug, isActive: true },
        take: 1,
      },
    },
  });

  const eventType = user?.eventTypes[0];
  if (!user || !eventType) return [];

  const [y, m] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const safeInviteeTz = isValidTimezone(inviteeTimezone)
    ? inviteeTimezone
    : user.timezone;

  const rangeStart = new Date(Date.UTC(y, m - 1, -2));
  const rangeEnd = new Date(Date.UTC(y, m, 3));

  const [overrides, confirmedBookings] = await Promise.all([
    prisma.dateOverride.findMany({
      where: {
        userId: user.id,
        date: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    prisma.booking.findMany({
      where: {
        hostId: user.id,
        status: "CONFIRMED",
        startTime: { lt: rangeEnd },
        endTime: { gt: rangeStart },
      },
      include: {
        eventType: {
          select: {
            bufferBeforeMinutes: true,
            bufferAfterMinutes: true,
          },
        },
      },
    }),
  ]);

  const mappedAvailabilities = user.availabilities.map((a) => ({
    dayOfWeek: a.dayOfWeek,
    startTime: a.startTime,
    endTime: a.endTime,
  }));
  const mappedOverrides = overrides.map((ov) => ({
    date: ov.date.toISOString().slice(0, 10),
    isUnavailable: ov.isUnavailable,
    startTime: ov.startTime,
    endTime: ov.endTime,
  }));
  const mappedBookings = confirmedBookings.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
    bufferBeforeMinutes: b.eventType.bufferBeforeMinutes,
    bufferAfterMinutes: b.eventType.bufferAfterMinutes,
  }));

  const availableDates: string[] = [];
  const now = new Date();

  for (let d = 1; d <= daysInMonth; d++) {
    const dateString = `${yearMonth}-${String(d).padStart(2, "0")}`;
    const slots = computeAvailableSlots({
      dateString,
      inviteeTimezone: safeInviteeTz,
      hostTimezone: user.timezone,
      durationMinutes: eventType.durationMinutes,
      bufferBeforeMinutes: eventType.bufferBeforeMinutes,
      bufferAfterMinutes: eventType.bufferAfterMinutes,
      availabilities: mappedAvailabilities,
      dateOverrides: mappedOverrides,
      bookings: mappedBookings,
      now,
    });
    if (slots.length > 0) {
      availableDates.push(dateString);
    }
  }

  return availableDates;
}
