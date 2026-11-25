"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarCheck, Loader2 } from "lucide-react";
import type { CustomQuestion } from "@/lib/validations/event-type";
import { createBookingAction } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface InviteeFormProps {
  username: string;
  eventSlug: string;
  slotIso: string;
  durationMinutes: number;
  inviteeTimezone: string;
  customQuestions: CustomQuestion[];
  onBack: () => void;
}

export function InviteeForm({
  username,
  eventSlug,
  slotIso,
  durationMinutes,
  inviteeTimezone,
  customQuestions,
  onBack,
}: InviteeFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [inviteeName, setInviteeName] = useState("");
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);

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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createBookingAction({
        username,
        eventSlug,
        startTimeIso: slotIso,
        inviteeName,
        inviteeEmail,
        inviteeTimezone,
        notes,
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
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-zinc-50 px-3.5 py-2.5 text-xs dark:bg-zinc-900">
        <div className="flex items-center gap-2 font-medium">
          <CalendarCheck className="h-4 w-4 shrink-0 text-primary" />
          <span>{formattedWhen}</span>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={onBack}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Change
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-name">Your Name *</Label>
        <Input
          id="invitee-name"
          required
          placeholder="Jane Doe"
          value={inviteeName}
          onChange={(e) => setInviteeName(e.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="invitee-email">Email Address *</Label>
        <Input
          id="invitee-email"
          type="email"
          required
          placeholder="jane@company.com"
          value={inviteeEmail}
          onChange={(e) => setInviteeEmail(e.target.value)}
        />
      </div>

      {customQuestions.map((q) => (
        <div key={q.id} className="space-y-1.5">
          {q.type === "checkbox" ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                required={q.required}
                checked={Boolean(answers[q.id])}
                onChange={(e) =>
                  setAnswers((prev) => ({
                    ...prev,
                    [q.id]: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-input"
              />
              <span>
                {q.label}
                {q.required ? " *" : ""}
              </span>
            </label>
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
                  {(q.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </>
          )}
        </div>
      ))}

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

