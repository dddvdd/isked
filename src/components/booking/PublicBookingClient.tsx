"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Globe, MapPin } from "lucide-react";
import type { CustomQuestion } from "@/lib/validations/event-type";
import { getSupportedTimezones } from "@/lib/timezones";
import {
  fetchAvailableMonthAction,
  fetchAvailableSlotsAction,
} from "@/actions/bookings";
import { recordPageView } from "@/actions/analytics";
import { CalendarPicker } from "@/components/booking/CalendarPicker";
import { SlotList } from "@/components/booking/SlotList";
import { InviteeForm } from "@/components/booking/InviteeForm";
import { Badge } from "@/components/ui/badge";

interface PublicBookingClientProps {
  eventTypeId: string;
  username: string;
  hostName: string;
  hostAvatarUrl: string | null;
  hostTimezone: string;
  eventTitle: string;
  eventSlug: string;
  description: string | null;
  durationMinutes: number;
  location: string | null;
  customQuestions: CustomQuestion[];
  initialYearMonth: string;
}

export function PublicBookingClient({
  eventTypeId,
  username,
  hostName,
  hostAvatarUrl,
  hostTimezone,
  eventTitle,
  eventSlug,
  description,
  durationMinutes,
  location,
  customQuestions,
  initialYearMonth,
}: PublicBookingClientProps) {
  const timezones = useMemo(() => getSupportedTimezones(), []);

  const [inviteeTimezone, setInviteeTimezone] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return (
        Intl.DateTimeFormat().resolvedOptions().timeZone || hostTimezone || "UTC"
      );
    }
    return hostTimezone || "UTC";
  });

  const [yearMonth, setYearMonth] = useState(initialYearMonth);
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set());
  const [loadingMonth, setLoadingMonth] = useState(true);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const [selectedSlotIso, setSelectedSlotIso] = useState<string | null>(null);

  // Record a lightweight page view once on mount
  useEffect(() => {
    recordPageView(eventTypeId).catch(() => {});
  }, [eventTypeId]);

  // Fetch available days whenever month or timezone changes
  useEffect(() => {
    let cancelled = false;
    setLoadingMonth(true);

    fetchAvailableMonthAction({
      username,
      eventSlug,
      yearMonth,
      inviteeTimezone,
    })
      .then((dates) => {
        if (cancelled) return;
        const nextSet = new Set(dates);
        setAvailableDates(nextSet);
        setSelectedDate((prev) => {
          if (prev && nextSet.has(prev)) return prev;
          return dates[0] ?? null;
        });
      })
      .finally(() => {
        if (!cancelled) setLoadingMonth(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, eventSlug, yearMonth, inviteeTimezone]);

  // Fetch slots when selectedDate or timezone changes
  useEffect(() => {
    if (!selectedDate) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setLoadingSlots(true);

    fetchAvailableSlotsAction({
      username,
      eventSlug,
      dateString: selectedDate,
      inviteeTimezone,
    })
      .then((list) => {
        if (!cancelled) setSlots(list);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username, eventSlug, selectedDate, inviteeTimezone]);

  const initials = hostName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="grid md:grid-cols-5">
        {/* Left Panel: Host & Event Summary */}
        <div className="space-y-4 border-b p-6 md:col-span-2 md:border-r md:border-b-0">
          <div className="flex items-center gap-3">
            {hostAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={hostAvatarUrl}
                alt={hostName}
                className="h-10 w-10 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {initials || "H"}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {hostName}
              </p>
              <p className="text-xs text-muted-foreground">@{username}</p>
            </div>
          </div>

          <h1 className="text-xl font-bold tracking-tight">{eventTitle}</h1>

          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="gap-1">
              <Clock className="h-3.5 w-3.5" />
              {durationMinutes} min
            </Badge>
            {location && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {location}
              </Badge>
            )}
          </div>

          {description && (
            <div className="whitespace-pre-wrap pt-2 text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )}
        </div>

        {/* Right Panel: Step 1 (Date & Time) or Step 2 (Invitee Form) */}
        <div className="p-6 md:col-span-3">
          {selectedSlotIso ? (
            <div className="space-y-4">
              <h2 className="text-base font-semibold">Enter Your Details</h2>
              <InviteeForm
                username={username}
                eventSlug={eventSlug}
                slotIso={selectedSlotIso}
                durationMinutes={durationMinutes}
                inviteeTimezone={inviteeTimezone}
                customQuestions={customQuestions}
                onBack={() => setSelectedSlotIso(null)}
              />
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">Select a Date & Time</h2>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  <select
                    aria-label="Invitee timezone"
                    value={inviteeTimezone}
                    onChange={(e) => setInviteeTimezone(e.target.value)}
                    className="max-w-[200px] rounded border border-input bg-transparent px-2 py-1 text-xs text-foreground outline-none"
                  >
                    {timezones.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-6 sm:grid-cols-5">
                <div className="sm:col-span-3">
                  <CalendarPicker
                    yearMonth={yearMonth}
                    selectedDate={selectedDate}
                    availableDates={availableDates}
                    loadingMonth={loadingMonth}
                    onChangeMonth={setYearMonth}
                    onSelectDate={setSelectedDate}
                  />
                </div>

                <div className="sm:col-span-2">
                  {selectedDate ? (
                    <SlotList
                      dateString={selectedDate}
                      slots={slots}
                      inviteeTimezone={inviteeTimezone}
                      loading={loadingSlots}
                      onSelectSlot={setSelectedSlotIso}
                    />
                  ) : (
                    <p className="pt-8 text-center text-xs text-muted-foreground">
                      {loadingMonth
                        ? "Checking availability..."
                        : "No available dates this month."}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

