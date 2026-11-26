import { Suspense } from "react";
import { connection } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvailabilityEditorClient } from "@/components/availability/AvailabilityEditorClient";

async function AvailabilityContent() {
  await connection();
  const user = await requireCurrentUser();

  const [availabilities, dateOverrides] = await Promise.all([
    prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    prisma.dateOverride.findMany({
      where: { userId: user.id },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <AvailabilityEditorClient
      initialTimezone={user.timezone}
      initialShifts={availabilities.map((a) => ({
        dayOfWeek: a.dayOfWeek,
        startTime: a.startTime,
        endTime: a.endTime,
      }))}
      initialOverrides={dateOverrides.map((d) => ({
        id: d.id,
        date: d.date.toISOString().slice(0, 10),
        isUnavailable: d.isUnavailable,
        startTime: d.startTime,
        endTime: d.endTime,
      }))}
    />
  );
}

function AvailabilityFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="h-8 w-40 animate-pulse rounded bg-muted" />
      <div className="h-28 animate-pulse rounded-xl border bg-card" />
      <div className="h-80 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <Suspense fallback={<AvailabilityFallback />}>
      <AvailabilityContent />
    </Suspense>
  );
}
