import { TZDate } from "@date-fns/tz";

export interface AvailabilityRuleInput {
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
}

export interface DateOverrideInput {
  date: string; // "YYYY-MM-DD" in host's calendar
  isUnavailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ExistingBookingInput {
  startTime: Date; // UTC
  endTime: Date;   // UTC
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  eventTypeId?: string;
  formResponses?: unknown;
}

export interface QuotaLocationAllocation {
  code: string;
  name: string;
  slots: number;
  provinceCode?: string;
  provinceName?: string;
  municipalityCode?: string;
  municipalityName?: string;
}

export interface SlotQuotaInput {
  scope: "NONE" | "PER_EVENT" | "PER_DAY";
  slotLimit: number | null;
  locationLevel?: "NONE" | "PROVINCE" | "MUNICIPALITY" | "BARANGAY";
  allocations?: QuotaLocationAllocation[];
}

export interface BookingWindowInput {
  type: "UNLIMITED" | "DATE_RANGE" | "SPECIFIC_DATES";
  startDate?: string | null; // "YYYY-MM-DD" in host timezone (inclusive)
  endDate?: string | null;   // "YYYY-MM-DD" in host timezone (inclusive)
  allowedDates?: string[];   // Array<"YYYY-MM-DD"> in host timezone
}

export interface ComputeSlotsOptions {
  dateString: string; // "YYYY-MM-DD" selected in inviteeTimezone
  inviteeTimezone: string;
  hostTimezone: string;
  durationMinutes: number;
  bufferBeforeMinutes?: number;
  bufferAfterMinutes?: number;
  stepMinutes?: number;
  availabilities: AvailabilityRuleInput[];
  dateOverrides: DateOverrideInput[];
  bookings: ExistingBookingInput[];
  bookingWindow?: BookingWindowInput;
  slotQuota?: SlotQuotaInput;
  quotaBookings?: ExistingBookingInput[]; // Confirmed bookings for THIS eventType (for PER_EVENT / PER_DAY)
  now?: Date;
}

interface UtcInterval {
  startMs: number;
  endMs: number;
}

function checkTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseYmd(dateStr: string): { year: number; month: number; day: number } {
  const [y, m, d] = dateStr.split("-").map(Number);
  return { year: y, month: m, day: d };
}

function parseHm(timeStr: string): { hour: number; minute: number } {
  const [h, m] = timeStr.split(":").map(Number);
  return { hour: h, minute: m };
}

export function formatUtcToHostYmd(utcMs: number, hostTimezone: string): string {
  const safeTz = checkTimezone(hostTimezone) ? hostTimezone : "UTC";
  const z = new TZDate(utcMs, safeTz);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function extractBookingAddressCodes(formResponses: unknown): {
  provinceCode: string | null;
  municipalityCode: string | null;
  barangayCode: string | null;
} {
  if (!formResponses || typeof formResponses !== "object") {
    return { provinceCode: null, municipalityCode: null, barangayCode: null };
  }
  const obj = formResponses as Record<string, unknown>;
  if (!obj.address || typeof obj.address !== "object") {
    return { provinceCode: null, municipalityCode: null, barangayCode: null };
  }
  const addr = obj.address as Record<string, unknown>;
  return {
    provinceCode:
      typeof addr.provinceCode === "string" ? addr.provinceCode : null,
    municipalityCode:
      typeof addr.municipalityCode === "string" ? addr.municipalityCode : null,
    barangayCode:
      typeof addr.barangayCode === "string" ? addr.barangayCode : null,
  };
}

export function computeQuotaRemaining(params: {
  slotQuota: SlotQuotaInput;
  scopedBookings: Pick<ExistingBookingInput, "formResponses">[];
}): {
  remainingTotal: number;
  remainingByCode: Map<string, number>;
} {
  const { slotQuota, scopedBookings } = params;
  const totalCap = Math.max(0, slotQuota.slotLimit ?? 0);
  const level = slotQuota.locationLevel ?? "NONE";
  const allocations = (slotQuota.allocations ?? []).filter((a) => a.slots > 0);

  const remainingByCode = new Map<string, number>();

  if (level === "NONE") {
    return {
      remainingTotal: Math.max(0, totalCap - scopedBookings.length),
      remainingByCode,
    };
  }

  if (allocations.length === 0) {
    return { remainingTotal: 0, remainingByCode };
  }

  const usedByCode = new Map<string, number>();
  for (const b of scopedBookings) {
    const codes = extractBookingAddressCodes(b.formResponses);
    const code =
      level === "PROVINCE"
        ? codes.provinceCode
        : level === "MUNICIPALITY"
          ? codes.municipalityCode
          : codes.barangayCode;
    if (code) {
      usedByCode.set(code, (usedByCode.get(code) ?? 0) + 1);
    }
  }

  let sumRemainingAllocations = 0;
  for (const alloc of allocations) {
    const used = usedByCode.get(alloc.code) ?? 0;
    const rem = Math.max(0, alloc.slots - used);
    remainingByCode.set(alloc.code, rem);
    sumRemainingAllocations += rem;
  }

  const overallRemaining = Math.max(
    0,
    Math.min(totalCap - scopedBookings.length, sumRemainingAllocations)
  );

  return {
    remainingTotal: overallRemaining,
    remainingByCode,
  };
}

export function isHostDateWithinBookingWindow(
  hostYmd: string,
  bookingWindow?: BookingWindowInput
): boolean {
  if (!bookingWindow || bookingWindow.type === "UNLIMITED") {
    return true;
  }

  if (bookingWindow.type === "DATE_RANGE") {
    if (bookingWindow.startDate && hostYmd < bookingWindow.startDate) {
      return false;
    }
    if (bookingWindow.endDate && hostYmd > bookingWindow.endDate) {
      return false;
    }
    return true;
  }

  if (bookingWindow.type === "SPECIFIC_DATES") {
    return Boolean(bookingWindow.allowedDates?.includes(hostYmd));
  }

  return true;
}

function formatYmdInTz(
  utcMs: number,
  timeZone: string
): { ymd: string; dayOfWeek: number } {
  const z = new TZDate(utcMs, timeZone);
  const y = z.getFullYear();
  const m = String(z.getMonth() + 1).padStart(2, "0");
  const d = String(z.getDate()).padStart(2, "0");
  return {
    ymd: `${y}-${m}-${d}`,
    dayOfWeek: z.getDay(),
  };
}

function localWallTimeToUtcMs(
  ymd: string,
  hm: string,
  timeZone: string
): number {
  const { year, month, day } = parseYmd(ymd);
  const { hour, minute } = parseHm(hm);
  return new TZDate(year, month - 1, day, hour, minute, 0, 0, timeZone).getTime();
}

function mergeIntervals(intervals: UtcInterval[]): UtcInterval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs);
  const merged: UtcInterval[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr.startMs <= prev.endMs) {
      prev.endMs = Math.max(prev.endMs, curr.endMs);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

function subtractIntervals(
  working: UtcInterval[],
  blocked: UtcInterval[]
): UtcInterval[] {
  if (working.length === 0) return [];
  if (blocked.length === 0) return mergeIntervals(working);

  let current = mergeIntervals(working);
  const mergedBlocked = mergeIntervals(blocked);

  for (const b of mergedBlocked) {
    const next: UtcInterval[] = [];
    for (const w of current) {
      if (b.endMs <= w.startMs || b.startMs >= w.endMs) {
        next.push(w);
      } else {
        if (b.startMs > w.startMs) {
          next.push({ startMs: w.startMs, endMs: b.startMs });
        }
        if (b.endMs < w.endMs) {
          next.push({ startMs: b.endMs, endMs: w.endMs });
        }
      }
    }
    current = next;
  }

  return current;
}

/**
 * Pure, deterministic slot calculation function supporting arbitrary host/invitee
 * IANA timezones, cross-date timezone offsets, buffers, date overrides,
 * event booking date windows (date range / specific open dates), and DST transitions.
 */
export function computeAvailableSlots(options: ComputeSlotsOptions): string[] {
  const {
    dateString,
    durationMinutes,
    bufferBeforeMinutes = 0,
    bufferAfterMinutes = 0,
    availabilities,
    dateOverrides,
    bookings,
    bookingWindow,
    slotQuota,
    quotaBookings,
    now = new Date(),
  } = options;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString) || durationMinutes <= 0) {
    return [];
  }

