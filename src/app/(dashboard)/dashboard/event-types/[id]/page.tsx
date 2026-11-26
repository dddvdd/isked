import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseAllowedDates,
  parseCustomQuestions,
  parseLocationDistribution,
} from "@/lib/validations/event-type";
import { EventEditorForm } from "@/components/event-types/EventEditorForm";

async function EditEventTypeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();
  const { id } = await params;
  const user = await requireCurrentUser();

  const eventType = await prisma.eventType.findFirst({
    where: { id, userId: user.id },
  });

  if (!eventType) {
    notFound();
  }

  return (
    <EventEditorForm
      eventTypeId={eventType.id}
      username={user.username}
      initialValues={{
        title: eventType.title,
        slug: eventType.slug,
        description: eventType.description ?? "",
        durationMinutes: eventType.durationMinutes,
        bufferBeforeMinutes: eventType.bufferBeforeMinutes,
        bufferAfterMinutes: eventType.bufferAfterMinutes,
        location: eventType.location ?? "",
        isActive: eventType.isActive,
        showAdditionalNotes: eventType.showAdditionalNotes,
        customQuestions: parseCustomQuestions(eventType.customQuestions),
        bookingWindowType: eventType.bookingWindowType,
        bookingStartDate: eventType.bookingStartDate
          ? eventType.bookingStartDate.toISOString().slice(0, 10)
          : "",
        bookingEndDate: eventType.bookingEndDate
          ? eventType.bookingEndDate.toISOString().slice(0, 10)
          : "",
        allowedDates: parseAllowedDates(eventType.allowedDates),
        slotLimitScope: eventType.slotLimitScope,
        slotLimit: eventType.slotLimit,
        locationDistribution: parseLocationDistribution(
          eventType.locationDistribution
        ),
        postBookingBehavior: eventType.postBookingBehavior,
        redirectUrl: eventType.redirectUrl ?? "",
      }}
    />
  );
}

function EditEventTypeFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="h-9 w-56 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded-xl border bg-card" />
      <div className="h-48 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}

export default function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<EditEventTypeFallback />}>
      <EditEventTypeContent params={params} />
    </Suspense>
  );
}
