"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SlotListProps {
  dateString: string;
  slots: string[]; // UTC ISO strings
  inviteeTimezone: string;
  loading: boolean;
  onSelectSlot: (slotIso: string) => void;
}

export function SlotList({
  dateString,
  slots,
  inviteeTimezone,
  loading,
  onSelectSlot,
}: SlotListProps) {
  const [y, m, d] = dateString.split("-").map(Number);
  const prettyDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));

  function formatSlot(iso: string): string {
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: inviteeTimezone,
      }).format(new Date(iso));
    } catch {
      return iso.slice(11, 16);
    }
  }

  return (
    <div className="flex flex-col space-y-3">
      <h4 className="text-sm font-medium">{prettyDate}</h4>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : slots.length === 0 ? (
        <p className="py-6 text-xs text-muted-foreground">
          No available slots on this date.
        </p>
      ) : (
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {slots.map((iso) => (
            <Button
              key={iso}
              type="button"
              variant="outline"
              className="w-full justify-center font-medium hover:border-primary hover:text-primary"
              onClick={() => onSelectSlot(iso)}
            >
              {formatSlot(iso)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

