"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security";

const uuidSchema = z.string().uuid();

export async function recordPageView(eventTypeId: string) {
  if (!uuidSchema.safeParse(eventTypeId).success) return;

  const allowed = await checkRateLimit({
    namespace: "pageview",
    limit: 30,
    windowMs: 60_000,
  });
  if (!allowed) return;

  try {
    await prisma.pageView.create({
      data: { eventTypeId },
    });
  } catch {
    // Non-blocking telemetry
  }
}
