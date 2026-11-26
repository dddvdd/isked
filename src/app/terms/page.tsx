import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Terms of Use — Isked",
  description: "Terms of Use and service disclaimer for Isked.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Isked
          </Link>
          <span className="font-brand text-lg font-bold text-primary">
            Isked
          </span>
        </div>

        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <FileText className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                User Agreement
              </span>
            </div>
            <CardTitle className="text-2xl">Terms of Use</CardTitle>
            <p className="text-xs text-muted-foreground">
              Effective Date: November 2026
            </p>
          </CardHeader>

          <CardContent className="space-y-5 text-sm leading-relaxed text-foreground">
            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                1. Acceptance of Terms
              </h2>
              <p className="text-muted-foreground">
                By creating an account or booking an appointment through{" "}
                <strong>Isked</strong>, you agree to these Terms of Use and our{" "}
                <Link
                  href="/privacy"
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Data Privacy Notice
                </Link>
                .
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                2. Proper Use &amp; Accurate Information
              </h2>
              <p className="text-muted-foreground">
                You agree to provide truthful, accurate information when
                scheduling appointments and not to impersonate any person, submit
                fraudulent or automated spam bookings, or interfere with the
                availability of slots for other users.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                3. Host Responsibilities
              </h2>
              <p className="text-muted-foreground">
                Event hosts are solely responsible for the accuracy of their
                event descriptions, external redirect links, custom questions,
                and compliance with applicable data protection laws when
                handling invitee information collected through their events.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                4. Service Availability &amp; Limitation of Liability
              </h2>
              <p className="text-muted-foreground">
                Isked is provided on an &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo; basis without warranties of any kind, express
                or implied. To the fullest extent permitted by applicable law,
                Isked and its operators shall not be liable for missed
                appointments, third-party redirect destinations, email delivery
                delays, or indirect, incidental, or consequential damages
                arising from your use of the service.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