  const hostTz = checkTimezone(options.hostTimezone)
    ? options.hostTimezone
    : "UTC";
  const inviteeTz = checkTimezone(options.inviteeTimezone)
    ? options.inviteeTimezone
    : hostTz;

  const isGroupQuotaMode =
    slotQuota !== undefined &&
    (slotQuota.scope === "PER_EVENT" || slotQuota.scope === "PER_DAY");
  const eventQuotaBookings = quotaBookings ?? bookings;

  if (isGroupQuotaMode && slotQuota.scope === "PER_EVENT") {
    const { remainingTotal } = computeQuotaRemaining({
      slotQuota,
      scopedBookings: eventQuotaBookings,
    });
    if (remainingTotal <= 0) {
      return [];
    }
  }

  const stepMinutes =
    options.stepMinutes ?? (durationMinutes <= 15 ? durationMinutes : 15);
  const durationMs = durationMinutes * 60_000;
  const stepMs = stepMinutes * 60_000;
  const nowMs = now.getTime();

  const { year, month, day } = parseYmd(dateString);
  const inviteeDayStartMs = new TZDate(
    year,
    month - 1,
    day,
    0,
    0,
    0,
    0,
    inviteeTz
  ).getTime();
  const inviteeDayEndMs = new TZDate(
    year,
    month - 1,
    day + 1,
    0,
    0,
    0,
    0,
    inviteeTz
  ).getTime();

