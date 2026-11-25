"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Globe, Loader2, Plus, Trash2 } from "lucide-react";
import {
  deleteDateOverrideAction,
  saveWeeklyAvailabilityAction,
  upsertDateOverrideAction,
} from "@/actions/availability";
import { getSupportedTimezones, getTimeOptions } from "@/lib/timezones";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ShiftItem {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface OverrideItem {
  id: string;
  date: string; // YYYY-MM-DD
  isUnavailable: boolean;
  startTime: string | null;
  endTime: string | null;
}

const ORDERED_DAYS: { dayOfWeek: number; label: string }[] = [
  { dayOfWeek: 1, label: "Monday" },
  { dayOfWeek: 2, label: "Tuesday" },
  { dayOfWeek: 3, label: "Wednesday" },
  { dayOfWeek: 4, label: "Thursday" },
  { dayOfWeek: 5, label: "Friday" },
  { dayOfWeek: 6, label: "Saturday" },
  { dayOfWeek: 0, label: "Sunday" },
];

export function AvailabilityEditorClient({
  initialTimezone,
  initialShifts,
  initialOverrides,
}: {
  initialTimezone: string;
  initialShifts: ShiftItem[];
  initialOverrides: OverrideItem[];
}) {
  const router = useRouter();
  const [isSavingWeekly, startWeeklyTransition] = useTransition();
  const [isSavingOverride, startOverrideTransition] = useTransition();

  const timezones = useMemo(() => getSupportedTimezones(), []);
  const timeOptions = useMemo(() => getTimeOptions(), []);

  const [timezone, setTimezone] = useState(initialTimezone);
  const [shifts, setShifts] = useState<ShiftItem[]>(initialShifts);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [weeklySaved, setWeeklySaved] = useState(false);

  // Date override form state
  const [overrideDate, setOverrideDate] = useState("");
  const [isUnavailable, setIsUnavailable] = useState(true);
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("17:00");
  const [overrideError, setOverrideError] = useState<string | null>(null);

  function toggleDay(dayOfWeek: number, enabled: boolean) {
    setWeeklySaved(false);
    if (!enabled) {
      setShifts((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
    } else {
      setShifts((prev) => [
        ...prev,
        { dayOfWeek, startTime: "09:00", endTime: "17:00" },
      ]);
    }
  }

  function addShift(dayOfWeek: number) {
    setWeeklySaved(false);
    const dayShifts = shifts
      .filter((s) => s.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    const lastEnd = dayShifts[dayShifts.length - 1]?.endTime ?? "09:00";
    const startIdx = timeOptions.indexOf(lastEnd);
    const nextStart =
      startIdx >= 0 && startIdx + 4 < timeOptions.length
        ? timeOptions[startIdx + 4]
        : "13:00";
    const endIdx = timeOptions.indexOf(nextStart);
    const nextEnd =
      endIdx >= 0 && endIdx + 12 < timeOptions.length
        ? timeOptions[endIdx + 12]
        : "17:00";

    setShifts((prev) => [
      ...prev,
      { dayOfWeek, startTime: nextStart, endTime: nextEnd },
    ]);
  }

  function updateShift(
    dayOfWeek: number,
    indexInDay: number,
    patch: Partial<ShiftItem>
  ) {
    setWeeklySaved(false);
    let seen = -1;
    setShifts((prev) =>
      prev.map((s) => {
        if (s.dayOfWeek !== dayOfWeek) return s;
        seen++;
        return seen === indexInDay ? { ...s, ...patch } : s;
      })
    );
  }

  function removeShift(dayOfWeek: number, indexInDay: number) {
    setWeeklySaved(false);
    let seen = -1;
    setShifts((prev) =>
      prev.filter((s) => {
        if (s.dayOfWeek !== dayOfWeek) return true;
        seen++;
        return seen !== indexInDay;
      })
    );
  }

  function handleSaveWeekly() {
    setWeeklyError(null);
    setWeeklySaved(false);
    startWeeklyTransition(async () => {
      const res = await saveWeeklyAvailabilityAction({
        timezone,
        shifts,
      });
      if (!res.ok) {
        setWeeklyError(res.error);
        return;
      }
      setWeeklySaved(true);
      router.refresh();
    });
  }

  function handleAddOverride(e: React.FormEvent) {
    e.preventDefault();
    setOverrideError(null);
    startOverrideTransition(async () => {
      const res = await upsertDateOverrideAction({
        date: overrideDate,
        isUnavailable,
        startTime: isUnavailable ? null : overrideStart,
        endTime: isUnavailable ? null : overrideEnd,
      });
      if (!res.ok) {
        setOverrideError(res.error);
        return;
      }
      setOverrideDate("");
      router.refresh();
    });
  }

  function handleDeleteOverride(id: string) {
    startOverrideTransition(async () => {
      await deleteDateOverrideAction(id);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Availability
          </h1>
          <p className="text-sm text-muted-foreground">
            Set your recurring weekly hours, primary timezone, and date-specific overrides.
          </p>
        </div>

        <Button onClick={handleSaveWeekly} disabled={isSavingWeekly}>
          {isSavingWeekly ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : weeklySaved ? (
            <Check className="mr-1.5 h-4 w-4" />
          ) : null}
          {weeklySaved ? "Saved Schedule" : "Save Schedule"}
        </Button>
      </div>

      {weeklyError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {weeklyError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="h-4 w-4 text-primary" />
            <span>Primary Timezone</span>
          </CardTitle>
          <CardDescription>
            Your weekly schedule and date overrides are interpreted in this timezone.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <select
            value={timezone}
            onChange={(e) => {
              setTimezone(e.target.value);
              setWeeklySaved(false);
            }}
            className="flex h-9 w-full max-w-sm rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const detected =
                Intl.DateTimeFormat().resolvedOptions().timeZone;
              if (detected) {
                setTimezone(detected);
                setWeeklySaved(false);
              }
            }}
          >
            Use Browser Timezone
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Weekly Recurring Hours</CardTitle>
          <CardDescription>
            Add multiple shifts per day (e.g., 09:00–12:00 and 13:00–17:00) for lunch breaks or split schedules.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {ORDERED_DAYS.map(({ dayOfWeek, label }) => {
            const dayShifts = shifts.filter((s) => s.dayOfWeek === dayOfWeek);
            const enabled = dayShifts.length > 0;

            return (
              <div
                key={dayOfWeek}
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex w-40 items-center gap-3 pt-1">
                  <Switch
                    id={`day-${dayOfWeek}`}
                    checked={enabled}
                    onCheckedChange={(c) => toggleDay(dayOfWeek, Boolean(c))}
                  />
                  <Label
                    htmlFor={`day-${dayOfWeek}`}
                    className="font-medium"
                  >
                    {label}
                  </Label>
                </div>

                {!enabled ? (
                  <p className="flex-1 pt-1 text-sm text-muted-foreground">
                    Unavailable
                  </p>
                ) : (
                  <div className="flex-1 space-y-2">
                    {dayShifts.map((shift, idx) => (
                      <div key={idx} className="flex flex-wrap items-center gap-2">
                        <select
                          aria-label={`${label} shift ${idx + 1} start`}
                          value={shift.startTime}
                          onChange={(e) =>
                            updateShift(dayOfWeek, idx, {
                              startTime: e.target.value,
                            })
                          }
                          className="flex h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>

                        <span className="text-muted-foreground">–</span>

                        <select
                          aria-label={`${label} shift ${idx + 1} end`}
                          value={shift.endTime}
                          onChange={(e) =>
                            updateShift(dayOfWeek, idx, {
                              endTime: e.target.value,
                            })
                          }
                          className="flex h-8 w-28 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
                        >
                          {timeOptions.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                          <option value="23:59">23:59</option>
                        </select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => removeShift(dayOfWeek, idx)}
                          aria-label="Remove shift"
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>

                        {idx === dayShifts.length - 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => addShift(dayOfWeek)}
                          >
                            <Plus className="mr-1 h-3.5 w-3.5" />
                            Add Shift
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date Overrides</CardTitle>
          <CardDescription>
            Block specific dates for PTO/holidays or override hours for a single calendar date.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form
            onSubmit={handleAddOverride}
            className="space-y-4 rounded-lg border bg-zinc-50/60 p-4 dark:bg-zinc-900/40"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="override-date">Select Date</Label>
                <Input
                  id="override-date"
                  type="date"
                  required
                  value={overrideDate}
                  onChange={(e) => setOverrideDate(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Switch
                  id="override-unavailable"
                  checked={isUnavailable}
                  onCheckedChange={(c) => setIsUnavailable(Boolean(c))}
                />
                <Label htmlFor="override-unavailable">
                  Block entire day (Unavailable / PTO)
                </Label>
              </div>
            </div>

            {!isUnavailable && (
              <div className="flex flex-wrap items-center gap-2">
                <Label className="mr-2 text-xs">Custom Hours:</Label>
                <select
                  value={overrideStart}
                  onChange={(e) => setOverrideStart(e.target.value)}
                  className="flex h-8 w-28 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <span>–</span>
                <select
                  value={overrideEnd}
                  onChange={(e) => setOverrideEnd(e.target.value)}
                  className="flex h-8 w-28 rounded-lg border border-input bg-background px-2.5 text-sm outline-none"
                >
                  {timeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                  <option value="23:59">23:59</option>
                </select>
              </div>
            )}

            {overrideError && (
              <p className="text-sm text-destructive">{overrideError}</p>
            )}

            <Button type="submit" size="sm" disabled={isSavingOverride}>
              {isSavingOverride && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              Save Date Override
            </Button>
          </form>

          {initialOverrides.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No date overrides configured.
            </p>
          ) : (
            <div className="divide-y rounded-lg border">
              {initialOverrides.map((ov) => (
                <div
                  key={ov.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{ov.date}</span>
                    {ov.isUnavailable ? (
                      <Badge variant="secondary">Unavailable</Badge>
                    ) : (
                      <Badge variant="outline">
                        {ov.startTime} – {ov.endTime}
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => handleDeleteOverride(ov.id)}
                    aria-label={`Delete override for ${ov.date}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

