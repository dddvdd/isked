"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarCheck, Loader2, MapPin } from "lucide-react";
import type { CustomQuestion } from "@/lib/validations/event-type";
import { createBookingAction } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type AnswerValue = string | boolean | string[];

interface PsgcOption {
  code: string;
  name: string;
}

interface InviteeFormProps {
  username: string;
  eventSlug: string;
  slotIso: string;
  durationMinutes: number;
  inviteeTimezone: string;
  showAdditionalNotes: boolean;
  customQuestions: CustomQuestion[];
  onBack: () => void;
}

const SUFFIX_SUGGESTIONS = ["Jr.", "Sr.", "II", "III", "IV", "V"];

export function InviteeForm({
  username,
  eventSlug,
  slotIso,
  durationMinutes,
  inviteeTimezone,
  showAdditionalNotes,
  customQuestions,
  onBack,
}: InviteeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Structured default name fields
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");

  const [inviteeEmail, setInviteeEmail] = useState("");

  // PSGC cascading address state
  const [provinces, setProvinces] = useState<PsgcOption[]>([]);
  const [loadingProvinces, setLoadingProvinces] = useState(true);
  const [provinceCode, setProvinceCode] = useState("");

  const [municipalities, setMunicipalities] = useState<PsgcOption[]>([]);
  const [loadingMunicipalities, setLoadingMunicipalities] = useState(false);
  const [municipalityCode, setMunicipalityCode] = useState("");

  const [barangays, setBarangays] = useState<PsgcOption[]>([]);
  const [loadingBarangays, setLoadingBarangays] = useState(false);
  const [barangayCode, setBarangayCode] = useState("");

  const [psgcError, setPsgcError] = useState<string | null>(null);

  const [notes, setNotes] = useState("");
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [error, setError] = useState<string | null>(null);

  // Load PSGC Provinces on mount
  useEffect(() => {
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
          setPsgcError("Could not load PSGC provinces. Please refresh and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProvinces(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load PSGC Municipalities when Province changes
  useEffect(() => {
    setMunicipalityCode("");
    setMunicipalities([]);
    setBarangayCode("");
    setBarangays([]);

    if (!provinceCode) return;

    let cancelled = false;
    setLoadingMunicipalities(true);
    setPsgcError(null);

    fetch(
      `/api/psgc?type=municipalities&provinceCode=${encodeURIComponent(
        provinceCode
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
          setPsgcError("Could not load municipalities for the selected province.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingMunicipalities(false);
      });

    return () => {
      cancelled = true;
    };
  }, [provinceCode]);

  // Load PSGC Barangays when Municipality changes
  useEffect(() => {
    setBarangayCode("");
    setBarangays([]);

    if (!municipalityCode) return;

    let cancelled = false;
    setLoadingBarangays(true);
    setPsgcError(null);

    fetch(
      `/api/psgc?type=barangays&municipalityCode=${encodeURIComponent(
        municipalityCode
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
          setPsgcError("Could not load barangays for the selected municipality.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBarangays(false);
      });

    return () => {
      cancelled = true;
    };
  }, [municipalityCode]);

  const startDate = new Date(slotIso);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  const formattedWhen = (() => {
    try {
      const dayPart = new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: inviteeTimezone,
      }).format(startDate);
      const startTimePart = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: inviteeTimezone,
      }).format(startDate);
      const endTimePart = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: inviteeTimezone,
      }).format(endDate);
      return `${dayPart} · ${startTimePart} – ${endTimePart} (${inviteeTimezone})`;
    } catch {
      return startDate.toUTCString();
    }
  })();

  function toggleMultiCheckbox(
    questionId: string,
    option: string,
    checked: boolean
  ) {
    setAnswers((prev) => {
      const current = Array.isArray(prev[questionId])
        ? (prev[questionId] as string[])
        : [];
      const next = checked
        ? Array.from(new Set([...current, option]))
        : current.filter((item) => item !== option);
      return { ...prev, [questionId]: next };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selectedProvince = provinces.find((p) => p.code === provinceCode);
    const selectedMunicipality = municipalities.find(
      (m) => m.code === municipalityCode
    );
    const selectedBarangay = barangays.find((b) => b.code === barangayCode);

    if (!selectedProvince || !selectedMunicipality || !selectedBarangay) {
      setError(
        "Please select your Province, Municipality / City, and Barangay."
      );
      return;
    }

    for (const q of customQuestions) {
      if (q.type === "checkbox" && q.required) {
        if (q.options && q.options.length > 0) {
          const selected = answers[q.id];
          if (!Array.isArray(selected) || selected.length === 0) {
            setError(`Please select at least one option for "${q.label}".`);
            return;
          }
        } else if (answers[q.id] !== true) {
          setError(`Please check "${q.label}" to continue.`);
          return;
        }
      }
    }

    if (!privacyConsent) {
      setError(
        "Please agree to the Data Privacy Notice and Terms of Use before confirming."
      );
      return;
    }

    startTransition(async () => {
      const res = await createBookingAction({
        username,
        eventSlug,
        startTimeIso: slotIso,
        firstName,
        middleName,
        lastName,
        suffix,
        inviteeEmail,
        inviteeTimezone,
        address: {
          provinceCode: selectedProvince.code,
          province: selectedProvince.name,
          municipalityCode: selectedMunicipality.code,
          municipality: selectedMunicipality.name,
          barangayCode: selectedBarangay.code,
          barangay: selectedBarangay.name,
        },
        privacyConsent: true,
        notes: showAdditionalNotes ? notes : undefined,
        customAnswers: answers,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      if (res.redirectUrl) {
        window.location.assign(res.redirectUrl);
        return;
      }

      router.push(`/booking/${res.uid}/confirmed`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <datalist id="name-suffix-suggestions">
        {SUFFIX_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/60 px-3.5 py-2.5 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <CalendarCheck className="h-4 w-4 shrink-0 text-primary" />
          <span>{formattedWhen}</span>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Change
        </Button>
      </div>

      {/* Default Structured Name Fields */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invitee-first-name">First Name *</Label>
          <Input
            id="invitee-first-name"
            required
            placeholder="Juan"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invitee-middle-name">Middle Name</Label>
          <Input
            id="invitee-middle-name"
            placeholder="Santos"
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invitee-last-name">Last Name *</Label>
          <Input
            id="invitee-last-name"
            required
            placeholder="Dela Cruz"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="invitee-suffix">Suffix</Label>
          <Input
            id="invitee-suffix"
            list="name-suffix-suggestions"
            placeholder="Jr., Sr., III (optional)"
            maxLength={20}
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-email">Email Address *</Label>
        <Input
          id="invitee-email"
          type="email"
          required
          placeholder="juan@example.com"
          value={inviteeEmail}
          onChange={(e) => setInviteeEmail(e.target.value)}
        />
      </div>

      {/* Default PSGC Address Section */}
      <div className="space-y-3 rounded-lg border bg-muted/40 p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          <span>Address (PSGC)</span>
        </div>

        {psgcError && (
          <p className="text-xs text-destructive">{psgcError}</p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="psgc-province">Province *</Label>
          <select
            id="psgc-province"
            required
            disabled={loadingProvinces}
            value={provinceCode}
            onChange={(e) => setProvinceCode(e.target.value)}
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">
              {loadingProvinces
                ? "Loading provinces..."
                : "Select Province..."}
            </option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="psgc-municipality">Municipality / City *</Label>
            <select
              id="psgc-municipality"
              required
              disabled={!provinceCode || loadingMunicipalities}
              value={municipalityCode}
              onChange={(e) => setMunicipalityCode(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">
                {!provinceCode
                  ? "Select province first"
                  : loadingMunicipalities
                    ? "Loading municipalities..."
                    : "Select Municipality / City..."}
              </option>
              {municipalities.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="psgc-barangay">Barangay *</Label>
            <select
              id="psgc-barangay"
              required
              disabled={!municipalityCode || loadingBarangays}
              value={barangayCode}
              onChange={(e) => setBarangayCode(e.target.value)}
              className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">
                {!municipalityCode
                  ? "Select municipality first"
                  : loadingBarangays
                    ? "Loading barangays..."
                    : "Select Barangay..."}
              </option>
              {barangays.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {customQuestions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          {q.type === "checkbox" ? (
            q.options && q.options.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium leading-none">
                  {q.label}
                  {q.required ? " *" : ""}
                </legend>
                <div className="space-y-2 rounded-lg border border-input p-3">
                  {q.options.map((opt, optIdx) => {
                    const selected = Array.isArray(answers[q.id])
                      ? (answers[q.id] as string[]).includes(opt)
                      : false;
                    return (
                      <label
                        key={`${q.id}-${optIdx}`}
                        className="flex cursor-pointer items-center gap-2.5 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            toggleMultiCheckbox(q.id, opt, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-input accent-primary"
                        />
                        <span>{opt}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ) : (
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-input p-3 text-sm">
                <input
                  type="checkbox"
                  required={q.required}
                  checked={answers[q.id] === true}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span>
                  {q.label}
                  {q.required ? " *" : ""}
                </span>
              </label>
            )
          ) : (
            <>
              <Label htmlFor={`cq-${q.id}`}>
                {q.label}
                {q.required ? " *" : ""}
              </Label>

              {q.type === "text" && (
                <Input
                  id={`cq-${q.id}`}
                  required={q.required}
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}

              {q.type === "email" && (
                <Input
                  id={`cq-${q.id}`}
                  type="email"
                  required={q.required}
                  placeholder="name@example.com"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}

              {q.type === "phone" && (
                <Input
                  id={`cq-${q.id}`}
                  type="tel"
                  required={q.required}
                  placeholder="+63 912 345 6789"
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}

              {q.type === "textarea" && (
                <Textarea
                  id={`cq-${q.id}`}
                  rows={3}
                  required={q.required}
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}

              {q.type === "select" && (
                <select
                  id={`cq-${q.id}`}
                  required={q.required}
                  value={String(answers[q.id] ?? "")}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                  className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Select an option...</option>
                  {(q.options ?? []).map((opt, optIdx) => (
                    <option key={`${opt}-${optIdx}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      ))}

      {showAdditionalNotes && (
        <div className="space-y-1.5">
          <Label htmlFor="invitee-notes">Additional Notes</Label>
          <Textarea
            id="invitee-notes"
            rows={3}
            placeholder="Please share anything that will help prepare for our meeting."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      {/* Data Privacy Act (RA 10173) Informed Consent */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
        <input
          type="checkbox"
          required
          checked={privacyConsent}
          onChange={(e) => setPrivacyConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-input accent-primary"
        />
        <span className="text-muted-foreground">
          I consent to the collection and processing of my personal information
          (name, email, address, and booking responses) solely for scheduling and
          managing this appointment in accordance with the{" "}
          <Link
            href="/privacy"
            target="_blank"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Data Privacy Notice (RA 10173)
          </Link>{" "}
          and{" "}
          <Link
            href="/terms"
            target="_blank"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Terms of Use
          </Link>
          . *
        </span>
      </label>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Confirm Booking
      </Button>
    </form>
  );
}
