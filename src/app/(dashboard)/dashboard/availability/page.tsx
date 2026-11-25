import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AvailabilityEditorClient } from "@/components/availability/AvailabilityEditorClient";

export default async function AvailabilityPage() {
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

