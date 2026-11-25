import { Suspense } from "react";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  CalendarClock,
  Clock,
  Loader2,
  LogOut,
} from "lucide-react";
import { requireCurrentUser } from "@/lib/auth";
import { signOutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  {
    href: "/dashboard/event-types",
    label: "Event Types",
    icon: CalendarClock,
  },
  {
    href: "/dashboard/availability",
    label: "Availability",
    icon: Clock,
  },
  {
    href: "/dashboard/bookings",
    label: "Bookings",
    icon: Calendar,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
];

async function DashboardShell({ children }: { children: React.ReactNode }) {
  const user = await requireCurrentUser();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-zinc-950">
      <aside className="flex w-full flex-col border-b bg-background md:w-64 md:border-r md:border-b-0">
        <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold tracking-tight">
          <Calendar className="h-5 w-5 text-primary" />
          <span>CalClone</span>
        </div>

        <nav className="flex flex-1 gap-1 overflow-x-auto p-3 md:flex-col">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t p-4">
          <div className="mb-3 space-y-0.5 text-xs">
            <p className="truncate font-medium text-foreground">
              {user.name ?? user.email}
            </p>
            <p className="truncate text-muted-foreground">/{user.username}</p>
            <p className="truncate text-muted-foreground">{user.timezone}</p>
          </div>
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </form>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
