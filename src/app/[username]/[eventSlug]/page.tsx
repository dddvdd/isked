import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { parseCustomQuestions } from "@/lib/validations/event-type";
import { PublicBookingClient } from "@/components/booking/PublicBookingClient";

async function PublicEventBookingContent({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  const { username, eventSlug } = await params;

  const host = await prisma.user.findUnique({
    where: { username },
    include: {
      eventTypes: {
        where: { slug: eventSlug, isActive: true },
        take: 1,
      },
    },
  });

  const eventType = host?.eventTypes[0];
  if (!host || !eventType) {
    notFound();
  }

  const now = new Date();
  const initialYearMonth = `${now.getUTCFullYear()}-${String(
    now.getUTCMonth() + 1
  ).padStart(2, "0")}`;

  return (
    <PublicBookingClient
      eventTypeId={eventType.id}
      username={host.username}
      hostName={host.name ?? host.username}
      hostAvatarUrl={host.avatarUrl}
      hostTimezone={host.timezone}
      eventTitle={eventType.title}
      eventSlug={eventType.slug}
      description={eventType.description}
      durationMinutes={eventType.durationMinutes}
      location={eventType.location}
      customQuestions={parseCustomQuestions(eventType.customQuestions)}
      initialYearMonth={initialYearMonth}
    />
  );
}

export default function PublicEventBookingPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <Suspense
        fallback={
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        }
      >
        <PublicEventBookingContent params={params} />
      </Suspense>
    </div>
  );
}
