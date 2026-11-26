"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Search,
  User,
  X,
  XCircle,
} from "lucide-react";
import { cancelBookingAction } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface DashboardBookingItem {
  id: string;
  uid: string;
  eventTypeId: string;
  eventTitle: string;
  location: string | null;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTimeIso: string;
  endTimeIso: string;
  status: "CONFIRMED" | "CANCELLED";
  cancellationReason: string | null;
  addressText: string | null;
  notes: string | null;
  answers: { label: string; value: string | boolean | string[] }[];
}

export interface EventFilterOption {
  id: string;
  title: string;
}

function getBookingDateYmd(startIso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone,
    }).format(new Date(startIso));
  } catch {
    return startIso.slice(0, 10);
  }
}

export function BookingsDashboardClient({
  hostTimezone,
  eventTypes,
  upcoming,
  past,
  cancelled,
}: {
  hostTimezone: string;
  eventTypes: EventFilterOption[];
  upcoming: DashboardBookingItem[];
  past: DashboardBookingItem[];
  cancelled: DashboardBookingItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancellingUid, setCancellingUid] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEventId, setSelectedEventId] = useState<string>("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Expanded row state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    selectedEventId !== "ALL" ||
    fromDate.length > 0 ||
    toDate.length > 0;

  function clearAllFilters() {
    setSearchQuery("");
    setSelectedEventId("ALL");
    setFromDate("");
    setToDate("");
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const bookingCountByEvent = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of [...upcoming, ...past, ...cancelled]) {
      counts.set(b.eventTypeId, (counts.get(b.eventTypeId) ?? 0) + 1);
    }
    return counts;
  }, [upcoming, past, cancelled]);

  function applyFilters(list: DashboardBookingItem[]): DashboardBookingItem[] {
    const q = searchQuery.trim().toLowerCase();

    return list.filter((b) => {
      if (selectedEventId !== "ALL" && b.eventTypeId !== selectedEventId) {
        return false;
      }

      if (q) {
        const nameMatch = b.inviteeName.toLowerCase().includes(q);
        const emailMatch = b.inviteeEmail.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch) {
          return false;
        }
      }

      if (fromDate || toDate) {
        const ymd = getBookingDateYmd(b.startTimeIso, hostTimezone);
        if (fromDate && ymd < fromDate) return false;
        if (toDate && ymd > toDate) return false;
      }

      return true;
    });
  }

  const filteredUpcoming = useMemo(
    () => applyFilters(upcoming),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upcoming, selectedEventId, searchQuery, fromDate, toDate, hostTimezone]
  );

  const filteredPast = useMemo(
    () => applyFilters(past),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [past, selectedEventId, searchQuery, fromDate, toDate, hostTimezone]
  );

  const filteredCancelled = useMemo(
    () => applyFilters(cancelled),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cancelled, selectedEventId, searchQuery, fromDate, toDate, hostTimezone]
  );

  function formatShortDateTime(startIso: string, endIso: string) {
    try {
      const s = new Date(startIso);
      const e = new Date(endIso);
      const dayFmt = new Intl.DateTimeFormat("en-US", {
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
      return `${dayFmt} · ${timeFmt.format(s)} – ${timeFmt.format(e)}`;
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

  function renderBookingList(
    list: DashboardBookingItem[],
    allowCancel: boolean,
    emptyLabel: string
  ) {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {hasActiveFilters
              ? "No bookings match your current search or filters."
              : emptyLabel}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {list.map((b) => {
          const isExpanded = expandedIds.has(b.id);
          const isCancelled = b.status === "CANCELLED";

          return (
            <div key={b.id} className="transition-colors">
              {/* Compact Clickable Row */}
              <button
                type="button"
                onClick={() => toggleExpanded(b.id)}
                aria-expanded={isExpanded}
                className={cn(
                  "flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-accent/50",
                  isExpanded && "bg-accent/30"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span
                        className={cn(
                          "truncate text-sm font-semibold",
                          isCancelled && "line-through opacity-75"
                        )}
                      >
                        {b.inviteeName}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        · {b.eventTitle}
                      </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3 text-primary" />
                        {formatShortDateTime(b.startTimeIso, b.endTimeIso)}
                      </span>
                      {isCancelled && b.cancellationReason && (
                        <span className="truncate text-destructive">
                          Reason: {b.cancellationReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={isCancelled ? "destructive" : "secondary"}>
                    {b.status}
                  </Badge>
                </div>
              </button>

              {/* Expanded Details Panel */}
              {isExpanded && (
                <div className="space-y-4 border-t bg-muted/40 px-4 py-4 sm:px-11">
                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div className="flex items-start gap-2">
                      <User className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Client Name
                        </p>
                        <p className="text-foreground">{b.inviteeName}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Email
                        </p>
                        <p className="text-foreground">{b.inviteeEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Schedule ({hostTimezone})
                        </p>
                        <p className="text-foreground">
                          {formatShortDateTime(b.startTimeIso, b.endTimeIso)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <div>
                        <p className="font-medium text-muted-foreground">
                          Event &amp; Location
                        </p>
                        <p className="text-foreground">
                          {b.eventTitle}
                          {b.location ? ` · ${b.location}` : ""}
                        </p>
                      </div>
                    </div>
                  </div>

                  {(b.addressText || b.notes || b.answers.length > 0) && (
                    <div className="space-y-1.5 rounded-lg border bg-card p-3 text-xs">
                      {b.addressText && (
                        <p className="flex items-start gap-1.5">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                          <span>
                            <span className="font-medium">
                              Address (PSGC):
                            </span>{" "}
                            {b.addressText}
                          </span>
                        </p>
                      )}
                      {b.answers.map((ans, idx) => (
                        <p key={idx}>
                          <span className="font-medium">{ans.label}:</span>{" "}
                          {Array.isArray(ans.value)
                            ? ans.value.join(", ")
                            : typeof ans.value === "boolean"
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
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      <span className="font-medium">Cancellation Reason:</span>{" "}
                      {b.cancellationReason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Booking Ref: <code>{b.uid}</code> · Invitee TZ:{" "}
                      {b.inviteeTimezone}
                    </span>

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
                        Cancel Booking
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const totalBookingsCount = upcoming.length + past.length + cancelled.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Click any booking row to expand full client details, PSGC address, and form responses.
        </p>
      </div>

      {/* Filter Toolbar: Search by Client Name + Event Filter + Date Range Filter */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="grid gap-3 md:grid-cols-12">
            {/* Search by Name */}
            <div className="space-y-1 md:col-span-5">
              <Label htmlFor="booking-search" className="text-xs">
                Search Client Name
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="booking-search"
                  type="text"
                  placeholder="Search by client name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-sm"
                />
              </div>
            </div>

            {/* Filter by Event */}
            <div className="space-y-1 md:col-span-3">
              <Label htmlFor="booking-event-filter" className="text-xs">
                Event
              </Label>
              <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background px-2">
                <Filter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <select
                  id="booking-event-filter"
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  className="h-8 w-full bg-transparent text-xs outline-none"
                >
                  <option value="ALL">All Events ({totalBookingsCount})</option>
                  {eventTypes.map((et) => (
                    <option key={et.id} value={et.id}>
                      {et.title} ({bookingCountByEvent.get(et.id) ?? 0})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="booking-from-date" className="text-xs">
                From Date
              </Label>
              <Input
                id="booking-from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="booking-to-date" className="text-xs">
                To Date
              </Label>
              <Input
                id="booking-to-date"
                type="date"
                min={fromDate || undefined}
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={clearAllFilters}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Clear all filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="upcoming" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upcoming">
            Upcoming ({filteredUpcoming.length})
          </TabsTrigger>
          <TabsTrigger value="past">Past ({filteredPast.length})</TabsTrigger>
          <TabsTrigger value="cancelled">
            Cancelled ({filteredCancelled.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {renderBookingList(
            filteredUpcoming,
            true,
            "No upcoming bookings yet."
          )}
        </TabsContent>
        <TabsContent value="past">
          {renderBookingList(filteredPast, false, "No past bookings yet.")}
        </TabsContent>
        <TabsContent value="cancelled">
          {renderBookingList(
            filteredCancelled,
            false,
            "No cancelled bookings."
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
