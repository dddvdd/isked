"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  buildBookingWindowFromEventType,
  buildSlotQuotaFromEventType,
  computeAvailableSlots,
  computeQuotaRemaining,
  formatUtcToHostYmd,
  getAvailableDatesForMonth,
  getAvailableSlots,
  isHostDateWithinBookingWindow,
  type QuotaLocationAllocation,
} from "@/lib/slots";
import { isValidTimezone } from "@/lib/timezones";
import { parseCustomQuestions } from "@/lib/validations/event-type";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
} from "@/lib/email";
import {
  SafeAppError,
  checkRateLimit,
  emailsMatchTimingSafe,
  generateSecureBookingUid,
  sanitizeRedirectUrl,
} from "@/lib/security";

export async function fetchAvailableMonthAction(params: {
  username: string;
  eventSlug: string;
  yearMonth: string;
  inviteeTimezone: string;
}) {
  return getAvailableDatesForMonth(
    params.username,
    params.eventSlug,
    params.yearMonth,
    params.inviteeTimezone
  );
}

export async function fetchAvailableSlotsAction(params: {
  username: string;
  eventSlug: string;
  dateString: string;
  inviteeTimezone: string;
}) {
  return getAvailableSlots(
    params.username,
    params.eventSlug,
    params.dateString,
    params.inviteeTimezone
  );
}

function buildEligibleLocationMessage(
  level: "PROVINCE" | "MUNICIPALITY" | "BARANGAY",
  allocations: QuotaLocationAllocation[],
  submittedAddress: {
    provinceCode: string;
    municipalityCode: string;
    barangayCode: string;
  }
): string {
  const active = allocations.filter((a) => a.slots > 0);
  if (active.length === 0) {
    return "Sorry, slots for this event are not available for your selected address.";
  }

  const formatList = (names: string[], maxShown = 8) => {
    const unique = Array.from(new Set(names.filter(Boolean)));
    if (unique.length <= maxShown) return unique.join(", ");
    return `${unique.slice(0, maxShown).join(", ")}, and ${
      unique.length - maxShown
    } more`;
  };

  if (level === "PROVINCE") {
    const provs = formatList(active.map((a) => a.name));
    return `Sorry, slots for this event are only available for the following Province(s): ${provs}.`;
  }

  if (level === "MUNICIPALITY") {
    const parentProvs = Array.from(
      new Set(
        active
          .map((a) => a.provinceName)
          .filter((n): n is string => Boolean(n))
      )
    );
    const sameProvince =
      parentProvs.length === 1 &&
      active.every((a) => a.provinceCode === submittedAddress.provinceCode);

    if (active.length <= 8 || sameProvince) {
      const munis = formatList(
        active.map((a) =>
          parentProvs.length > 1 && a.provinceName
            ? `${a.name} (${a.provinceName})`
            : a.name
        )
      );
      const provSuffix =
        parentProvs.length === 1 ? ` in ${parentProvs[0]}` : "";
      return `Sorry, slots for this event are only available for the following Municipality/City(ies)${provSuffix}: ${munis}.`;
    }

    return `Sorry, slots for this event are only available for selected Municipalities/Cities in ${formatList(
      parentProvs
    )}.`;
  }

  // BARANGAY level
  const parentAreas = Array.from(
    new Set(
      active
        .map((a) =>
          [a.municipalityName, a.provinceName].filter(Boolean).join(", ")
        )
        .filter(Boolean)
    )
  );
  const inAllocatedMunicipality = active.some(
    (a) => a.municipalityCode === submittedAddress.municipalityCode
  );

  if (!inAllocatedMunicipality && parentAreas.length > 0 && active.length > 8) {
    return `Sorry, slots for this event are only available for selected Barangays in ${formatList(
      parentAreas
    )}.`;
  }

  const relevant = inAllocatedMunicipality
    ? active.filter(
        (a) => a.municipalityCode === submittedAddress.municipalityCode
      )
    : active;
  const brgyNames = formatList(relevant.map((a) => a.name), 10);
  const areaSuffix =
    parentAreas.length === 1 ? ` (${parentAreas[0]})` : "";

  return `Sorry, slots for this event are only available for the following Barangay(s)${areaSuffix}: ${brgyNames}.`;
}

