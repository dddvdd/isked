import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  BarChart3,
  Calendar,
  CalendarClock,
  Clock,
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

async function DashboardUserFooter() {
  await connection();
  const user = await requireCurrentUser();

  return (
    <>
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
    </>
  );
}

function DashboardUserFooterFallback() {
  return (
    <div className="space-y-2">
      <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
      <div className="h-3 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-8 w-full animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="flex w-full flex-col border-b bg-sidebar text-sidebar-foreground md:w-64 md:border-r md:border-b-0">
        <div className="flex h-14 items-center gap-2 border-b px-5 font-semibold tracking-tight">
          <Calendar className="h-5 w-5 text-primary" />
          <span className="font-brand">Isked</span>
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
          <Suspense fallback={<DashboardUserFooterFallback />}>
            <DashboardUserFooter />
          </Suspense>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8">{children}</main>
    </div>
  );
}
