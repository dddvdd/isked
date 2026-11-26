"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { isValidTimezone } from "@/lib/timezones";

const hhmmRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(hhmmRegex, "Invalid start time (HH:mm)"),
    endTime: z.string().regex(hhmmRegex, "Invalid end time (HH:mm)"),
  })
  .refine((s) => s.startTime < s.endTime, {
    message: "Shift end time must be after start time",
  });

const saveAvailabilitySchema = z.object({
  timezone: z.string().min(1).max(100).refine(isValidTimezone, "Invalid timezone"),
  shifts: z.array(shiftSchema).max(50, "Too many availability shifts"),
});

function hasOverlappingShifts(
  shifts: { dayOfWeek: number; startTime: string; endTime: string }[]
): string | null {
  const byDay = new Map<number, { startTime: string; endTime: string }[]>();
  for (const s of shifts) {
    const arr = byDay.get(s.dayOfWeek) ?? [];
    arr.push({ startTime: s.startTime, endTime: s.endTime });
    byDay.set(s.dayOfWeek, arr);
  }

  for (const [, dayShifts] of byDay) {
    const sorted = [...dayShifts].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        return "Shifts on the same day cannot overlap.";
      }
    }
  }
  return null;
}

export async function saveWeeklyAvailabilityAction(rawInput: {
  timezone: string;
  shifts: { dayOfWeek: number; startTime: string; endTime: string }[];
}) {
  const user = await requireCurrentUser();
  const parsed = saveAvailabilitySchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid availability input",
    };
  }

  const overlapError = hasOverlappingShifts(parsed.data.shifts);
  if (overlapError) {
    return { ok: false as const, error: overlapError };
  }

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { timezone: parsed.data.timezone },
      }),
      prisma.availability.deleteMany({
        where: { userId: user.id },
      }),
      ...(parsed.data.shifts.length > 0
        ? [
            prisma.availability.createMany({
              data: parsed.data.shifts.map((s) => ({
                userId: user.id,
                dayOfWeek: s.dayOfWeek,
                startTime: s.startTime,
                endTime: s.endTime,
              })),
            }),
          ]
        : []),
    ]);

    revalidatePath("/dashboard/availability");
    revalidatePath("/dashboard");
    return { ok: true as const };
  } catch (err) {
    console.error("Failed to save weekly availability:", err);
    return { ok: false as const, error: "Could not save availability." };
  }
}

const overrideInputSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    isUnavailable: z.boolean(),
    startTime: z.string().optional().nullable(),
    endTime: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.isUnavailable) {
      if (!data.startTime || !hhmmRegex.test(data.startTime)) {
        ctx.addIssue({
          code: "custom",
          path: ["startTime"],
          message: "Custom start time is required",
        });
      }
      if (!data.endTime || !hhmmRegex.test(data.endTime)) {
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "Custom end time is required",
        });
      }
      if (
        data.startTime &&
        data.endTime &&
        data.startTime >= data.endTime
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["endTime"],
          message: "End time must be after start time",
        });
      }
    }
  });

export async function upsertDateOverrideAction(rawInput: {
  date: string;
  isUnavailable: boolean;
  startTime?: string | null;
  endTime?: string | null;
}) {
  const user = await requireCurrentUser();
  const parsed = overrideInputSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid date override",
    };
  }

  const utcDate = new Date(`${parsed.data.date}T00:00:00.000Z`);

  await prisma.dateOverride.upsert({
    where: {
      userId_date: {
        userId: user.id,
        date: utcDate,
      },
    },
    create: {
      userId: user.id,
      date: utcDate,
      isUnavailable: parsed.data.isUnavailable,
      startTime: parsed.data.isUnavailable
        ? null
        : (parsed.data.startTime ?? null),
      endTime: parsed.data.isUnavailable
        ? null
        : (parsed.data.endTime ?? null),
    },
    update: {
      isUnavailable: parsed.data.isUnavailable,
      startTime: parsed.data.isUnavailable
        ? null
        : (parsed.data.startTime ?? null),
      endTime: parsed.data.isUnavailable
        ? null
        : (parsed.data.endTime ?? null),
    },
  });

  revalidatePath("/dashboard/availability");
  return { ok: true as const };
}

export async function deleteDateOverrideAction(id: string) {
  const user = await requireCurrentUser();
  const existing = await prisma.dateOverride.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false as const, error: "Date override not found" };
  }

  await prisma.dateOverride.delete({ where: { id } });
  revalidatePath("/dashboard/availability");
  return { ok: true as const };
}

