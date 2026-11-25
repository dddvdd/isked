"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cancelBookingAction } from "@/actions/bookings";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function CancelBookingClient({
  uid,
  alreadyCancelled,
  rebookHref,
}: {
  uid: string;
  alreadyCancelled: boolean;
  rebookHref: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [cancelled, setCancelled] = useState(alreadyCancelled);
  const [error, setError] = useState<string | null>(null);

  if (cancelled) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          This meeting has been cancelled and both parties have been notified.
        </p>
        <Link href={rebookHref} className={cn(buttonVariants())}>
          Schedule Another Time
        </Link>
      </div>
    );
  }

  function handleCancel(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await cancelBookingAction({ uid, reason });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCancelled(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleCancel} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="cancel-reason">
          Reason for cancelling (optional)
        </Label>
        <Textarea
          id="cancel-reason"
          rows={3}
          placeholder="Let the other attendee know why you need to cancel..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end gap-2">
        <Link
          href={`/booking/${uid}/confirmed`}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Keep Meeting
        </Link>
        <Button type="submit" variant="destructive" disabled={isPending}>
          {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          Cancel Meeting
        </Button>
      </div>
    </form>
  );
}

