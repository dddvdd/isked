import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Clock, Loader2, User } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { maskEmail } from "@/lib/security";
import { CancelBookingClient } from "@/components/booking/CancelBookingClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Cancel Booking — Isked",
  robots: { index: false, follow: false },
};

async function CancelBookingContent({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;

  const booking = await prisma.booking.findUnique({
    where: { uid },
    include: {
      eventType: true,
      host: true,
    },
  });

  if (!booking) {
    notFound();
  }

  const hostName = booking.host.name ?? booking.host.username;

  const formattedWhen = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: booking.inviteeTimezone,
      }).format(booking.startTime);
    } catch {
      return booking.startTime.toUTCString();
    }
  })();

  return (
    <Card className="w-full max-w-lg">
      <CardHeader>
        <CardTitle>Cancel Meeting</CardTitle>
        <CardDescription>{booking.eventType.title}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2 rounded-xl border bg-muted/50 p-4 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>Host: {hostName}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {formattedWhen} ({booking.inviteeTimezone})
            </span>
          </div>
        </div>

        <CancelBookingClient
          uid={booking.uid}
          maskedEmail={maskEmail(booking.inviteeEmail)}
          alreadyCancelled={booking.status === "CANCELLED"}
          rebookHref={`/${booking.host.username}/${booking.eventType.slug}`}
        />
      </CardContent>
    </Card>
  );
}

export default function CancelBookingPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Suspense
        fallback={
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        }
      >
        <CancelBookingContent params={params} />
      </Suspense>
    </div>
  );
}