const customAnswerValueSchema = z.union([
  z.string().max(2000),
  z.boolean(),
  z.array(z.string().max(200)).max(50),
]);

const psgcAddressSchema = z.object({
  provinceCode: z.string().trim().regex(/^\d{9,10}$/, "Invalid province code"),
  province: z.string().trim().min(1, "Province is required").max(120),
  municipalityCode: z
    .string()
    .trim()
    .regex(/^\d{9,10}$/, "Invalid municipality code"),
  municipality: z
    .string()
    .trim()
    .min(1, "Municipality / City is required")
    .max(120),
  barangayCode: z.string().trim().regex(/^\d{9,10}$/, "Invalid barangay code"),
  barangay: z.string().trim().min(1, "Barangay is required").max(120),
});

const createBookingInputSchema = z.object({
  username: z.string().trim().min(1).max(60),
  eventSlug: z.string().trim().min(1).max(80),
  startTimeIso: z.string().datetime(),
  firstName: z.string().trim().min(1, "First name is required").max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  suffix: z.string().trim().max(20).optional(),
  inviteeEmail: z
    .string()
    .trim()
    .email("Please enter a valid email address")
    .max(254),
  inviteeTimezone: z.string().trim().min(1).max(100),
  address: psgcAddressSchema,
  privacyConsent: z.literal(true, {
    error: "You must consent to the Data Privacy Notice and Terms of Use.",
  }),
  notes: z.string().max(2000).optional(),
  customAnswers: z.record(z.string().max(100), customAnswerValueSchema).default({}),
});

