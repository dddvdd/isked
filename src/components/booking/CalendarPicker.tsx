"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface CalendarPickerProps {
  yearMonth: string; // "YYYY-MM"
  selectedDate: string | null; // "YYYY-MM-DD"
  availableDates: Set<string>;
  loadingMonth: boolean;
  onChangeMonth: (nextYearMonth: string) => void;
  onSelectDate: (dateString: string) => void;
}

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPicker({
  yearMonth,
  selectedDate,
  availableDates,
  loadingMonth,
  onChangeMonth,
  onSelectDate,
}: CalendarPickerProps) {
  const [year, month] = yearMonth.split("-").map(Number);
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
    onChangeMonth(`${ny}-${nm}`);
  }

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{monthLabel}</h3>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => shiftMonth(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAY_HEADERS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-1.5 transition-opacity",
          loadingMonth && "opacity-50"
        )}
      >
        {cells.map((dayNum, idx) => {
          if (dayNum === null) {
            return <div key={`empty-${idx}`} className="h-10" />;
          }

          const ymd = `${yearMonth}-${String(dayNum).padStart(2, "0")}`;
          const isAvailable = availableDates.has(ymd);
          const isSelected = selectedDate === ymd;

          return (
            <button
              key={ymd}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelectDate(ymd)}
              className={cn(
                "relative flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : isAvailable
                    ? "bg-primary/10 text-primary hover:bg-primary/20 font-semibold"
                    : "cursor-not-allowed text-muted-foreground/40"
              )}
            >
              {dayNum}
            </button>
          );
        })}
      </div>
    </div>
  );
}

