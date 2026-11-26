"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { BookingWindowType } from "@/lib/validations/event-type";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface BookingDatesSelectorProps {
  bookingWindowType: BookingWindowType;
  bookingStartDate: string;
  bookingEndDate: string;
  allowedDates: string[];
  onChangeType: (next: BookingWindowType) => void;
  onChangeStartDate: (next: string) => void;
  onChangeEndDate: (next: string) => void;
  onChangeAllowedDates: (next: string[]) => void;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatPrettyYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function BookingDatesSelector({
  bookingWindowType,
  bookingStartDate,
  bookingEndDate,
  allowedDates,
  onChangeType,
  onChangeStartDate,
  onChangeEndDate,
  onChangeAllowedDates,
}: BookingDatesSelectorProps) {
  const [calendarYearMonth, setCalendarYearMonth] = useState<string>(() => {
    if (allowedDates[0] && /^\d{4}-\d{2}-\d{2}$/.test(allowedDates[0])) {
      return allowedDates[0].slice(0, 7);
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const allowedSet = useMemo(() => new Set(allowedDates), [allowedDates]);

  const [year, month] = calendarYearMonth.split("-").map(Number);
  const firstDayOfWeek = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 15)));

  function shiftMonth(delta: -1 | 1) {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1));
    const ny = d.getUTCFullYear();
    const nm = String(d.getUTCMonth() + 1).padStart(2, "0");
    setCalendarYearMonth(`${ny}-${nm}`);
  }

  function toggleDate(ymd: string) {
    if (allowedSet.has(ymd)) {
      onChangeAllowedDates(allowedDates.filter((d) => d !== ymd));
    } else {
      onChangeAllowedDates([...allowedDates, ymd].sort());
    }
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onChangeType("UNLIMITED")}
          className={cn(
            "rounded-lg border p-3.5 text-left transition-colors",
            bookingWindowType === "UNLIMITED"
              ? "border-primary bg-primary/5"
              : "hover:bg-accent"
          )}
        >
          <p className="text-sm font-medium">Indefinitely</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Open on all future dates matching your weekly availability.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeType("DATE_RANGE")}
          className={cn(
            "rounded-lg border p-3.5 text-left transition-colors",
            bookingWindowType === "DATE_RANGE"
              ? "border-primary bg-primary/5"
              : "hover:bg-accent"
          )}
        >
          <p className="text-sm font-medium">Date Range</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Only allow bookings between a specific start and end date.
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChangeType("SPECIFIC_DATES")}
          className={cn(
            "rounded-lg border p-3.5 text-left transition-colors",
            bookingWindowType === "SPECIFIC_DATES"
              ? "border-primary bg-primary/5"
              : "hover:bg-accent"
          )}
        >
          <p className="text-sm font-medium">Specific Dates</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pick individual calendar dates that are open for this event.
          </p>
        </button>
      </div>

      {bookingWindowType === "DATE_RANGE" && (
        <div className="space-y-3 rounded-lg border bg-muted/50 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="booking-start-date">Open From (Start Date)</Label>
              <Input
                id="booking-start-date"
                type="date"
                required
                value={bookingStartDate}
                onChange={(e) => onChangeStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="booking-end-date">Open Until (End Date)</Label>
              <Input
                id="booking-end-date"
                type="date"
                required
                min={bookingStartDate || undefined}
                value={bookingEndDate}
                onChange={(e) => onChangeEndDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Invitees can only book dates within this range (inclusive, in your primary timezone), using your weekly availability hours and date overrides.
          </p>
        </div>
      )}

      {bookingWindowType === "SPECIFIC_DATES" && (
        <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3 rounded-lg border bg-background p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{monthLabel}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => shiftMonth(-1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => shiftMonth(1)}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground">
                {WEEKDAY_HEADERS.map((h) => (
                  <div key={h} className="py-1">
                    {h}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1">
                {cells.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return <div key={`empty-${idx}`} className="h-8" />;
                  }
                  const ymd = `${calendarYearMonth}-${String(dayNum).padStart(
                    2,
                    "0"
                  )}`;
                  const isSelected = allowedSet.has(ymd);

                  return (
                    <button
                      key={ymd}
                      type="button"
                      onClick={() => toggleDate(ymd)}
                      className={cn(
                        "flex h-8 items-center justify-center rounded-md text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "hover:bg-accent"
                      )}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col justify-between space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    Selected Open Dates ({allowedDates.length})
                  </span>
                  {allowedDates.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => onChangeAllowedDates([])}
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                {allowedDates.length === 0 ? (
                  <p className="rounded-md border border-dashed p-4 text-xs text-muted-foreground">
                    Click dates on the calendar to mark them open for booking.
                  </p>
                ) : (
                  <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto rounded-md border bg-background p-3">
                    {allowedDates.map((ymd) => (
                      <Badge
                        key={ymd}
                        variant="secondary"
                        className="gap-1 pr-1.5 font-normal"
                      >
                        <span>{formatPrettyYmd(ymd)}</span>
                        <button
                          type="button"
                          onClick={() => toggleDate(ymd)}
                          className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          aria-label={`Remove ${ymd}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Time slots on these dates follow your weekly Availability hours (or Date Overrides if you want custom hours on a weekend/special date).
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
