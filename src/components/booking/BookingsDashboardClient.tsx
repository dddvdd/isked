"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, Mail, MapPin, XCircle } from "lucide-react";
import { cancelBookingAction } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export interface DashboardBookingItem {
  id: string;
  uid: string;
  eventTitle: string;
  location: string | null;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTimeIso: string;
  endTimeIso: string;
  status: "CONFIRMED" | "CANCELLED";
  cancellationReason: string | null;
  notes: string | null;
  answers: { label: string; value: string | boolean }[];
}

export function BookingsDashboardClient({
  hostTimezone,
  upcoming,
  past,
  cancelled,
}: {
  hostTimezone: string;
  upcoming: DashboardBookingItem[];
  past: DashboardBookingItem[];
  cancelled: DashboardBookingItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancellingUid, setCancellingUid] = useState<string | null>(null);

  function formatRange(startIso: string, endIso: string) {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      const dayFmt = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: hostTimezone,
      }).format(s);
      const timeFmt = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: hostTimezone,
      });
      return `${dayFmt} · ${timeFmt.format(s)} – ${timeFmt.format(e)} (${hostTimezone})`;
    } catch {
      return startIso;
    }
  }

  function handleHostCancel(uid: string, inviteeName: string) {
    const reason = window.prompt(
      `Cancel meeting with ${inviteeName}? Optional cancellation note:`
    );
    if (reason === null) return;

    setCancellingUid(uid);
    startTransition(async () => {
      await cancelBookingAction({ uid, reason });
      setCancellingUid(null);
      router.refresh();
    });
  }

  function renderList(list: DashboardBookingItem[], allowCancel: boolean) {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No bookings in this tab.
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {list.map((b) => (
          <Card key={b.id}>
            <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{b.eventTitle}</h3>
                  <Badge
                    variant={
                      b.status === "CANCELLED" ? "destructive" : "secondary"
                    }
                  >
                    {b.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    {formatRange(b.startTimeIso, b.endTimeIso)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {b.inviteeName} ({b.inviteeEmail})
                  </span>
                  {b.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.location}
                    </span>
                  )}
                </div>

                {(b.notes || b.answers.length > 0) && (
                  <div className="mt-2 space-y-1 rounded-lg border bg-zinc-50/70 p-3 text-xs dark:bg-zinc-900/50">
                    {b.answers.map((ans, idx) => (
                      <p key={idx}>
                        <span className="font-medium">{ans.label}:</span>{" "}
                        {typeof ans.value === "boolean"
                          ? ans.value
                            ? "Yes"
                            : "No"
                          : ans.value}
                      </p>
                    ))}
                    {b.notes && (
                      <p>
                        <span className="font-medium">Additional Notes:</span>{" "}
                        {b.notes}
                      </p>
                    )}
                  </div>
                )}

                {b.cancellationReason && (
                  <p className="text-xs text-destructive">
                    Cancellation reason: {b.cancellationReason}
                  </p>
                )}
              </div>

              {allowCancel && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending && cancellingUid === b.uid}
                  onClick={() => handleHostCancel(b.uid, b.inviteeName)}
                >
                  {isPending && cancellingUid === b.uid ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                  )}
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          View upcoming meetings, invitee form responses, and cancellation history.
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({upcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({cancelled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">{renderList(upcoming, true)}</TabsContent>
        <TabsContent value="past">{renderList(past, false)}</TabsContent>
        <TabsContent value="cancelled">
          {renderList(cancelled, false)}
        </TabsContent>
      </Tabs>
    </div>
  );
}

