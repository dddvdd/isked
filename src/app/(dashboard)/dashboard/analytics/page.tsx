import { Suspense } from "react";
import { connection } from "next/server";
import { TZDate } from "@date-fns/tz";
import { requireCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidTimezone } from "@/lib/timezones";
import { AnalyticsChartsClient } from "@/components/analytics/AnalyticsChartsClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

async function AnalyticsContent() {
  await connection();
  const user = await requireCurrentUser();
  const tz = isValidTimezone(user.timezone) ? user.timezone : "UTC";

  const [eventTypes, bookings, totalViews] = await Promise.all([
    prisma.eventType.findMany({
      where: { userId: user.id },
      include: {
        _count: {
          select: { pageViews: true },
        },
      },
    }),
    prisma.booking.findMany({
      where: { hostId: user.id },
      select: {
        eventTypeId: true,
        status: true,
        startTime: true,
        createdAt: true,
      },
    }),
    prisma.pageView.count({
      where: {
        eventType: { userId: user.id },
      },
    }),
  ]);

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 3600_000;
  const currentPeriodStart = new Date(now - thirtyDaysMs);
  const previousPeriodStart = new Date(now - 2 * thirtyDaysMs);

  const totalBookings = bookings.length;
  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const cancelledBookings = bookings.filter((b) => b.status === "CANCELLED");

  const current30Count = bookings.filter(
    (b) => b.createdAt >= currentPeriodStart
  ).length;
  const prev30Count = bookings.filter(
    (b) => b.createdAt >= previousPeriodStart && b.createdAt < currentPeriodStart
  ).length;

  const periodDeltaText =
    prev30Count === 0
      ? `${current30Count} in the last 30 days`
      : `${current30Count >= prev30Count ? "+" : ""}${Math.round(
          ((current30Count - prev30Count) / prev30Count) * 100
        )}% vs prior 30 days`;

  const conversionRate =
    totalViews > 0
      ? ((confirmedBookings.length / totalViews) * 100).toFixed(1)
      : "0.0";

  const cancellationRate =
    totalBookings > 0
      ? ((cancelledBookings.length / totalBookings) * 100).toFixed(1)
      : "0.0";

  const confirmedByEvent = new Map<string, number>();
  for (const b of confirmedBookings) {
    confirmedByEvent.set(
      b.eventTypeId,
      (confirmedByEvent.get(b.eventTypeId) ?? 0) + 1
    );
  }

  const popularEvents = eventTypes.map((et) => ({
    name: et.title.length > 22 ? `${et.title.slice(0, 22)}…` : et.title,
    bookings: confirmedByEvent.get(et.id) ?? 0,
    views: et._count.pageViews,
  }));

  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  const hourCounts = Array.from({ length: 24 }, () => 0);

  for (const b of confirmedBookings) {
    const z = new TZDate(b.startTime.getTime(), tz);
    dayCounts[z.getDay()] += 1;
    hourCounts[z.getHours()] += 1;
  }

  const byDayOfWeek = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    day: DAY_LABELS[d],
    bookings: dayCounts[d],
  }));

  const byHourOfDay = hourCounts.map((count, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    bookings: count,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">
          Track booking volume, link conversion rates, cancellations, and peak scheduling hours ({tz}).
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Bookings</CardDescription>
            <CardTitle className="text-3xl">{totalBookings}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {periodDeltaText}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Conversion Rate</CardDescription>
            <CardTitle className="text-3xl">{conversionRate}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {confirmedBookings.length} confirmed / {totalViews} link views
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Cancellation Rate</CardDescription>
            <CardTitle className="text-3xl">{cancellationRate}%</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {cancelledBookings.length} cancelled / {totalBookings} total
          </CardContent>
        </Card>
      </div>

      <AnalyticsChartsClient
        popularEvents={popularEvents}
        byDayOfWeek={byDayOfWeek}
        byHourOfDay={byHourOfDay}
      />
    </div>
  );
}

function AnalyticsFallback() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="h-8 w-36 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
        <div className="h-28 animate-pulse rounded-xl border bg-card" />
      </div>
      <div className="h-72 animate-pulse rounded-xl border bg-card" />
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<AnalyticsFallback />}>
      <AnalyticsContent />
    </Suspense>
  );
}
