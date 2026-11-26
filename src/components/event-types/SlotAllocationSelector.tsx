"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Split, Trash2, Users } from "lucide-react";
import type {
  LocationAllocationItem,
  LocationDistribution,
  LocationLevel,
  SlotLimitScope,
} from "@/lib/validations/event-type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface PsgcOption {
  code: string;
  name: string;
}

interface SlotAllocationSelectorProps {
  slotLimitScope: SlotLimitScope;
  slotLimit: number | null;
  locationDistribution: LocationDistribution;
  onChangeScope: (scope: SlotLimitScope) => void;
  onChangeSlotLimit: (limit: number | null) => void;
  onChangeDistribution: (dist: LocationDistribution) => void;
}

const SCOPE_OPTIONS: {
  value: SlotLimitScope;
  title: string;
  description: string;
}[] = [
  {
    value: "NONE",
    title: "1-on-1 per Time Slot",
    description: "Default behavior — 1 booking blocks that time slot.",
  },
  {
    value: "PER_EVENT",
    title: "Every Event (Total Quota)",
    description:
      "Set a total slot pool for the whole event; multiple clients can book until full.",
  },
  {
    value: "PER_DAY",
    title: "Every Day (Daily Quota)",
    description:
      "Set a daily slot pool that resets each open date; multiple clients can book until full.",
  },
];

const LEVEL_OPTIONS: { value: LocationLevel; label: string }[] = [
  { value: "NONE", label: "No location split (All PSGC)" },
  { value: "PROVINCE", label: "Per Province" },
  { value: "MUNICIPALITY", label: "Per Municipality / City" },
  { value: "BARANGAY", label: "Per Barangay" },
];

