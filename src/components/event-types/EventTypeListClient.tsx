"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import {
  createEventTypeAction,
  deleteEventTypeAction,
  toggleEventTypeActiveAction,
} from "@/actions/event-types";
import { slugify } from "@/lib/validations/event-type";
import { Button, buttonVariants } from "@/components/ui/button";
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

interface EventTypeItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  durationMinutes: number;
  location: string | null;
  isActive: boolean;
  bookingsCount: number;
  slotLimitScope?: "NONE" | "PER_EVENT" | "PER_DAY";
  slotLimit?: number | null;
  locationLevel?: "NONE" | "PROVINCE" | "MUNICIPALITY" | "BARANGAY";
}

export function EventTypeListClient({
  username,
  items,
}: {
  username: string;
  items: EventTypeItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(items.length === 0);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [location, setLocation] = useState("Google Meet");
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createEventTypeAction({
        title,
        slug: slug || slugify(title),
        durationMinutes,
        location,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setTitle("");
      setSlug("");
      setShowCreate(false);
      router.push(`/dashboard/event-types/${res.id}`);
    });
  }

  function handleCopyLink(item: EventTypeItem) {
    const url = `${window.location.origin}/${username}/${item.slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function handleToggle(id: string, next: boolean) {
    startTransition(async () => {
      await toggleEventTypeActiveAction(id, next);
      router.refresh();
    });
  }

  function handleDelete(id: string, itemTitle: string) {
    if (!window.confirm(`Delete "${itemTitle}" and all its associated bookings?`)) {
      return;
    }
    startTransition(async () => {
      await deleteEventTypeAction(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Event Types</h1>
          <p className="text-sm text-muted-foreground">
            Create customizable scheduling links for <code>/{username}</code>.
          </p>
        </div>

        <Button onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Event Type
        </Button>
      </div>

      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create New Event Type</CardTitle>
            <CardDescription>
              Start with the basics — you can add custom questions, buffers, and redirects next.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-title">Title</Label>
                  <Input
                    id="new-title"
                    required
                    placeholder="30 Minute Discovery Call"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!slug || slug === slugify(title)) {
                        setSlug(slugify(e.target.value));
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-slug">URL Slug</Label>
                  <Input
                    id="new-slug"
                    required
                    placeholder="30-min-call"
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="new-duration">Duration (minutes)</Label>
                  <Input
                    id="new-duration"
                    type="number"
                    min={5}
                    max={720}
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Math.max(5, Number(e.target.value) || 30))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-location">Location</Label>
                  <Input
                    id="new-location"
                    placeholder="Google Meet"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  )}
                  Continue to Editor
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            You don&apos;t have any event types yet. Create one above to share your first booking link.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <Card
              key={item.id}
              className={cn(!item.isActive && "opacity-65")}
            >
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <span>{item.title}</span>
                    {!item.isActive && (
                      <Badge variant="secondary">Hidden</Badge>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    /{username}/{item.slug}
                  </CardDescription>
                </div>

                <Switch
                  checked={item.isActive}
                  onCheckedChange={(c) => handleToggle(item.id, Boolean(c))}
                  aria-label={`Toggle ${item.title}`}
                />
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {item.durationMinutes} min
                  </span>
                  {item.location && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {item.location}
                    </span>
                  )}
                  <span>{item.bookingsCount} bookings</span>
                  {item.slotLimitScope &&
                    item.slotLimitScope !== "NONE" &&
                    item.slotLimit && (
                      <span className="inline-flex items-center gap-1 text-foreground font-medium">
                        <Users className="h-3.5 w-3.5 text-primary" />
                        {item.slotLimit} slots /{" "}
                        {item.slotLimitScope === "PER_DAY" ? "day" : "event"}
                        {item.locationLevel && item.locationLevel !== "NONE"
                          ? ` · Per ${
                              item.locationLevel === "PROVINCE"
                                ? "Province"
                                : item.locationLevel === "MUNICIPALITY"
                                  ? "Municipality"
                                  : "Barangay"
                            }`
                          : ""}
                      </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      onClick={() => handleCopyLink(item)}
                    >
                      {copiedId === item.id ? (
                        <Check className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="mr-1 h-3.5 w-3.5" />
                      )}
                      {copiedId === item.id ? "Copied" : "Copy Link"}
                    </Button>
                    <Link
                      href={`/${username}/${item.slug}`}
                      target="_blank"
                      className={cn(
                        buttonVariants({ variant: "ghost", size: "xs" })
                      )}
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" />
                      Preview
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/event-types/${item.id}`}
                      className={cn(
                        buttonVariants({ variant: "outline", size: "xs" })
                      )}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Link>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDelete(item.id, item.title)}
                      aria-label={`Delete ${item.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

