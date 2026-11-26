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
import { cn } from "@/lib/utils";

interface ShiftItem {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface InitialShiftInput {
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

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

function makeShiftId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `shift_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Normalizes user-typed 24-hour time strings (e.g. "9", "830", "1430", "9:5", "09:30")
 * into canonical "HH:mm" (00:00 - 23:59), or returns null if invalid.
 */
function normalizeTime24(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let h: number;
  let m: number;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) return null;
    if (!/^\d{1,2}$/.test(parts[0]) || !/^\d{1,2}$/.test(parts[1])) {
      return null;
    }
    h = Number(parts[0]);
    m = Number(parts[1]);
  } else if (/^\d{1,2}$/.test(trimmed)) {
    h = Number(trimmed);
    m = 0;
  } else if (/^\d{3}$/.test(trimmed)) {
    h = Number(trimmed.slice(0, 1));
    m = Number(trimmed.slice(1));
  } else if (/^\d{4}$/.test(trimmed)) {
    h = Number(trimmed.slice(0, 2));
    m = Number(trimmed.slice(2));
  } else {
    return null;
  }

  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }

  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(hhmm: string): number | null {
  const norm = normalizeTime24(hhmm);
  if (!norm) return null;
  const [h, m] = norm.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Finds a guaranteed non-overlapping [startTime, endTime] window on the day,
 * preferring a gap after the last shift, then gaps between shifts, then before the first shift.
 */
function findNextNonOverlappingShift(
  dayShifts: ShiftItem[]
): { startTime: string; endTime: string } | null {
  const MAX_MIN = 23 * 60 + 59;

  const intervals = dayShifts
    .map((s) => ({
      start: toMinutes(s.startTime),
      end: toMinutes(s.endTime),
    }))
    .filter(
      (i): i is { start: number; end: number } =>
        i.start !== null && i.end !== null && i.start < i.end
    )
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) {
    return { startTime: "09:00", endTime: "17:00" };
  }

  // Merge overlapping/adjacent intervals so candidate search never collides
  const merged: { start: number; end: number }[] = [{ ...intervals[0] }];
  for (let i = 1; i < intervals.length; i++) {
    const prev = merged[merged.length - 1];
    if (intervals[i].start <= prev.end) {
      prev.end = Math.max(prev.end, intervals[i].end);
    } else {
      merged.push({ ...intervals[i] });
    }
  }

  // 1. Try after the last shift (prefer 1-hour break, then 2-hour shift)
  const lastEnd = merged[merged.length - 1].end;
  if (lastEnd + 90 <= MAX_MIN) {
    const start = lastEnd + 60;
    const end = Math.min(start + 120, MAX_MIN);
    return { startTime: fromMinutes(start), endTime: fromMinutes(end) };
  }
  if (lastEnd + 15 <= MAX_MIN) {
    const start = lastEnd + 15 <= MAX_MIN - 15 ? lastEnd + 15 : lastEnd;
    const end = Math.min(start + 60, MAX_MIN);
    if (end > start) {
      return { startTime: fromMinutes(start), endTime: fromMinutes(end) };
    }
  }

  // 2. Try any gap between existing shifts (>= 15 minutes)
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i].end;
    const gapEnd = merged[i + 1].start;
    if (gapEnd - gapStart >= 15) {
      return { startTime: fromMinutes(gapStart), endTime: fromMinutes(gapEnd) };
    }
  }

  // 3. Try before the first shift (>= 15 minutes)
  const firstStart = merged[0].start;
  if (firstStart >= 15) {
    const end = firstStart >= 75 ? firstStart - 60 : firstStart;
    const start = Math.max(0, end - 120);
    if (end - start >= 15) {
      return { startTime: fromMinutes(start), endTime: fromMinutes(end) };
    }
    return { startTime: "00:00", endTime: fromMinutes(firstStart) };
  }

  return null;
}

function getDayValidationError(dayShifts: ShiftItem[]): string | null {
  const parsed: { start: number; end: number }[] = [];

  for (const s of dayShifts) {
    const normStart = normalizeTime24(s.startTime);
    const normEnd = normalizeTime24(s.endTime);
    if (!normStart || !normEnd) {
      return "Use 24-hour HH:mm format (00:00 – 23:59).";
    }
    const startMin = toMinutes(normStart)!;
    const endMin = toMinutes(normEnd)!;
    if (startMin >= endMin) {
      return "End time must be after start time.";
    }
    parsed.push({ start: startMin, end: endMin });
  }

  parsed.sort((a, b) => a.start - b.start);
  for (let i = 1; i < parsed.length; i++) {
    if (parsed[i].start < parsed[i - 1].end) {
      return "Shifts on the same day cannot overlap.";
    }
  }

  return null;
}

function Time24Input({
  value,
  onChange,
  onNormalize,
  ariaLabel,
  invalid,
}: {
  value: string;
  onChange: (next: string) => void;
  onNormalize: (normalized: string) => void;
  ariaLabel: string;
  invalid?: boolean;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      list="time-24h-options"
      maxLength={5}
      placeholder="HH:mm"
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => {
        const cleaned = e.target.value.replace(/[^0-9:]/g, "").slice(0, 5);
        onChange(cleaned);
      }}
      onBlur={() => {
        const normalized = normalizeTime24(value);
        if (normalized && normalized !== value) {
          onNormalize(normalized);
        }
      }}
      className={cn(
        "h-8 w-24 text-center font-mono text-sm tabular-nums",
        invalid && "border-destructive focus-visible:ring-destructive/40"
      )}
    />
  );
}

export function AvailabilityEditorClient({
  initialTimezone,
  initialShifts,
  initialOverrides,
}: {
  initialTimezone: string;
  initialShifts: InitialShiftInput[];
  initialOverrides: OverrideItem[];
}) {
  const router = useRouter();
  const [isSavingWeekly, startWeeklyTransition] = useTransition();
  const [isSavingOverride, startOverrideTransition] = useTransition();

  const timezones = useMemo(() => getSupportedTimezones(), []);
  const timeOptions = useMemo(() => getTimeOptions(), []);

  const [timezone, setTimezone] = useState(initialTimezone);
  const [shifts, setShifts] = useState<ShiftItem[]>(() =>
    initialShifts.map((s, idx) => ({
      ...s,
      id: `init_${s.dayOfWeek}_${idx}`,
    }))
  );
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
    setWeeklyError(null);
    if (!enabled) {
      setShifts((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
    } else {
      setShifts((prev) => [
        ...prev,
        { id: makeShiftId(), dayOfWeek, startTime: "09:00", endTime: "17:00" },
      ]);
    }
  }

  function addShift(dayOfWeek: number, dayLabel: string) {
    setWeeklySaved(false);
    setWeeklyError(null);

    const dayShifts = shifts.filter((s) => s.dayOfWeek === dayOfWeek);
    const candidate = findNextNonOverlappingShift(dayShifts);

    if (!candidate) {
      setWeeklyError(
        `No non-overlapping time left on ${dayLabel}. Shorten an existing shift first to add another.`
      );
      return;
    }

    setShifts((prev) => [
      ...prev,
      {
        id: makeShiftId(),
        dayOfWeek,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
      },
    ]);
  }

  function updateShiftById(id: string, patch: Partial<ShiftItem>) {
    setWeeklySaved(false);
    setWeeklyError(null);
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  function removeShiftById(id: string) {
    setWeeklySaved(false);
    setWeeklyError(null);
    setShifts((prev) => prev.filter((s) => s.id !== id));
  }

  function handleSaveWeekly() {
    setWeeklyError(null);
    setWeeklySaved(false);

    // Normalize all typed 24-hour times before validating and submitting
    const normalizedShifts: ShiftItem[] = [];
    for (const s of shifts) {
      const start = normalizeTime24(s.startTime);
      const end = normalizeTime24(s.endTime);
      if (!start || !end) {
        setWeeklyError(
          "Please enter valid 24-hour times in HH:mm format (00:00 – 23:59)."
        );
        return;
      }
      if (start >= end) {
        setWeeklyError("Each shift's end time must be after its start time.");
        return;
      }
      normalizedShifts.push({ ...s, startTime: start, endTime: end });
    }

    setShifts(normalizedShifts);

    for (const { dayOfWeek, label } of ORDERED_DAYS) {
      const dayError = getDayValidationError(
        normalizedShifts.filter((s) => s.dayOfWeek === dayOfWeek)
      );
      if (dayError) {
        setWeeklyError(`${label}: ${dayError}`);
        return;
      }
    }

    startWeeklyTransition(async () => {
      const res = await saveWeeklyAvailabilityAction({
        timezone,
        shifts: normalizedShifts.map(({ dayOfWeek, startTime, endTime }) => ({
          dayOfWeek,
          startTime,
          endTime,
        })),
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

    const normStart = isUnavailable ? null : normalizeTime24(overrideStart);
    const normEnd = isUnavailable ? null : normalizeTime24(overrideEnd);

    if (!isUnavailable) {
      if (!normStart || !normEnd) {
        setOverrideError("Enter valid 24-hour HH:mm times (00:00 – 23:59).");
        return;
      }
      setOverrideStart(normStart);
      setOverrideEnd(normEnd);
      if (normStart >= normEnd) {
        setOverrideError("End time must be after start time.");
        return;
      }
    }

    startOverrideTransition(async () => {
      const res = await upsertDateOverrideAction({
        date: overrideDate,
        isUnavailable,
        startTime: normStart,
        endTime: normEnd,
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
      <datalist id="time-24h-options">
        {timeOptions.map((t) => (
          <option key={t} value={t} />
        ))}
        <option value="23:59" />
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Availability
          </h1>
          <p className="text-sm text-muted-foreground">
            Set your recurring weekly hours (24-hour HH:mm), primary timezone, and date-specific overrides.
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
            Type 24-hour times directly (e.g., <code>08:30</code> – <code>12:00</code> and <code>13:00</code> – <code>17:30</code>) or choose from the dropdown list.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-y">
          {ORDERED_DAYS.map(({ dayOfWeek, label }) => {
            const dayShifts = shifts.filter((s) => s.dayOfWeek === dayOfWeek);
            const enabled = dayShifts.length > 0;
            const dayError = enabled ? getDayValidationError(dayShifts) : null;
            const canAddAnother =
              enabled && findNextNonOverlappingShift(dayShifts) !== null;

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
                  <Label htmlFor={`day-${dayOfWeek}`} className="font-medium">
                    {label}
                  </Label>
                </div>

                {!enabled ? (
                  <p className="flex-1 pt-1 text-sm text-muted-foreground">
                    Unavailable
                  </p>
                ) : (
                  <div className="flex-1 space-y-2">
                    {dayShifts.map((shift, idx) => {
                      const startInvalid =
                        shift.startTime.length > 0 &&
                        !HHMM_REGEX.test(
                          normalizeTime24(shift.startTime) ?? ""
                        );
                      const endInvalid =
                        shift.endTime.length > 0 &&
                        !HHMM_REGEX.test(normalizeTime24(shift.endTime) ?? "");

                      return (
                        <div
                          key={shift.id}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <Time24Input
                            ariaLabel={`${label} shift ${idx + 1} start`}
                            value={shift.startTime}
                            invalid={startInvalid}
                            onChange={(val) =>
                              updateShiftById(shift.id, { startTime: val })
                            }
                            onNormalize={(norm) =>
                              updateShiftById(shift.id, { startTime: norm })
                            }
                          />

                          <span className="text-muted-foreground">–</span>

                          <Time24Input
                            ariaLabel={`${label} shift ${idx + 1} end`}
                            value={shift.endTime}
                            invalid={endInvalid}
                            onChange={(val) =>
                              updateShiftById(shift.id, { endTime: val })
                            }
                            onNormalize={(norm) =>
                              updateShiftById(shift.id, { endTime: norm })
                            }
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => removeShiftById(shift.id)}
                            aria-label="Remove shift"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </Button>

                          {idx === dayShifts.length - 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={!canAddAnother}
                              onClick={() => addShift(dayOfWeek, label)}
                              title={
                                canAddAnother
                                  ? "Add another non-overlapping shift"
                                  : "No remaining free time on this day"
                              }
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />
                              Add Shift
                            </Button>
                          )}
                        </div>
                      );
                    })}

                    {dayError && (
                      <p className="text-xs text-destructive">{dayError}</p>
                    )}
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
            className="space-y-4 rounded-lg border bg-muted/50 p-4"
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
                <Label className="mr-2 text-xs">Custom Hours (24h):</Label>
                <Time24Input
                  ariaLabel="Date override start time"
                  value={overrideStart}
                  onChange={setOverrideStart}
                  onNormalize={setOverrideStart}
                />
                <span>–</span>
                <Time24Input
                  ariaLabel="Date override end time"
                  value={overrideEnd}
                  onChange={setOverrideEnd}
                  onNormalize={setOverrideEnd}
                />
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
