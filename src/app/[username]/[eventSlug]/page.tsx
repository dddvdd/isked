import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { Loader2 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  parseAllowedDates,
  parseCustomQuestions,
} from "@/lib/validations/event-type";
import {
  formatUtcToHostYmd,
  getAvailableDatesForMonth,
  getAvailableSlots,
} from "@/lib/slots";
import { PublicBookingClient } from "@/components/booking/PublicBookingClient";
import { MascotWalkway } from "@/components/landing/MascotWalkway";
import { SiteFooter } from "@/components/landing/SiteFooter";

async function PublicEventBookingContent({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  await connection();
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
  const todayHostYmd = formatUtcToHostYmd(now.getTime(), host.timezone);
  let initialYearMonth = todayHostYmd.slice(0, 7);

  if (
    eventType.bookingWindowType === "DATE_RANGE" &&
    eventType.bookingStartDate
  ) {
    const startYmd = eventType.bookingStartDate.toISOString().slice(0, 10);
    if (startYmd > todayHostYmd) {
      initialYearMonth = startYmd.slice(0, 7);
    }
  } else if (eventType.bookingWindowType === "SPECIFIC_DATES") {
    const allowed = parseAllowedDates(eventType.allowedDates);
    const nextAllowed = allowed.find((d) => d >= todayHostYmd);
    if (nextAllowed) {
      initialYearMonth = nextAllowed.slice(0, 7);
    }
  }

  const initialAvailableDates = await getAvailableDatesForMonth(
    host.username,
    eventType.slug,
    initialYearMonth,
    host.timezone
  );

  const initialSlots = initialAvailableDates[0]
    ? await getAvailableSlots(
        host.username,
        eventType.slug,
        initialAvailableDates[0],
        host.timezone
      )
    : [];

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
      showAdditionalNotes={eventType.showAdditionalNotes}
      customQuestions={parseCustomQuestions(eventType.customQuestions)}
      initialYearMonth={initialYearMonth}
      initialAvailableDates={initialAvailableDates}
      initialSlots={initialSlots}
    />
  );
}

export default function PublicEventBookingPage({
  params,
}: {
  params: Promise<{ username: string; eventSlug: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 pt-10 pb-6">
        <Suspense
          fallback={
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          }
        >
          <PublicEventBookingContent params={params} />
        </Suspense>
      </main>

      <MascotWalkway />
      <SiteFooter />
    </div>
  );
}
