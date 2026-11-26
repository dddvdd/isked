import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data Privacy Notice — Isked",
  description:
    "Data Privacy Notice aligned with the Philippine Data Privacy Act of 2012 (RA 10173).",
};

export default function PrivacyPage() {
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
              <ShieldCheck className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wide">
                Republic Act No. 10173 Compliance
              </span>
            </div>
            <CardTitle className="text-2xl">Data Privacy Notice</CardTitle>
            <p className="text-xs text-muted-foreground">
              Effective Date: November 2026
            </p>
          </CardHeader>

          <CardContent className="space-y-5 text-sm leading-relaxed text-foreground">
            <p>
              <strong>Isked</strong> respects and protects your fundamental right
              to privacy in accordance with the{" "}
              <strong>
                Philippine Data Privacy Act of 2012 (Republic Act No. 10173)
              </strong>
              , its Implementing Rules and Regulations (IRR), and issuances of
              the National Privacy Commission (NPC).
            </p>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                1. Personal Information We Collect
              </h2>
              <p className="text-muted-foreground">
                When you schedule an appointment or create a host account on
                Isked, we collect only the personal data necessary to facilitate
                your booking:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <strong>Identity Details:</strong> First Name, Middle Name
                  (optional), Last Name, and Suffix (optional).
                </li>
                <li>
                  <strong>Contact Information:</strong> Email address and, when
                  requested by an event host, your contact phone number.
                </li>
                <li>
                  <strong>Geographic Address (PSGC):</strong> Province,
                  Municipality / City, and Barangay based on the Philippine
                  Standard Geographic Code.
                </li>
                <li>
                  <strong>Event-Specific Responses:</strong> Optional notes and
                  answers to custom questions configured by the host for your
                  appointment.
                </li>
              </ul>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                2. Purpose &amp; Lawful Basis of Processing
              </h2>
              <p className="text-muted-foreground">
                Your personal information is processed strictly with your
                explicit, informed consent to:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>Schedule, confirm, manage, or cancel appointments;</li>
                <li>
                  Send automated booking confirmations, calendar invitations
                  (<code>.ics</code>), and cancellation notices; and
                </li>
                <li>
                  Allow the designated event host to prepare for and conduct
                  your scheduled appointment.
                </li>
              </ul>
              <p className="text-muted-foreground">
                We <strong>never sell, rent, or trade</strong> your personal
                information to advertisers or unauthorized third parties.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                3. Data Sharing &amp; Security Measures
              </h2>
              <p className="text-muted-foreground">
                Your booking details are accessible only to the specific host
                with whom you scheduled an appointment. Data is stored in
                encrypted cloud databases (Supabase PostgreSQL) and transmitted
                exclusively over TLS/HTTPS, protected by cryptographically
                random booking tokens, email-verified cancellation checks, and
                rate-limiting controls.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                4. Data Retention
              </h2>
              <p className="text-muted-foreground">
                Appointment records are retained only for as long as necessary
                to fulfill the scheduled service, maintain accurate operational
                records for the host, or comply with applicable legal
                obligations, after which they may be deleted by the host.
              </p>
            </section>

            <section className="space-y-1.5">
              <h2 className="text-base font-semibold">
                5. Your Rights as a Data Subject (RA 10173)
              </h2>
              <p className="text-muted-foreground">
                Under the Data Privacy Act of 2012, you have the right to:
              </p>
              <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  <strong>Be Informed</strong> of how your personal data is
                  collected and processed;
                </li>
                <li>
                  <strong>Access &amp; Rectify</strong> inaccurate or incomplete
                  personal data held by your appointment host;
                </li>
                <li>
                  <strong>Withdraw Consent / Cancel</strong> your booking at any
                  time using your confirmation link;
                </li>
                <li>
                  <strong>Erasure or Blocking</strong> of personal data when no
                  longer necessary for the declared purpose; and
                </li>
                <li>
                  <strong>Lodge a Complaint</strong> with the National Privacy
                  Commission (NPC) if you believe your data privacy rights have
                  been violated.
                </li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