export function SlotAllocationSelector({
  slotLimitScope,
  slotLimit,
  locationDistribution,
  onChangeScope,
  onChangeSlotLimit,
  onChangeDistribution,
}: SlotAllocationSelectorProps) {
  const [provinces, setProvinces] = useState<PsgcOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(false);
  const [selectedProvinceCode, setSelectedProvinceCode] = useState("");

  const [municipalities, setMunicipalities] = useState<PsgcOption[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [selectedMunicipalityCode, setSelectedMunicipalityCode] = useState("");

  const [barangays, setBarangays] = useState<PsgcOption[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [psgcError, setPsgcError] = useState<string | null>(null);

  const level = locationDistribution.level;
  const allocations = locationDistribution.allocations;

  // Load provinces once a PSGC distribution level is active
  useEffect(() => {
    if (level === "NONE" || provinces.length > 0) return;
    let cancelled = false;
    setLoadingProvinces(true);
    setPsgcError(null);

    fetch("/api/psgc?type=provinces")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load provinces");
        return res.json() as Promise<{ items: PsgcOption[] }>;
      })
      .then((data) => {
        if (!cancelled) setProvinces(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setPsgcError("Could not load PSGC provinces. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });

    return () => {
      cancelled = true;
    };
  }, [level, provinces.length]);

  // Load municipalities when province changes (for MUNICIPALITY or BARANGAY level)
  useEffect(() => {
    setSelectedMunicipalityCode("");
    setMunicipalities([]);
    setBarangays([]);

    if (
      !selectedProvinceCode ||
      (level !== "MUNICIPALITY" && level !== "BARANGAY")
    ) {
      return;
    }

    let cancelled = false;
    setLoadingMunicipalities(true);
    setPsgcError(null);

    fetch(
      `/api/psgc?type=municipalities&provinceCode=${encodeURIComponent(
        selectedProvinceCode
      )}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load municipalities");
        return res.json() as Promise<{ items: PsgcOption[] }>;
      })
      .then((data) => {
        if (!cancelled) setMunicipalities(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setPsgcError("Could not load municipalities for this province.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProvinceCode, level]);

  // Load barangays when municipality changes (for BARANGAY level)
  useEffect(() => {
    setBarangays([]);
    if (!selectedMunicipalityCode || level !== "BARANGAY") return;

    let cancelled = false;
    setLoadingBarangays(true);
    setPsgcError(null);

    fetch(
      `/api/psgc?type=barangays&municipalityCode=${encodeURIComponent(
        selectedMunicipalityCode
      )}`
    )
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load barangays");
        return res.json() as Promise<{ items: PsgcOption[] }>;
      })
      .then((data) => {
        if (!cancelled) setBarangays(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setPsgcError("Could not load barangays for this municipality.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBarangays(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMunicipalityCode, level]);

  const selectedProvince = useMemo(
    () => provinces.find((p) => p.code === selectedProvinceCode) ?? null,
    [provinces, selectedProvinceCode]
  );

  const selectedMunicipality = useMemo(
    () =>
      municipalities.find((m) => m.code === selectedMunicipalityCode) ?? null,
    [municipalities, selectedMunicipalityCode]
  );

  const candidateOptions: PsgcOption[] = useMemo(() => {
    const base =
      level === "PROVINCE"
        ? provinces
        : level === "MUNICIPALITY"
          ? municipalities
          : level === "BARANGAY"
            ? barangays
            : [];

    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((item) => item.name.toLowerCase().includes(q));
  }, [level, provinces, municipalities, barangays, searchQuery]);

  const allocationByCode = useMemo(() => {
    const map = new Map<string, LocationAllocationItem>();
    for (const item of allocations) {
      map.set(item.code, item);
    }
    return map;
  }, [allocations]);

  const totalAllocated = useMemo(
    () => allocations.reduce((sum, item) => sum + (item.slots || 0), 0),
    [allocations]
  );

  function handleScopeChange(nextScope: SlotLimitScope) {
    onChangeScope(nextScope);
    if (nextScope === "NONE") {
      onChangeSlotLimit(null);
      onChangeDistribution({ level: "NONE", allocations: [] });
    } else if (!slotLimit || slotLimit < 1) {
      onChangeSlotLimit(50);
    }
  }

  function handleLevelChange(nextLevel: LocationLevel) {
    setSearchQuery("");
    if (nextLevel !== "NONE" && slotLimitScope === "NONE") {
      onChangeScope("PER_EVENT");
      if (!slotLimit || slotLimit < 1) {
        onChangeSlotLimit(50);
      }
    }
    // Reset allocations when switching hierarchy levels so codes match the chosen level
    if (nextLevel !== level) {
      onChangeDistribution({ level: nextLevel, allocations: [] });
    }
  }

  function buildItem(opt: PsgcOption, slots: number): LocationAllocationItem {
    if (level === "PROVINCE") {
      return {
        code: opt.code,
        name: opt.name,
        slots,
        provinceCode: opt.code,
        provinceName: opt.name,
      };
    }
    if (level === "MUNICIPALITY") {
      return {
        code: opt.code,
        name: opt.name,
        slots,
        provinceCode: selectedProvince?.code,
        provinceName: selectedProvince?.name,
        municipalityCode: opt.code,
        municipalityName: opt.name,
      };
    }
    return {
      code: opt.code,
      name: opt.name,
      slots,
      provinceCode: selectedProvince?.code,
      provinceName: selectedProvince?.name,
      municipalityCode: selectedMunicipality?.code,
      municipalityName: selectedMunicipality?.name,
    };
  }

  function syncTotalIfExceeded(nextAllocations: LocationAllocationItem[]) {
    const sum = nextAllocations.reduce((acc, a) => acc + (a.slots || 0), 0);
    if (sum > (slotLimit ?? 0)) {
      onChangeSlotLimit(sum);
    }
  }

  function toggleLocation(opt: PsgcOption, checked: boolean) {
    let next: LocationAllocationItem[];
    if (checked) {
      if (allocationByCode.has(opt.code)) return;
      const defaultSlots = Math.max(
        1,
        Math.floor((slotLimit ?? 10) / Math.max(1, allocations.length + 1))
      );
      next = [...allocations, buildItem(opt, defaultSlots)];
    } else {
      next = allocations.filter((a) => a.code !== opt.code);
    }
    onChangeDistribution({ level, allocations: next });
    syncTotalIfExceeded(next);
  }

  function addAllCandidates() {
    if (candidateOptions.length === 0) return;
    const merged = new Map<string, LocationAllocationItem>();
    for (const existing of allocations) {
      merged.set(existing.code, existing);
    }
    for (const opt of candidateOptions) {
      if (!merged.has(opt.code)) {
        merged.set(opt.code, buildItem(opt, 1));
      }
    }
    const list = Array.from(merged.values());
    const targetTotal = Math.max(slotLimit ?? list.length, list.length);
    const distributed = splitEvenlyList(list, targetTotal);
    onChangeSlotLimit(targetTotal);
    onChangeDistribution({ level, allocations: distributed });
  }

  function splitEvenlyList(
    list: LocationAllocationItem[],
    total: number
  ): LocationAllocationItem[] {
    if (list.length === 0) return list;
    const safeTotal = Math.max(total, list.length);
    const base = Math.floor(safeTotal / list.length);
    const remainder = safeTotal % list.length;
    return list.map((item, idx) => ({
      ...item,
      slots: base + (idx < remainder ? 1 : 0),
    }));
  }

  function handleSplitEvenly() {
    if (allocations.length === 0) return;
    const targetTotal = Math.max(
      slotLimit ?? allocations.length,
      allocations.length
    );
    const distributed = splitEvenlyList(allocations, targetTotal);
    if (targetTotal !== slotLimit) {
      onChangeSlotLimit(targetTotal);
    }
    onChangeDistribution({ level, allocations: distributed });
  }

  function updateItemSlots(code: string, rawSlots: number) {
    const cleanSlots = Math.max(1, Math.min(100000, Math.floor(rawSlots || 1)));
    const next = allocations.map((item) =>
      item.code === code ? { ...item, slots: cleanSlots } : item
    );
    onChangeDistribution({ level, allocations: next });
    syncTotalIfExceeded(next);
  }

  function removeItem(code: string) {
    const next = allocations.filter((item) => item.code !== code);
    onChangeDistribution({ level, allocations: next });
  }

  const scopeUnitLabel =
    slotLimitScope === "PER_DAY" ? "slots per day" : "slots for the event";

  return (
    <div className="space-y-6">
      {/* 1. Slot Quota Scope Radio Group */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium leading-none">
          Slot Limit Mode
        </legend>
        <div className="grid gap-3 sm:grid-cols-3">
          {SCOPE_OPTIONS.map((opt) => {
            const active = slotLimitScope === opt.value;
            const inputId = `slot-scope-${opt.value.toLowerCase()}`;
            return (
              <label
                key={opt.value}
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3.5 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "hover:bg-accent"
                )}
              >
                <input
                  id={inputId}
                  type="radio"
                  name="slotLimitScope"
                  value={opt.value}
                  checked={active}
                  onChange={() => handleScopeChange(opt.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="space-y-1">
                  <span className="block text-sm font-medium">{opt.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* 2. Total Slots Input (shown when Every Event or Every Day is selected) */}
      {slotLimitScope !== "NONE" && (
        <div className="rounded-lg border bg-muted/40 p-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="event-slot-limit">
                {slotLimitScope === "PER_DAY"
                  ? "Maximum Slots per Day *"
                  : "Maximum Slots for Entire Event *"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="event-slot-limit"
                  name="slotLimit"
                  type="number"
                  min={1}
                  max={100000}
                  required
                  value={slotLimit ?? ""}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    onChangeSlotLimit(
                      Number.isFinite(val) && val > 0 ? val : null
                    );
                  }}
                  className="w-36 bg-background"
                />
                <span className="text-xs text-muted-foreground">
                  {scopeUnitLabel}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>
                Multiple clients can book available time slots until this limit
                is reached.
              </span>
            </div>
          </div>

          {/* 3. PSGC Geographic Distribution Radio Group */}
          <fieldset className="space-y-2.5 border-t pt-4">
            <legend className="flex items-center gap-1.5 text-sm font-medium">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Distribute Slots by Location (PSGC)</span>
            </legend>
            <p className="text-xs text-muted-foreground">
              Optionally divide {scopeUnitLabel} across specific Provinces,
              Municipalities / Cities, or Barangays.
            </p>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {LEVEL_OPTIONS.map((opt) => {
                const active = level === opt.value;
                const radioId = `loc-level-${opt.value.toLowerCase()}`;
                return (
                  <label
                    key={opt.value}
                    htmlFor={radioId}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "hover:bg-accent"
                    )}
                  >
                    <input
                      id={radioId}
                      type="radio"
                      name="locationDistributionLevel"
                      value={opt.value}
                      checked={active}
                      onChange={() => handleLevelChange(opt.value)}
                      className="h-3.5 w-3.5 shrink-0 accent-primary"
                    />
                    <span>{opt.label}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 4. PSGC Selector & Per-Location Slot Table */}
          {level !== "NONE" && (
            <div className="space-y-4 rounded-lg border bg-background p-4">
              {psgcError && (
                <p className="text-xs text-destructive">{psgcError}</p>
              )}

              {/* Parent cascade selectors when level is MUNICIPALITY or BARANGAY */}
              {(level === "MUNICIPALITY" || level === "BARANGAY") && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="dist-province">1. Select Province</Label>
                    <select
                      id="dist-province"
                      disabled={loadingProvinces}
                      value={selectedProvinceCode}
                      onChange={(e) => setSelectedProvinceCode(e.target.value)}
                      className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    >
                      <option value="">
                        {loadingProvinces
                          ? "Loading provinces..."
                          : "Choose Province..."}
                      </option>
                      {provinces.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {level === "BARANGAY" && (
                    <div className="space-y-1.5">
                      <Label htmlFor="dist-municipality">
                        2. Select Municipality / City
                      </Label>
                      <select
                        id="dist-municipality"
                        disabled={
                          !selectedProvinceCode || loadingMunicipalities
                        }
                        value={selectedMunicipalityCode}
                        onChange={(e) =>
                          setSelectedMunicipalityCode(e.target.value)
                        }
                        className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                      >
                        <option value="">
                          {!selectedProvinceCode
                            ? "Select province first"
                            : loadingMunicipalities
                              ? "Loading municipalities..."
                              : "Choose Municipality / City..."}
                        </option>
                        {municipalities.map((m) => (
                          <option key={m.code} value={m.code}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Candidate checklist */}
              {((level === "PROVINCE" && !loadingProvinces) ||
                (level === "MUNICIPALITY" &&
                  selectedProvinceCode &&
                  !loadingMunicipalities) ||
                (level === "BARANGAY" &&
                  selectedMunicipalityCode &&
                  !loadingBarangays)) && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <search className="flex-1 min-w-[200px]">
                      <Label htmlFor="dist-filter" className="sr-only">
                        Filter locations
                      </Label>
                      <Input
                        id="dist-filter"
                        type="search"
                        placeholder={`Filter ${
                          level === "PROVINCE"
                            ? "provinces"
                            : level === "MUNICIPALITY"
                              ? "municipalities / cities"
                              : "barangays"
                        }...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                      />
                    </search>

                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      onClick={addAllCandidates}
                      disabled={candidateOptions.length === 0}
                    >
                      Add All Shown ({candidateOptions.length})
                    </Button>
                  </div>

                  <div className="max-h-44 overflow-y-auto rounded-lg border p-2.5 grid gap-1.5 sm:grid-cols-2 md:grid-cols-3">
                    {candidateOptions.length === 0 ? (
                      <p className="col-span-full py-3 text-center text-xs text-muted-foreground">
                        No matching locations found.
                      </p>
                    ) : (
                      candidateOptions.map((opt) => {
                        const checked = allocationByCode.has(opt.code);
                        const cbId = `psgc-pick-${opt.code}`;
                        return (
                          <label
                            key={opt.code}
                            htmlFor={cbId}
                            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                          >
                            <input
                              id={cbId}
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                toggleLocation(opt, e.target.checked)
                              }
                              className="h-3.5 w-3.5 shrink-0 rounded accent-primary"
                            />
                            <span className="truncate" title={opt.name}>
                              {opt.name}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {(loadingProvinces ||
                loadingMunicipalities ||
                loadingBarangays) && (
                <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Loading PSGC locations...</span>
                </div>
              )}

              {/* Assigned Locations Table */}
              <div className="space-y-3 border-t pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold">
                      Assigned Locations ({allocations.length})
                    </span>
                    <Badge variant="secondary" className="text-[11px]">
                      Allocated: {totalAllocated} / {slotLimit ?? 0}{" "}
                      {slotLimitScope === "PER_DAY" ? "per day" : "total"}
                    </Badge>
                  </div>

                  {allocations.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={handleSplitEvenly}
                      >
                        <Split className="mr-1 h-3.5 w-3.5" />
                        Split {slotLimit ?? allocations.length} Evenly
                      </Button>

                      {totalAllocated > 0 && totalAllocated !== slotLimit && (
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => onChangeSlotLimit(totalAllocated)}
                        >
                          Match Total ({totalAllocated})
                        </Button>
                      )}

                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        onClick={() =>
                          onChangeDistribution({ level, allocations: [] })
                        }
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>

                {allocations.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">
                    Check one or more{" "}
                    {level === "PROVINCE"
                      ? "provinces"
                      : level === "MUNICIPALITY"
                        ? "municipalities / cities"
                        : "barangays"}{" "}
                    above to assign slot quotas.
                  </p>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {allocations.map((item) => {
                      const subLabel =
                        level === "BARANGAY"
                          ? [item.municipalityName, item.provinceName]
                              .filter(Boolean)
                              .join(", ")
                          : level === "MUNICIPALITY"
                            ? item.provinceName
                            : null;
                      const slotInputId = `alloc-slots-${item.code}`;

                      return (
                        <div
                          key={item.code}
                          className="flex items-center justify-between gap-3 rounded-lg border bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-medium">
                              {item.name}
                            </p>
                            {subLabel && (
                              <p className="truncate text-[11px] text-muted-foreground">
                                {subLabel}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={slotInputId}
                              className="text-[11px] text-muted-foreground"
                            >
                              Slots
                            </Label>
                            <Input
                              id={slotInputId}
                              type="number"
                              min={1}
                              max={100000}
                              value={item.slots}
                              onChange={(e) =>
                                updateItemSlots(
                                  item.code,
                                  parseInt(e.target.value, 10)
                                )
                              }
                              className="h-7 w-24 bg-background text-xs"
                            />
                            <Button
                              type="button"
                              size="icon-xs"
                              variant="ghost"
                              aria-label={`Remove ${item.name}`}
                              onClick={() => removeItem(item.code)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

