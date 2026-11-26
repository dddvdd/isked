import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, Loader2, MapPin } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MascotWalkway } from "@/components/landing/MascotWalkway";
import { SiteFooter } from "@/components/landing/SiteFooter";

async function HostPublicProfileContent({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  const host = await prisma.user.findUnique({
    where: { username },
    include: {
      eventTypes: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!host) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">
          {host.name ?? `@${host.username}`}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Select an event below to schedule a time.
        </p>
      </div>

      {host.eventTypes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No public event types are currently active.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {host.eventTypes.map((et) => (
            <Link key={et.id} href={`/${host.username}/${et.slug}`}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <CardTitle className="text-base">{et.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {et.durationMinutes} min
                    </span>
                    {et.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {et.location}
                      </span>
                    )}
                  </div>
                  {et.description && (
                    <p className="line-clamp-2">{et.description}</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HostPublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="flex-1 px-4 pt-14 pb-6">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <HostPublicProfileContent params={params} />
        </Suspense>
      </main>

      <MascotWalkway />
      <SiteFooter />
    </div>
  );
}