export async function createBookingAction(rawInput: {
  username: string;
  eventSlug: string;
  startTimeIso: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  address: {
    provinceCode: string;
    province: string;
    municipalityCode: string;
    municipality: string;
    barangayCode: string;
    barangay: string;
  };
  privacyConsent: boolean;
  notes?: string;
  customAnswers?: Record<string, string | boolean | string[]>;
}) {
  const allowedByRateLimit = await checkRateLimit({
    namespace: "create-booking",
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!allowedByRateLimit) {
    return {
      ok: false as const,
      error: "Too many booking attempts. Please wait a few minutes and try again.",
    };
  }

  const parsed = createBookingInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid booking details",
    };
  }

  const {
    username,
    eventSlug,
    startTimeIso,
    firstName,
    middleName,
    lastName,
    suffix,
    inviteeEmail,
    address,
    notes,
    customAnswers,
  } = parsed.data;

  const inviteeName = [firstName, middleName, lastName, suffix]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");

  const inviteeTimezone = isValidTimezone(parsed.data.inviteeTimezone)
    ? parsed.data.inviteeTimezone
    : "UTC";

  const now = new Date();
  const startUtc = new Date(startTimeIso);
  if (Number.isNaN(startUtc.getTime()) || startUtc <= now) {
    return {
      ok: false as const,
      error: "Selected time slot is no longer in the future.",
    };
  }

  try {
    const host = await prisma.user.findUnique({
      where: { username },
      include: {
        availabilities: true,
        eventTypes: {
          where: { slug: eventSlug, isActive: true },
          take: 1,
        },
      },
    });

    if (!host) {
      return { ok: false as const, error: "Host not found." };
    }

    const eventType = host.eventTypes[0];
    if (!eventType) {
      return {
        ok: false as const,
        error: "This event type is no longer available.",
      };
    }

    const bookingWindow = buildBookingWindowFromEventType(eventType);
    const hostDateYmd = formatUtcToHostYmd(startUtc.getTime(), host.timezone);
    if (!isHostDateWithinBookingWindow(hostDateYmd, bookingWindow)) {
      return { ok: false as const, error: "This date is not open for booking." };
    }

    // Verify the requested UTC start time matches the host's working schedule / date overrides
    const overrideWindowStart = new Date(startUtc.getTime() - 48 * 3600_000);
    const overrideWindowEnd = new Date(startUtc.getTime() + 48 * 3600_000);
    const overrides = await prisma.dateOverride.findMany({
      where: {
        userId: host.id,
        date: { gte: overrideWindowStart, lte: overrideWindowEnd },
      },
    });

    const validScheduleSlots = computeAvailableSlots({
      dateString: hostDateYmd,
      inviteeTimezone: host.timezone,
      hostTimezone: host.timezone,
      durationMinutes: eventType.durationMinutes,
      bufferBeforeMinutes: eventType.bufferBeforeMinutes,
      bufferAfterMinutes: eventType.bufferAfterMinutes,
      bookingWindow,
      availabilities: host.availabilities.map((a) => ({
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
      bookings: [],
      now,
    });

    if (!validScheduleSlots.includes(startUtc.toISOString())) {
      return {
        ok: false as const,
        error: "Selected time slot is outside the host's available hours.",
      };
    }

    // Validate custom questions
    const questions = parseCustomQuestions(eventType.customQuestions);
    const formattedAnswers: Record<
      string,
      { label: string; value: string | boolean | string[] }
    > = {};

    for (const q of questions) {
      const val = customAnswers[q.id];
      const isMultiCheckbox =
        q.type === "checkbox" && Boolean(q.options && q.options.length > 0);

      if (q.required) {
        if (isMultiCheckbox) {
          if (!Array.isArray(val) || val.length === 0) {
            return {
              ok: false as const,
              error: `Please select at least one option for "${q.label}"`,
            };
          }
        } else if (q.type === "checkbox") {
          if (val !== true) {
            return {
              ok: false as const,
              error: `Please complete required field: "${q.label}"`,
            };
          }
        } else if (typeof val !== "string" || val.trim() === "") {
          return {
            ok: false as const,
            error: `Please complete required field: "${q.label}"`,
          };
        }
      }

      if (q.type === "email" && typeof val === "string" && val.trim() !== "") {
        if (!z.string().email().safeParse(val.trim()).success) {
          return {
            ok: false as const,
            error: `Please enter a valid email for "${q.label}"`,
          };
        }
      }

      if (q.type === "phone" && typeof val === "string" && val.trim() !== "") {
        const digits = val.replace(/\D/g, "");
        if (digits.length < 7 || digits.length > 15) {
          return {
            ok: false as const,
            error: `Please enter a valid contact number for "${q.label}"`,
          };
        }
      }

      const hasValue = Array.isArray(val)
        ? val.length > 0
        : typeof val === "boolean"
          ? val
          : typeof val === "string" && val.trim() !== "";

      if (hasValue && val !== undefined) {
        formattedAnswers[q.id] = {
          label: q.label,
          value: typeof val === "string" ? val.trim() : val,
        };
      }
    }

    const endUtc = new Date(
      startUtc.getTime() + eventType.durationMinutes * 60_000
    );

    const searchStart = new Date(startUtc.getTime() - 4 * 3600_000);
    const searchEnd = new Date(endUtc.getTime() + 4 * 3600_000);
    const dayWindowStart = new Date(startUtc.getTime() - 36 * 3600_000);
    const dayWindowEnd = new Date(startUtc.getTime() + 36 * 3600_000);
    const slotQuota = buildSlotQuotaFromEventType(eventType);
    const secureUid = generateSecureBookingUid();
    const consentTimestamp = new Date().toISOString();

    const booking = await prisma.$transaction(
      async (tx) => {
        // Acquire a row-level lock on EventType to serialize concurrent quota checks
        await tx.eventType.update({
          where: { id: eventType.id },
          data: { isActive: eventType.isActive },
        });

        if (slotQuota.scope === "NONE") {
          const nearbyBookings = await tx.booking.findMany({
            where: {
              hostId: host.id,
              status: "CONFIRMED",
              startTime: { lt: searchEnd },
              endTime: { gt: searchStart },
            },
            include: {
              eventType: {
                select: {
                  bufferBeforeMinutes: true,
                  bufferAfterMinutes: true,
                },
              },
            },
          });

          const hasConflict = nearbyBookings.some((b) => {
            const padBeforeMin = Math.max(
              eventType.bufferAfterMinutes,
              b.eventType.bufferBeforeMinutes
            );
            const padAfterMin = Math.max(
              eventType.bufferBeforeMinutes,
              b.eventType.bufferAfterMinutes
            );
            const blockedStart = b.startTime.getTime() - padBeforeMin * 60_000;
            const blockedEnd = b.endTime.getTime() + padAfterMin * 60_000;

            return (
              startUtc.getTime() < blockedEnd && endUtc.getTime() > blockedStart
            );
          });

          if (hasConflict) {
            throw new SafeAppError(
              "This time slot was just booked by someone else. Please pick another time."
            );
          }
        } else {
          const rawQuotaBookings =
            slotQuota.scope === "PER_EVENT"
              ? await tx.booking.findMany({
                  where: {
                    eventTypeId: eventType.id,
                    status: "CONFIRMED",
                  },
                  select: { startTime: true, formResponses: true },
                })
              : await tx.booking.findMany({
                  where: {
                    eventTypeId: eventType.id,
                    status: "CONFIRMED",
                    startTime: { gte: dayWindowStart, lte: dayWindowEnd },
                  },
                  select: { startTime: true, formResponses: true },
                });

          const scopedBookings =
            slotQuota.scope === "PER_EVENT"
              ? rawQuotaBookings
              : rawQuotaBookings.filter(
                  (b) =>
                    formatUtcToHostYmd(b.startTime.getTime(), host.timezone) ===
                    hostDateYmd
                );

          const { remainingTotal, remainingByCode } = computeQuotaRemaining({
            slotQuota,
            scopedBookings,
          });

          if (remainingTotal <= 0) {
            throw new SafeAppError(
              slotQuota.scope === "PER_DAY"
                ? "Sorry, all slots for this date have been filled. Please choose another date."
                : "Sorry, all slots for this event have been filled."
            );
          }

          const level = slotQuota.locationLevel ?? "NONE";
          if (level !== "NONE") {
            const submittedCode =
              level === "PROVINCE"
                ? address.provinceCode
                : level === "MUNICIPALITY"
                  ? address.municipalityCode
                  : address.barangayCode;

            const allocations = slotQuota.allocations ?? [];
            const matchedAlloc = allocations.find(
              (a) => a.code === submittedCode
            );

            const hierarchyMismatch =
              (matchedAlloc?.provinceCode &&
                matchedAlloc.provinceCode !== address.provinceCode) ||
              (matchedAlloc?.municipalityCode &&
                matchedAlloc.municipalityCode !== address.municipalityCode);

            if (!matchedAlloc || matchedAlloc.slots <= 0 || hierarchyMismatch) {
              throw new SafeAppError(
                buildEligibleLocationMessage(level, allocations, address)
              );
            }

            const locRemaining = remainingByCode.get(submittedCode) ?? 0;
            if (locRemaining <= 0) {
              throw new SafeAppError(
                slotQuota.scope === "PER_DAY"
                  ? `Sorry, all slots for ${matchedAlloc.name} on this date have been filled. Please choose another date.`
                  : `Sorry, all slots for ${matchedAlloc.name} have been filled.`
              );
            }
          }
        }

        return tx.booking.create({
          data: {
            uid: secureUid,
            eventTypeId: eventType.id,
            hostId: host.id,
            inviteeName,
            inviteeEmail,
            inviteeTimezone,
            startTime: startUtc,
            endTime: endUtc,
            status: "CONFIRMED",
            formResponses: {
              nameDetails: {
                firstName,
                middleName: middleName?.trim() || null,
                lastName,
                suffix: suffix?.trim() || null,
              },
              address,
              privacyConsent: true,
              privacyConsentAt: consentTimestamp,
              notes: eventType.showAdditionalNotes
                ? notes?.trim() || null
                : null,
              answers: formattedAnswers,
            } as Prisma.InputJsonValue,
          },
        });
      },
      {
        maxWait: 15000,
        timeout: 20000,
      }
    );

    sendBookingConfirmationEmail({
      uid: booking.uid,
      eventTitle: eventType.title,
      eventDescription: eventType.description,
      location: eventType.location,
      hostName: host.name ?? host.username,
      hostEmail: host.email,
      inviteeName: booking.inviteeName,
      inviteeEmail: booking.inviteeEmail,
      inviteeTimezone: booking.inviteeTimezone,
      startTime: booking.startTime,
      endTime: booking.endTime,
    }).catch((err) => {
      console.error("Failed to send booking confirmation email:", err);
    });

    revalidatePath(`/${username}/${eventSlug}`);
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/analytics");

    let finalRedirectUrl: string | null = null;
    if (
      eventType.postBookingBehavior === "REDIRECT" &&
      eventType.redirectUrl
    ) {
      const safeTarget = sanitizeRedirectUrl(eventType.redirectUrl);
      if (safeTarget) {
        safeTarget.searchParams.set("booking_uid", booking.uid);
        safeTarget.searchParams.set("event_type", eventType.slug);
        safeTarget.searchParams.set(
          "start_time",
          booking.startTime.toISOString()
        );
        safeTarget.searchParams.set("end_time", booking.endTime.toISOString());
        finalRedirectUrl = safeTarget.toString();
      }
    }

    return {
      ok: true as const,
      uid: booking.uid,
      redirectUrl: finalRedirectUrl,
    };
  } catch (err) {
    if (err instanceof SafeAppError) {
      return { ok: false as const, error: err.message };
    }
    console.error("Booking creation error:", err);
    return {
      ok: false as const,
      error: "Could not complete booking. Please try again.",
    };
  }
}

export async function cancelBookingAction(input: {
  uid: string;
  reason?: string;
  confirmEmail?: string;
}) {
  const allowed = await checkRateLimit({
    namespace: "cancel-booking",
    limit: 10,
    windowMs: 10 * 60_000,
  });
  if (!allowed) {
    return {
      ok: false as const,
      error: "Too many cancellation attempts. Please wait a few minutes.",
    };
  }

  const uid = input.uid.trim();
  if (!uid || uid.length > 100) {
    return { ok: false as const, error: "Invalid booking identifier" };
  }

  // Per-booking limit prevents guessing the invitee email for a known booking link
  const perBookingAllowed = await checkRateLimit({
    namespace: "cancel-booking-uid",
    identifier: uid,
    limit: 5,
    windowMs: 60 * 60_000,
  });
  if (!perBookingAllowed) {
    return {
      ok: false as const,
      error: "Too many cancellation attempts for this booking. Please try again later.",
    };
  }

  const booking = await prisma.booking.findUnique({
    where: { uid },
    include: {
      eventType: true,
      host: true,
    },
  });

  if (!booking) {
    return { ok: false as const, error: "Booking not found" };
  }

  // Authorization: must be either the authenticated host OR verify the invitee's email address
  const currentUser = await getCurrentUser();
  const isHostOwner = currentUser?.id === booking.hostId;

  if (!isHostOwner) {
    const providedEmail = input.confirmEmail?.trim() ?? "";
    if (
      !providedEmail ||
      !emailsMatchTimingSafe(providedEmail, booking.inviteeEmail)
    ) {
      return {
        ok: false as const,
        error:
          "Please enter the exact email address used when booking to confirm cancellation.",
      };
    }
  }

  if (booking.status === "CANCELLED") {
    return { ok: true as const };
  }

  const reason = input.reason?.trim().slice(0, 500) || null;

  await prisma.booking.update({
    where: { uid },
    data: {
      status: "CANCELLED",
      cancellationReason: reason,
    },
  });

  sendBookingCancellationEmail({
    eventTitle: booking.eventType.title,
    hostName: booking.host.name ?? booking.host.username,
    hostEmail: booking.host.email,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    inviteeTimezone: booking.inviteeTimezone,
    startTime: booking.startTime,
    reason,
  }).catch((err) => {
    console.error("Failed to send cancellation email:", err);
  });

  revalidatePath(`/booking/${uid}/cancel`);
  revalidatePath(`/booking/${uid}/confirmed`);
  revalidatePath("/dashboard/bookings");
  revalidatePath("/dashboard/analytics");

  return { ok: true as const };
}
