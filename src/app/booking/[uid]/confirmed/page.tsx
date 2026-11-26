import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  CalendarCheck2,
  CalendarPlus,
  Clock,
  Download,
  Loader2,
  MapPin,
  User,
  XCircle,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { buildGoogleCalendarUrl, generateBookingIcs } from "@/lib/email";
import { maskEmail } from "@/lib/security";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Booking Confirmed — Isked",
  robots: { index: false, follow: false },
};

async function BookingConfirmedContent({
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
  const maskedInviteeEmail = maskEmail(booking.inviteeEmail);

  const formattedDate = (() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: booking.inviteeTimezone,
      }).format(booking.startTime);
    } catch {
      return booking.startTime.toUTCString();
    }
  })();

  const formattedTimeRange = (() => {
    try {
      const fmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: booking.inviteeTimezone,
      });
      return `${fmt.format(booking.startTime)} – ${fmt.format(booking.endTime)} (${booking.inviteeTimezone})`;
    } catch {
      return booking.startTime.toISOString();
    }
  })();

  const googleCalUrl = buildGoogleCalendarUrl({
    title: `${booking.eventType.title} (${hostName})`,
    description: booking.eventType.description,
    location: booking.eventType.location,
    startTime: booking.startTime,
    endTime: booking.endTime,
  });

  let icsDataHref: string | null = null;
  try {
    const ics = generateBookingIcs({
      uid: booking.uid,
      eventTitle: booking.eventType.title,
      eventDescription: booking.eventType.description,
      location: booking.eventType.location,
      hostName,
      inviteeName: booking.inviteeName,
      inviteeTimezone: booking.inviteeTimezone,
      startTime: booking.startTime,
      endTime: booking.endTime,
    });
    icsDataHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
  } catch {
    icsDataHref = null;
  }

  const isCancelled = booking.status === "CANCELLED";

  return (
    <Card className="w-full max-w-lg">
      <CardHeader className="items-center text-center">
        {isCancelled ? (
          <XCircle className="mb-2 h-10 w-10 text-destructive" />
        ) : (
          <CalendarCheck2 className="mb-2 h-10 w-10 text-primary" />
        )}
        <CardTitle className="text-2xl">
          {isCancelled ? "This meeting was cancelled" : "You are scheduled"}
        </CardTitle>
        <CardDescription>
          {isCancelled
            ? "This booking is no longer active."
            : `Confirmation details have been sent to ${maskedInviteeEmail}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3 rounded-xl border bg-muted/50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-base">
              {booking.eventType.title}
            </span>
            <Badge variant={isCancelled ? "destructive" : "secondary"}>
              {booking.status}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4 shrink-0" />
            <span>Host: {hostName}</span>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              {formattedDate} · {formattedTimeRange}
            </span>
          </div>

          {booking.eventType.location && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span>{booking.eventType.location}</span>
            </div>
          )}
        </div>

        {!isCancelled ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href={googleCalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(buttonVariants({ variant: "outline" }))}
              >
                <CalendarPlus className="mr-1.5 h-4 w-4" />
                Google Calendar
              </a>

              {icsDataHref && (
                <a
                  href={icsDataHref}
                  download="invite.ics"
                  className={cn(buttonVariants({ variant: "outline" }))}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  Download .ics
                </a>
              )}
            </div>

            <div className="border-t pt-4 text-center text-xs text-muted-foreground">
              Need to make changes?{" "}
              <Link
                href={`/booking/${booking.uid}/cancel`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Cancel this meeting
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <Link
              href={`/${booking.host.username}/${booking.eventType.slug}`}
              className={cn(buttonVariants())}
            >
              Book a New Time
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function BookingConfirmedPage({
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
        <BookingConfirmedContent params={params} />
      </Suspense>
    </div>
  );
}
