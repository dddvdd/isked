import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EventTypeListClient } from "@/components/event-types/EventTypeListClient";

export default async function EventTypesPage() {
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
      items={eventTypes.map((et) => ({
        id: et.id,
        title: et.title,
        slug: et.slug,
        description: et.description,
        durationMinutes: et.durationMinutes,
        location: et.location,
        isActive: et.isActive,
        bookingsCount: et._count.bookings,
      }))}
    />
  );
}
