import { Resend } from "resend";
import { createEvent, type DateArray } from "ics";
import { escapeHtml } from "@/lib/security";

export interface BookingEmailPayload {
  uid: string;
  eventTitle: string;
  eventDescription?: string | null;
  location?: string | null;
  hostName: string;
  hostEmail: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: Date;
  endTime: Date;
}

function toUtcDateArray(d: Date): DateArray {
  return [
    d.getUTCFullYear(),
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
  ];
}

export function generateBookingIcs(
  payload: Omit<BookingEmailPayload, "hostEmail" | "inviteeEmail"> & {
    organizerEmail?: string;
  }
): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cancelUrl = `${appUrl}/booking/${encodeURIComponent(payload.uid)}/cancel`;

  const descriptionLines = [
    payload.eventDescription ?? "",
    "",
    `Manage or cancel this booking: ${cancelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const safeOrganizerEmail =
    payload.organizerEmail ??
    process.env.PUBLIC_ORGANIZER_EMAIL ??
    "noreply@isked.local";

  const { error, value } = createEvent({
    uid: `${payload.uid}@isked.local`,
    start: toUtcDateArray(payload.startTime),
    startInputType: "utc",
    startOutputType: "utc",
    end: toUtcDateArray(payload.endTime),
    endInputType: "utc",
    endOutputType: "utc",
    title: `${payload.eventTitle} (${payload.hostName} & ${payload.inviteeName})`,
    description: descriptionLines,
    location: payload.location ?? "Scheduled Appointment",
    status: "CONFIRMED",
    busyStatus: "BUSY",
    organizer: {
      name: payload.hostName,
      email: safeOrganizerEmail,
    },
  });

  if (error || !value) {
    throw error ?? new Error("Failed to generate .ics file");
  }

  return value;
}

export function buildGoogleCalendarUrl(payload: {
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: Date;
  endTime: Date;
}): string {
  const fmt = (d: Date) =>
    d
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}Z$/, "Z");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: payload.title,
    dates: `${fmt(payload.startTime)}/${fmt(payload.endTime)}`,
  });

  if (payload.description) params.set("details", payload.description);
  if (payload.location) params.set("location", payload.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function sanitizeEmailSubject(raw: string): string {
  return raw.replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

function formatInTimezone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone,
    }).format(date);
  } catch {
    return date.toUTCString();
  }
}

export async function sendBookingConfirmationEmail(
  payload: BookingEmailPayload
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return;
  }

  const resend = new Resend(apiKey);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const safeUid = encodeURIComponent(payload.uid);
  const cancelUrl = `${appUrl}/booking/${safeUid}/cancel`;
  const confirmUrl = `${appUrl}/booking/${safeUid}/confirmed`;
  const icsContent = generateBookingIcs(payload);

  const safeInviteeName = escapeHtml(payload.inviteeName);
  const safeInviteeEmail = escapeHtml(payload.inviteeEmail);
  const safeHostName = escapeHtml(payload.hostName);
  const safeEventTitle = escapeHtml(payload.eventTitle);
  const safeLocation = payload.location ? escapeHtml(payload.location) : null;
  const safeTimezone = escapeHtml(payload.inviteeTimezone);
  const formattedStart = escapeHtml(
    formatInTimezone(payload.startTime, payload.inviteeTimezone)
  );

  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Isked <onboarding@resend.dev>";

  const attachment = [
    {
      filename: "invite.ics",
      content: Buffer.from(icsContent, "utf-8"),
    },
  ];

  // Send separate emails so the host's personal login email is never exposed to public invitees
  await Promise.allSettled([
    resend.emails.send({
      from: fromAddress,
      to: [payload.inviteeEmail],
      subject: sanitizeEmailSubject(
        `Confirmed: ${payload.eventTitle} with ${payload.hostName}`
      ),
      html: `
        <div style="font-family: Verdana, Geneva, sans-serif; line-height: 1.6; color: #2b1e17; background: #faf7f2; padding: 24px; max-width: 560px; border-radius: 10px;">
          <h2 style="margin-bottom: 8px; color: #0e9aa7;">Your booking is confirmed</h2>
          <p>Hi ${safeInviteeName},</p>
          <p>Your <strong>${safeEventTitle}</strong> with <strong>${safeHostName}</strong> has been scheduled.</p>
          <div style="background: #f2ece2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e3d9ca;">
            <p style="margin: 0 0 6px;"><strong>When:</strong> ${formattedStart} (${safeTimezone})</p>
            ${safeLocation ? `<p style="margin: 0;"><strong>Where:</strong> ${safeLocation}</p>` : ""}
          </div>
          <p>
            <a href="${confirmUrl}" style="color: #0e9aa7;">View booking details</a> ·
            <a href="${cancelUrl}" style="color: #0e9aa7;">Cancel meeting</a>
          </p>
        </div>
      `,
      attachments: attachment,
    }),
    resend.emails.send({
      from: fromAddress,
      to: [payload.hostEmail],
      subject: sanitizeEmailSubject(
        `New Booking: ${payload.eventTitle} — ${payload.inviteeName}`
      ),
      html: `
        <div style="font-family: Verdana, Geneva, sans-serif; line-height: 1.6; color: #2b1e17; background: #faf7f2; padding: 24px; max-width: 560px; border-radius: 10px;">
          <h2 style="margin-bottom: 8px; color: #0e9aa7;">New booking received</h2>
          <p><strong>${safeInviteeName}</strong> (${safeInviteeEmail}) booked <strong>${safeEventTitle}</strong>.</p>
          <div style="background: #f2ece2; padding: 16px; border-radius: 8px; margin: 16px 0; border: 1px solid #e3d9ca;">
            <p style="margin: 0 0 6px;"><strong>When:</strong> ${formattedStart} (${safeTimezone})</p>
            ${safeLocation ? `<p style="margin: 0;"><strong>Where:</strong> ${safeLocation}</p>` : ""}
          </div>
        </div>
      `,
      attachments: attachment,
    }),
  ]);
}

export async function sendBookingCancellationEmail(params: {
  eventTitle: string;
  hostName: string;
  hostEmail: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startTime: Date;
  reason?: string | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return;
  }

  const resend = new Resend(apiKey);
  const rawFormattedStart = formatInTimezone(
    params.startTime,
    params.inviteeTimezone
  );
  const formattedStart = escapeHtml(rawFormattedStart);
  const safeEventTitle = escapeHtml(params.eventTitle);
  const safeHostName = escapeHtml(params.hostName);
  const safeInviteeName = escapeHtml(params.inviteeName);
  const safeTimezone = escapeHtml(params.inviteeTimezone);
  const safeReason = params.reason ? escapeHtml(params.reason) : null;

  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "Isked <onboarding@resend.dev>";

  const htmlBody = `
    <div style="font-family: Verdana, Geneva, sans-serif; line-height: 1.6; color: #2b1e17; background: #faf7f2; padding: 24px; max-width: 560px; border-radius: 10px;">
      <h2 style="color: #2b1e17;">Meeting Cancelled</h2>
      <p>The scheduled <strong>${safeEventTitle}</strong> between <strong>${safeHostName}</strong> and <strong>${safeInviteeName}</strong> on ${formattedStart} (${safeTimezone}) has been cancelled.</p>
      ${safeReason ? `<p><strong>Reason:</strong> ${safeReason}</p>` : ""}
    </div>
  `;

  await Promise.allSettled([
    resend.emails.send({
      from: fromAddress,
      to: [params.inviteeEmail],
      subject: sanitizeEmailSubject(
        `Cancelled: ${params.eventTitle} (${rawFormattedStart})`
      ),
      html: htmlBody,
    }),
    resend.emails.send({
      from: fromAddress,
      to: [params.hostEmail],
      subject: sanitizeEmailSubject(
        `Cancelled: ${params.eventTitle} — ${params.inviteeName}`
      ),
      html: htmlBody,
    }),
  ]);
}
