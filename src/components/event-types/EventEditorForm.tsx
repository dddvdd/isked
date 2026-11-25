"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, ExternalLink, Loader2 } from "lucide-react";
import {
  slugify,
  type CustomQuestion,
  type EventTypeInput,
} from "@/lib/validations/event-type";
import { updateEventTypeAction } from "@/actions/event-types";
import { CustomQuestionBuilder } from "@/components/event-types/CustomQuestionBuilder";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface EventEditorFormProps {
  eventTypeId: string;
  username: string;
  initialValues: EventTypeInput;
}

const DURATION_PRESETS = [15, 30, 45, 60];
const LOCATION_PRESETS = [
  "Google Meet",
  "Zoom",
  "Phone Call",
  "In Person",
];

export function EventEditorForm({
  eventTypeId,
  username,
  initialValues,
}: EventEditorFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialValues.title);
  const [slug, setSlug] = useState(initialValues.slug);
  const [description, setDescription] = useState(
    initialValues.description ?? ""
  );
  const [durationMinutes, setDurationMinutes] = useState(
    initialValues.durationMinutes
  );
  const [bufferBeforeMinutes, setBufferBeforeMinutes] = useState(
    initialValues.bufferBeforeMinutes
  );
  const [bufferAfterMinutes, setBufferAfterMinutes] = useState(
    initialValues.bufferAfterMinutes
  );
  const [location, setLocation] = useState(initialValues.location ?? "");
  const [isActive, setIsActive] = useState(initialValues.isActive);
  const [customQuestions, setCustomQuestions] = useState<CustomQuestion[]>(
    initialValues.customQuestions
  );
  const [postBookingBehavior, setPostBookingBehavior] = useState<
    "CONFIRMATION_PAGE" | "REDIRECT"
  >(initialValues.postBookingBehavior);
  const [redirectUrl, setRedirectUrl] = useState(
    initialValues.redirectUrl ?? ""
  );

  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const res = await updateEventTypeAction(eventTypeId, {
        title,
        slug: slugify(slug) || slug,
        description,
        durationMinutes,
        bufferBeforeMinutes,
        bufferAfterMinutes,
        location,
        isActive,
        customQuestions,
        postBookingBehavior,
        redirectUrl: postBookingBehavior === "REDIRECT" ? redirectUrl : null,
      });

      if (!res.ok) {
        setError(res.error);
        return;
      }

      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/event-types"
            className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }))}
            aria-label="Back to Event Types"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title || "Edit Event Type"}</h1>
            <p className="text-xs text-muted-foreground">
              Public URL: /{username}/{slug}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Switch
              id="event-active"
              checked={isActive}
              onCheckedChange={(c) => setIsActive(Boolean(c))}
            />
            <Label htmlFor="event-active" className="text-xs">
              {isActive ? "Active" : "Hidden"}
            </Label>
          </div>

          <Link
            href={`/${username}/${slug}`}
            target="_blank"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Preview
          </Link>

          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : saved ? (
              <Check className="mr-1.5 h-4 w-4" />
            ) : null}
            {saved ? "Saved" : "Save Changes"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Event Basics</CardTitle>
          <CardDescription>
            Configure the title, link slug, description, and meeting location.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Event Title</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="30 Minute Discovery Call"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="slug">URL Slug</Label>
              <div className="flex items-center rounded-lg border border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
                <span className="pl-3 text-xs text-muted-foreground">
                  /{username}/
                </span>
                <input
                  id="slug"
                  required
                  value={slug}
                  onChange={(e) => setSlug(slugify(e.target.value))}
                  className="h-8 w-full bg-transparent px-1.5 text-sm outline-none"
                  placeholder="30-min-call"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">
              Description (supports Markdown formatting)
            </Label>
            <Textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Share agenda details, preparation notes, or meeting links..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_PRESETS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={location === preset ? "default" : "outline"}
                  onClick={() => setLocation(preset)}
                >
                  {preset}
                </Button>
              ))}
            </div>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Google Meet, Zoom URL, phone number, or address"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Duration & Buffers</CardTitle>
          <CardDescription>
            Control slot length and padding before/after meetings to prevent back-to-back fatigue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="duration">Duration (minutes)</Label>
            <div className="flex flex-wrap items-center gap-2">
              {DURATION_PRESETS.map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  size="sm"
                  variant={durationMinutes === mins ? "default" : "outline"}
                  onClick={() => setDurationMinutes(mins)}
                >
                  {mins}m
                </Button>
              ))}
              <Input
                id="duration"
                type="number"
                min={5}
                max={720}
                value={durationMinutes}
                onChange={(e) =>
                  setDurationMinutes(Math.max(5, Number(e.target.value) || 15))
                }
                className="w-28"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bufferBefore">Buffer Before (minutes)</Label>
              <Input
                id="bufferBefore"
                type="number"
                min={0}
                max={240}
                step={5}
                value={bufferBeforeMinutes}
                onChange={(e) =>
                  setBufferBeforeMinutes(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bufferAfter">Buffer After (minutes)</Label>
              <Input
                id="bufferAfter"
                type="number"
                min={0}
                max={240}
                step={5}
                value={bufferAfterMinutes}
                onChange={(e) =>
                  setBufferAfterMinutes(Math.max(0, Number(e.target.value) || 0))
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invitee Booking Form</CardTitle>
          <CardDescription>
            Customize additional questions invitees answer before confirming.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CustomQuestionBuilder
            questions={customQuestions}
            onChange={setCustomQuestions}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Post-Booking Confirmation</CardTitle>
          <CardDescription>
            Choose whether to show the built-in confirmation page or redirect invitees to an external URL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPostBookingBehavior("CONFIRMATION_PAGE")}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                postBookingBehavior === "CONFIRMATION_PAGE"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              <p className="text-sm font-medium">Built-in Confirmation Page</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Displays meeting summary, calendar download, and cancellation link.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPostBookingBehavior("REDIRECT")}
              className={cn(
                "rounded-lg border p-4 text-left transition-colors",
                postBookingBehavior === "REDIRECT"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-accent"
              )}
            >
              <p className="text-sm font-medium">Redirect to External URL</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Redirects invitee with booking details appended as URL query params.
              </p>
            </button>
          </div>

          {postBookingBehavior === "REDIRECT" && (
            <div className="space-y-1.5">
              <Label htmlFor="redirectUrl">Redirect URL</Label>
              <Input
                id="redirectUrl"
                type="url"
                placeholder="https://yoursite.com/thank-you"
                value={redirectUrl}
                onChange={(e) => setRedirectUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Appends{" "}
                <code>
                  ?booking_uid=...&amp;event_type=...&amp;invitee_name=...&amp;invitee_email=...&amp;start_time=...
                </code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </form>
  );
}

