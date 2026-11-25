"use server";

import { prisma } from "@/lib/prisma";

export async function recordPageView(eventTypeId: string) {
  if (!eventTypeId) return;
  try {
    await prisma.pageView.create({
      data: { eventTypeId },
    });
  } catch {
    // Non-blocking telemetry
  }
}

