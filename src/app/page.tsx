import Link from "next/link";
import { Calendar, Clock, Globe, BarChart3 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <Calendar className="h-5 w-5 text-primary" />
            <span>CalClone</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost" }))}
            >
              Sign In
            </Link>
            <Link href="/dashboard/event-types" className={cn(buttonVariants())}>
              Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex flex-1 max-w-5xl flex-col justify-center px-6 py-20">
        <div className="max-w-2xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Scheduling without the back-and-forth.
          </h1>
          <p className="text-lg text-muted-foreground">
            Configure your availability, share custom booking links with
            automatic timezone conversion, and track conversions from one
            dashboard.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={cn(buttonVariants({ size: "lg" }))}>
              Get Started
            </Link>
            <Link
              href="/dashboard/event-types"
              className={cn(buttonVariants({ size: "lg", variant: "outline" }))}
            >
              Open Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <div className="rounded-lg border bg-card p-5">
            <Clock className="mb-3 h-5 w-5 text-primary" />
            <h2 className="font-semibold">Flexible Availability</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Set weekly recurring hours, split shifts, buffers, and date-specific overrides.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <Globe className="mb-3 h-5 w-5 text-primary" />
            <h2 className="font-semibold">Timezone Smart</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              All bookings stored in UTC with automatic invitee timezone detection.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-5">
            <BarChart3 className="mb-3 h-5 w-5 text-primary" />
            <h2 className="font-semibold">Built-in Analytics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Track link views, conversion rates, cancellations, and peak booking hours.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
