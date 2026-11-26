"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import {
  eventTypeInputSchema,
  slugify,
  type EventTypeInput,
} from "@/lib/validations/event-type";

export async function createEventTypeAction(input: {
  title: string;
  slug?: string;
  durationMinutes: number;
  description?: string;
  location?: string;
}) {
  const user = await requireCurrentUser();
  const baseSlug = slugify(input.slug || input.title) || "meeting";

  let finalSlug = baseSlug;
  for (let i = 1; i <= 10; i++) {
    const existing = await prisma.eventType.findUnique({
      where: {
        userId_slug: {
          userId: user.id,
          slug: finalSlug,
        },
      },
      select: { id: true },
    });
    if (!existing) break;
    finalSlug = `${baseSlug}-${i + 1}`;
  }

  const parsed = eventTypeInputSchema.safeParse({
    title: input.title,
    slug: finalSlug,
    durationMinutes: input.durationMinutes,
    description: input.description ?? "",
    location: input.location ?? "Google Meet",
    bufferBeforeMinutes: 0,
    bufferAfterMinutes: 0,
    isActive: true,
    showAdditionalNotes: true,
    customQuestions: [],
    postBookingBehavior: "CONFIRMATION_PAGE",
    redirectUrl: null,
  });

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid event type input",
    };
  }

  try {
    const created = await prisma.eventType.create({
      data: {
        userId: user.id,
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description || null,
        durationMinutes: parsed.data.durationMinutes,
        bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
        bufferAfterMinutes: parsed.data.bufferAfterMinutes,
        location: parsed.data.location || null,
        isActive: parsed.data.isActive,
        showAdditionalNotes: parsed.data.showAdditionalNotes,
        customQuestions: parsed.data.customQuestions as Prisma.InputJsonValue,
        bookingWindowType: parsed.data.bookingWindowType,
        bookingStartDate:
          parsed.data.bookingWindowType === "DATE_RANGE" &&
          parsed.data.bookingStartDate
            ? new Date(`${parsed.data.bookingStartDate}T00:00:00.000Z`)
            : null,
        bookingEndDate:
          parsed.data.bookingWindowType === "DATE_RANGE" &&
          parsed.data.bookingEndDate
            ? new Date(`${parsed.data.bookingEndDate}T00:00:00.000Z`)
            : null,
        allowedDates: (parsed.data.bookingWindowType === "SPECIFIC_DATES"
          ? Array.from(new Set(parsed.data.allowedDates)).sort()
          : []) as Prisma.InputJsonValue,
        slotLimitScope: parsed.data.slotLimitScope,
        slotLimit:
          parsed.data.slotLimitScope === "NONE"
            ? null
            : (parsed.data.slotLimit ?? null),
        locationDistribution: (parsed.data.slotLimitScope === "NONE" ||
        parsed.data.locationDistribution.level === "NONE"
          ? { level: "NONE", allocations: [] }
          : parsed.data.locationDistribution) as Prisma.InputJsonValue,
        postBookingBehavior: parsed.data.postBookingBehavior,
        redirectUrl: null,
      },
    });

    revalidatePath("/dashboard/event-types");
    return { ok: true as const, id: created.id };
  } catch (err) {
    console.error("Failed to create event type:", err);
    return { ok: false as const, error: "Could not create event type." };
  }
}

export async function updateEventTypeAction(
  id: string,
  rawInput: EventTypeInput
) {
  const user = await requireCurrentUser();

  const existing = await prisma.eventType.findFirst({
    where: { id, userId: user.id },
  });

  if (!existing) {
    return { ok: false as const, error: "Event type not found" };
  }

  const parsed = eventTypeInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Validation failed",
    };
  }

  const duplicateSlug = await prisma.eventType.findFirst({
    where: {
      userId: user.id,
      slug: parsed.data.slug,
      NOT: { id },
    },
    select: { id: true },
  });

  if (duplicateSlug) {
    return {
      ok: false as const,
      error: `You already have an event type with slug "${parsed.data.slug}".`,
    };
  }

  try {
    await prisma.eventType.update({
      where: { id },
      data: {
        title: parsed.data.title,
        slug: parsed.data.slug,
        description: parsed.data.description?.trim() || null,
        durationMinutes: parsed.data.durationMinutes,
        bufferBeforeMinutes: parsed.data.bufferBeforeMinutes,
        bufferAfterMinutes: parsed.data.bufferAfterMinutes,
        location: parsed.data.location?.trim() || null,
        isActive: parsed.data.isActive,
        showAdditionalNotes: parsed.data.showAdditionalNotes,
        customQuestions: parsed.data.customQuestions as Prisma.InputJsonValue,
        bookingWindowType: parsed.data.bookingWindowType,
        bookingStartDate:
          parsed.data.bookingWindowType === "DATE_RANGE" &&
          parsed.data.bookingStartDate
            ? new Date(`${parsed.data.bookingStartDate}T00:00:00.000Z`)
            : null,
        bookingEndDate:
          parsed.data.bookingWindowType === "DATE_RANGE" &&
          parsed.data.bookingEndDate
            ? new Date(`${parsed.data.bookingEndDate}T00:00:00.000Z`)
            : null,
        allowedDates: (parsed.data.bookingWindowType === "SPECIFIC_DATES"
          ? Array.from(new Set(parsed.data.allowedDates)).sort()
          : []) as Prisma.InputJsonValue,
        slotLimitScope: parsed.data.slotLimitScope,
        slotLimit:
          parsed.data.slotLimitScope === "NONE"
            ? null
            : (parsed.data.slotLimit ?? null),
        locationDistribution: (parsed.data.slotLimitScope === "NONE" ||
        parsed.data.locationDistribution.level === "NONE"
          ? { level: "NONE", allocations: [] }
          : parsed.data.locationDistribution) as Prisma.InputJsonValue,
        postBookingBehavior: parsed.data.postBookingBehavior,
        redirectUrl:
          parsed.data.postBookingBehavior === "REDIRECT"
            ? parsed.data.redirectUrl?.trim() || null
            : null,
      },
    });

    revalidatePath("/dashboard/event-types");
    revalidatePath(`/dashboard/event-types/${id}`);
    revalidatePath(`/${user.username}/${parsed.data.slug}`);

    return { ok: true as const };
  } catch (err) {
    console.error("Failed to update event type:", err);
    return { ok: false as const, error: "Could not save event type changes." };
  }
}

export async function toggleEventTypeActiveAction(
  id: string,
  isActive: boolean
) {
  const user = await requireCurrentUser();

  const existing = await prisma.eventType.findFirst({
    where: { id, userId: user.id },
    select: { id: true, slug: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Event type not found" };
  }

  await prisma.eventType.update({
    where: { id },
    data: { isActive },
  });

  revalidatePath("/dashboard/event-types");
  revalidatePath(`/${user.username}/${existing.slug}`);
  return { ok: true as const };
}

export async function deleteEventTypeAction(id: string) {
  const user = await requireCurrentUser();

  const existing = await prisma.eventType.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Event type not found" };
  }

  await prisma.eventType.delete({ where: { id } });
  revalidatePath("/dashboard/event-types");
  return { ok: true as const };
}

