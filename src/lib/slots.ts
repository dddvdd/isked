import { TZDate } from "@date-fns/tz";
import { prisma } from "@/lib/prisma";
import { isValidTimezone } from "@/lib/timezones";
import {
  parseAllowedDates,
  parseLocationDistribution,
  type SlotLimitScope,
} from "@/lib/validations/event-type";
import {
  computeAvailableSlots,
  computeQuotaRemaining,
  extractBookingAddressCodes,
  formatUtcToHostYmd,
  isHostDateWithinBookingWindow,
  type AvailabilityRuleInput,
  type BookingWindowInput,
  type ComputeSlotsOptions,
  type DateOverrideInput,
  type ExistingBookingInput,
  type QuotaLocationAllocation,
  type SlotQuotaInput,
} from "@/lib/slot-math";

export {
  computeAvailableSlots,
  computeQuotaRemaining,
  extractBookingAddressCodes,
  formatUtcToHostYmd,
  isHostDateWithinBookingWindow,
  type AvailabilityRuleInput,
  type BookingWindowInput,
  type ComputeSlotsOptions,
  type DateOverrideInput,
  type ExistingBookingInput,
  type QuotaLocationAllocation,
  type SlotQuotaInput,
};

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function buildBookingWindowFromEventType(eventType: {
  bookingWindowType: "UNLIMITED" | "DATE_RANGE" | "SPECIFIC_DATES";
  bookingStartDate: Date | null;
  bookingEndDate: Date | null;
  allowedDates: unknown;
}): BookingWindowInput {
  return {
    type: eventType.bookingWindowType,
    startDate: eventType.bookingStartDate
      ? eventType.bookingStartDate.toISOString().slice(0, 10)
      : null,
    endDate: eventType.bookingEndDate
      ? eventType.bookingEndDate.toISOString().slice(0, 10)
      : null,
    allowedDates: parseAllowedDates(eventType.allowedDates),
  };
}

export function buildSlotQuotaFromEventType(eventType: {
  slotLimitScope: SlotLimitScope;
  slotLimit: number | null;
  locationDistribution: unknown;
}): SlotQuotaInput {
  const dist = parseLocationDistribution(eventType.locationDistribution);
  return {
    scope: eventType.slotLimitScope,
    slotLimit: eventType.slotLimit,
    locationLevel: dist.level,
    allocations: dist.allocations,
  };
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

  const slotQuota = buildSlotQuotaFromEventType(eventType);

  const [overrides, confirmedBookings, allEventBookings] = await Promise.all([
    prisma.dateOverride.findMany({
      where: {
        userId: user.id,
        date: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
    }),
    slotQuota.scope === "NONE"
      ? prisma.booking.findMany({
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
        })
      : Promise.resolve([]),
    slotQuota.scope === "PER_EVENT"
      ? prisma.booking.findMany({
          where: {
            eventTypeId: eventType.id,
            status: "CONFIRMED",
          },
          select: { startTime: true, endTime: true, formResponses: true },
        })
      : slotQuota.scope === "PER_DAY"
        ? prisma.booking.findMany({
            where: {
              eventTypeId: eventType.id,
              status: "CONFIRMED",
              startTime: { lt: windowEnd, gt: windowStart },
            },
            select: { startTime: true, endTime: true, formResponses: true },
          })
        : Promise.resolve([]),
  ]);

  return computeAvailableSlots({
    dateString,
    inviteeTimezone: safeInviteeTz,
    hostTimezone: user.timezone,
    durationMinutes: eventType.durationMinutes,
    bufferBeforeMinutes: eventType.bufferBeforeMinutes,
    bufferAfterMinutes: eventType.bufferAfterMinutes,
    bookingWindow: buildBookingWindowFromEventType(eventType),
    slotQuota,
    quotaBookings: allEventBookings.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      formResponses: b.formResponses,
    })),
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

  const slotQuota = buildSlotQuotaFromEventType(eventType);

  const [overrides, confirmedBookings, allEventBookings] = await Promise.all([
    prisma.dateOverride.findMany({
      where: {
        userId: user.id,
        date: { gte: rangeStart, lte: rangeEnd },
      },
    }),
    slotQuota.scope === "NONE"
      ? prisma.booking.findMany({
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
        })
      : Promise.resolve([]),
    slotQuota.scope === "PER_EVENT"
      ? prisma.booking.findMany({
          where: {
            eventTypeId: eventType.id,
            status: "CONFIRMED",
          },
          select: { startTime: true, endTime: true, formResponses: true },
        })
      : slotQuota.scope === "PER_DAY"
        ? prisma.booking.findMany({
            where: {
              eventTypeId: eventType.id,
              status: "CONFIRMED",
              startTime: { lt: rangeEnd, gt: rangeStart },
            },
            select: { startTime: true, endTime: true, formResponses: true },
          })
        : Promise.resolve([]),
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
  const mappedQuotaBookings = allEventBookings.map((b) => ({
    startTime: b.startTime,
    endTime: b.endTime,
    formResponses: b.formResponses,
  }));
  const bookingWindow = buildBookingWindowFromEventType(eventType);

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
      bookingWindow,
      slotQuota,
      quotaBookings: mappedQuotaBookings,
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
