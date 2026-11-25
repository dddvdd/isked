"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAvailableDatesForMonth, getAvailableSlots } from "@/lib/slots";
import { isValidTimezone } from "@/lib/timezones";
import { parseCustomQuestions } from "@/lib/validations/event-type";
import {
  sendBookingCancellationEmail,
  sendBookingConfirmationEmail,
} from "@/lib/email";

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

const createBookingInputSchema = z.object({
  username: z.string().min(1),
  eventSlug: z.string().min(1),
  startTimeIso: z.string().datetime(),
  inviteeName: z.string().trim().min(1, "Your name is required").max(120),
  inviteeEmail: z.string().trim().email("Please enter a valid email address"),
  inviteeTimezone: z.string().min(1),
  notes: z.string().max(2000).optional(),
  customAnswers: z
    .record(z.string(), z.union([z.string(), z.boolean()]))
    .default({}),
});

export async function createBookingAction(rawInput: {
  username: string;
  eventSlug: string;
  startTimeIso: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  notes?: string;
  customAnswers?: Record<string, string | boolean>;
}) {
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
    inviteeName,
    inviteeEmail,
    notes,
    customAnswers,
  } = parsed.data;

  const inviteeTimezone = isValidTimezone(parsed.data.inviteeTimezone)
    ? parsed.data.inviteeTimezone
    : "UTC";

  const startUtc = new Date(startTimeIso);
  if (Number.isNaN(startUtc.getTime()) || startUtc <= new Date()) {
    return {
      ok: false as const,
      error: "Selected time slot is no longer in the future.",
    };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const host = await tx.user.findUnique({
        where: { username },
      });

      if (!host) {
        throw new Error("Host not found.");
      }

      const eventType = await tx.eventType.findFirst({
        where: {
          userId: host.id,
          slug: eventSlug,
          isActive: true,
        },
      });

      if (!eventType) {
        throw new Error("This event type is no longer available.");
      }

      // Validate required custom questions
      const questions = parseCustomQuestions(eventType.customQuestions);
      const formattedAnswers: Record<string, { label: string; value: string | boolean }> = {};

      for (const q of questions) {
        const val = customAnswers[q.id];
        if (q.required) {
          if (
            val === undefined ||
            val === "" ||
            (q.type === "checkbox" && val !== true)
          ) {
            throw new Error(`Please complete required field: "${q.label}"`);
          }
        }
        if (val !== undefined && val !== "") {
          formattedAnswers[q.id] = { label: q.label, value: val };
        }
      }

      const endUtc = new Date(
        startUtc.getTime() + eventType.durationMinutes * 60_000
      );

      // Double-booking check including bufferBefore & bufferAfter on both sides
      const searchStart = new Date(startUtc.getTime() - 4 * 3600_000);
      const searchEnd = new Date(endUtc.getTime() + 4 * 3600_000);

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
        const blockedStart =
          b.startTime.getTime() - padBeforeMin * 60_000;
        const blockedEnd = b.endTime.getTime() + padAfterMin * 60_000;

        return (
          startUtc.getTime() < blockedEnd && endUtc.getTime() > blockedStart
        );
      });

      if (hasConflict) {
        throw new Error(
          "This time slot was just booked by someone else. Please pick another time."
        );
      }

      const booking = await tx.booking.create({
        data: {
          eventTypeId: eventType.id,
          hostId: host.id,
          inviteeName,
          inviteeEmail,
          inviteeTimezone,
          startTime: startUtc,
          endTime: endUtc,
          status: "CONFIRMED",
          formResponses: {
            notes: notes?.trim() || null,
            answers: formattedAnswers,
          } as Prisma.InputJsonValue,
        },
      });

      return { booking, host, eventType };
    });

    // Fire confirmation email asynchronously without failing the booking if Resend fails
    sendBookingConfirmationEmail({
      uid: result.booking.uid,
      eventTitle: result.eventType.title,
      eventDescription: result.eventType.description,
      location: result.eventType.location,
      hostName: result.host.name ?? result.host.username,
      hostEmail: result.host.email,
      inviteeName: result.booking.inviteeName,
      inviteeEmail: result.booking.inviteeEmail,
      inviteeTimezone: result.booking.inviteeTimezone,
      startTime: result.booking.startTime,
      endTime: result.booking.endTime,
    }).catch((err) => {
      console.error("Failed to send booking confirmation email:", err);
    });

    revalidatePath(`/${username}/${eventSlug}`);
    revalidatePath("/dashboard/bookings");
    revalidatePath("/dashboard/analytics");

    let finalRedirectUrl: string | null = null;
    if (
      result.eventType.postBookingBehavior === "REDIRECT" &&
      result.eventType.redirectUrl
    ) {
      try {
        const target = new URL(result.eventType.redirectUrl);
        target.searchParams.set("booking_uid", result.booking.uid);
        target.searchParams.set("event_type", result.eventType.slug);
        target.searchParams.set("invitee_name", result.booking.inviteeName);
        target.searchParams.set("invitee_email", result.booking.inviteeEmail);
        target.searchParams.set(
          "start_time",
          result.booking.startTime.toISOString()
        );
        target.searchParams.set(
          "end_time",
          result.booking.endTime.toISOString()
        );
        finalRedirectUrl = target.toString();
      } catch {
        finalRedirectUrl = null;
      }
    }

    return {
      ok: true as const,
      uid: result.booking.uid,
      redirectUrl: finalRedirectUrl,
    };
  } catch (err) {
    return {
      ok: false as const,
      error:
        err instanceof Error ? err.message : "Could not complete booking.",
    };
  }
}

export async function cancelBookingAction(input: {
  uid: string;
  reason?: string;
}) {
  const uid = input.uid.trim();
  if (!uid) {
    return { ok: false as const, error: "Invalid booking identifier" };
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

  if (booking.status === "CANCELLED") {
    return { ok: true as const };
  }

  const reason = input.reason?.trim().slice(0, 1000) || null;

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

