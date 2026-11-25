import { Resend } from "resend";
import { createEvent, type DateArray } from "ics";

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

export function generateBookingIcs(payload: BookingEmailPayload): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cancelUrl = `${appUrl}/booking/${payload.uid}/cancel`;

  const descriptionLines = [
    payload.eventDescription ?? "",
    "",
    `Manage or cancel this booking: ${cancelUrl}`,
  ]
    .filter(Boolean)
    .join("\n");

  const { error, value } = createEvent({
    uid: `${payload.uid}@calclone.local`,
    start: toUtcDateArray(payload.startTime),
    startInputType: "utc",
    startOutputType: "utc",
    end: toUtcDateArray(payload.endTime),
    endInputType: "utc",
    endOutputType: "utc",
    title: `${payload.eventTitle} (${payload.hostName} & ${payload.inviteeName})`,
    description: descriptionLines,
    location: payload.location ?? "Online Meeting",
    status: "CONFIRMED",
    busyStatus: "BUSY",
    organizer: {
      name: payload.hostName,
      email: payload.hostEmail,
    },
    attendees: [
      {
        name: payload.inviteeName,
        email: payload.inviteeEmail,
        rsvp: true,
        partstat: "ACCEPTED",
        role: "REQ-PARTICIPANT",
      },
    ],
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
  const cancelUrl = `${appUrl}/booking/${payload.uid}/cancel`;
  const confirmUrl = `${appUrl}/booking/${payload.uid}/confirmed`;
  const icsContent = generateBookingIcs(payload);
  const formattedStart = formatInTimezone(
    payload.startTime,
    payload.inviteeTimezone
  );

  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "CalClone <onboarding@resend.dev>";

  await resend.emails.send({
    from: fromAddress,
    to: [payload.inviteeEmail],
    cc: [payload.hostEmail],
    subject: `Confirmed: ${payload.eventTitle} with ${payload.hostName}`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #18181b; max-width: 560px;">
        <h2 style="margin-bottom: 8px;">Your meeting is confirmed</h2>
        <p>Hi ${payload.inviteeName},</p>
        <p>Your <strong>${payload.eventTitle}</strong> with <strong>${payload.hostName}</strong> has been scheduled.</p>
        <div style="background: #f4f4f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 0 0 6px;"><strong>When:</strong> ${formattedStart} (${payload.inviteeTimezone})</p>
          ${payload.location ? `<p style="margin: 0;"><strong>Where:</strong> ${payload.location}</p>` : ""}
        </div>
        <p>
          <a href="${confirmUrl}">View booking details</a> ·
          <a href="${cancelUrl}">Cancel meeting</a>
        </p>
      </div>
    `,
    attachments: [
      {
        filename: "invite.ics",
        content: Buffer.from(icsContent, "utf-8"),
      },
    ],
  });
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
  const formattedStart = formatInTimezone(
    params.startTime,
    params.inviteeTimezone
  );
  const fromAddress =
    process.env.RESEND_FROM_EMAIL ?? "CalClone <onboarding@resend.dev>";

  await resend.emails.send({
    from: fromAddress,
    to: [params.inviteeEmail, params.hostEmail],
    subject: `Cancelled: ${params.eventTitle} (${formattedStart})`,
    html: `
      <div style="font-family: sans-serif; line-height: 1.6; color: #18181b; max-width: 560px;">
        <h2>Meeting Cancelled</h2>
        <p>The scheduled <strong>${params.eventTitle}</strong> between <strong>${params.hostName}</strong> and <strong>${params.inviteeName}</strong> on ${formattedStart} (${params.inviteeTimezone}) has been cancelled.</p>
        ${params.reason ? `<p><strong>Reason:</strong> ${params.reason}</p>` : ""}
      </div>
    `,
  });
}

