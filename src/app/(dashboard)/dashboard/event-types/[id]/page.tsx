import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseCustomQuestions } from "@/lib/validations/event-type";
import { EventEditorForm } from "@/components/event-types/EventEditorForm";

export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
        customQuestions: parseCustomQuestions(eventType.customQuestions),
        postBookingBehavior: eventType.postBookingBehavior,
        redirectUrl: eventType.redirectUrl ?? "",
      }}
    />
  );
}