  const hostDatesMap = new Map<string, number>();
  for (
    let probeMs = inviteeDayStartMs;
    probeMs <= inviteeDayEndMs;
    probeMs += 6 * 3600_000
  ) {
    const info = formatYmdInTz(probeMs, hostTz);
    hostDatesMap.set(info.ymd, info.dayOfWeek);
  }
  const endInfo = formatYmdInTz(inviteeDayEndMs - 1, hostTz);
  hostDatesMap.set(endInfo.ymd, endInfo.dayOfWeek);

  const overridesByDate = new Map<string, DateOverrideInput>();
  for (const ov of dateOverrides) {
    overridesByDate.set(ov.date, ov);
  }

  const workingIntervals: UtcInterval[] = [];

  for (const [hostYmd, dayOfWeek] of hostDatesMap.entries()) {
    if (!isHostDateWithinBookingWindow(hostYmd, bookingWindow)) {
      continue;
    }

    if (isGroupQuotaMode && slotQuota.scope === "PER_DAY") {
      const dayBookings = eventQuotaBookings.filter(
        (b) => formatUtcToHostYmd(b.startTime.getTime(), hostTz) === hostYmd
      );
      const { remainingTotal } = computeQuotaRemaining({
        slotQuota,
        scopedBookings: dayBookings,
      });
      if (remainingTotal <= 0) {
        continue;
      }
    }

    const override = overridesByDate.get(hostYmd);

    if (override) {
      if (override.isUnavailable) {
        continue;
      }
      if (override.startTime && override.endTime) {
        const startMs = localWallTimeToUtcMs(
          hostYmd,
          override.startTime,
          hostTz
        );
        const endMs = localWallTimeToUtcMs(hostYmd, override.endTime, hostTz);
        if (endMs > startMs) {
          workingIntervals.push({ startMs, endMs });
        }
      }
      continue;
    }

    const dayRules = availabilities.filter((a) => a.dayOfWeek === dayOfWeek);
    for (const rule of dayRules) {
      const startMs = localWallTimeToUtcMs(hostYmd, rule.startTime, hostTz);
      const endMs = localWallTimeToUtcMs(hostYmd, rule.endTime, hostTz);
      if (endMs > startMs) {
        workingIntervals.push({ startMs, endMs });
      }
    }
  }

  if (workingIntervals.length === 0) {
    return [];
  }

  const blockedIntervals: UtcInterval[] = isGroupQuotaMode
    ? []
    : bookings.map((b) => {
        const padBeforeMin = Math.max(
          bufferAfterMinutes,
          b.bufferBeforeMinutes ?? bufferBeforeMinutes
        );
        const padAfterMin = Math.max(
          bufferBeforeMinutes,
          b.bufferAfterMinutes ?? bufferAfterMinutes
        );
        return {
          startMs: b.startTime.getTime() - padBeforeMin * 60_000,
          endMs: b.endTime.getTime() + padAfterMin * 60_000,
        };
      });

  const freeIntervals = subtractIntervals(workingIntervals, blockedIntervals);

  const slotIsoSet = new Set<string>();
  for (const interval of freeIntervals) {
    for (
      let slotStart = interval.startMs;
      slotStart + durationMs <= interval.endMs;
      slotStart += stepMs
    ) {
      if (
        slotStart > nowMs &&
        slotStart >= inviteeDayStartMs &&
        slotStart < inviteeDayEndMs
      ) {
        slotIsoSet.add(new Date(slotStart).toISOString());
      }
    }
  }

  return Array.from(slotIsoSet).sort();
}
