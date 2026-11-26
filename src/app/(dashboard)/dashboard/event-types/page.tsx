import { Suspense } from "react";
import { connection } from "next/server";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLocationDistribution } from "@/lib/validations/event-type";
import { EventTypeListClient } from "@/components/event-types/EventTypeListClient";

async function EventTypesContent() {
  await connection();
  const user = await requireCurrentUser();
  const eventTypes = await prisma.eventType.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { bookings: true },
      },
    },
  });

  return (
    <EventTypeListClient
      username={user.username}
      items={eventTypes.map((et) => {
        const dist = parseLocationDistribution(et.locationDistribution);
        return {
          id: et.id,
          title: et.title,
          slug: et.slug,
          description: et.description,
          durationMinutes: et.durationMinutes,
          location: et.location,
          isActive: et.isActive,
          bookingsCount: et._count.bookings,
          slotLimitScope: et.slotLimitScope,
          slotLimit: et.slotLimit,
          locationLevel: dist.level,
        };
      })}
    />
  );
}

function EventTypesFallback() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-8 w-40 animate-pulse rounded bg-muted" />
        <div className="h-4 w-64 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl border bg-card" />
        <div className="h-40 animate-pulse rounded-xl border bg-card" />
      </div>
    </div>
  );
}

export default function EventTypesPage() {
  return (
    <Suspense fallback={<EventTypesFallback />}>
      <EventTypesContent />
    </Suspense>
  );
}
