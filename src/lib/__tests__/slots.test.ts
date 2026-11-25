import test from "node:test";
import assert from "node:assert/strict";
import { computeAvailableSlots } from "../slot-math.ts";

test("generates standard 30-min slots in host timezone and filters past slots", () => {
  const slots = computeAvailableSlots({
    dateString: "2026-12-01", // Tuesday
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities: [{ dayOfWeek: 2, startTime: "09:00", endTime: "11:00" }],
    dateOverrides: [],
    bookings: [],
    now: new Date("2026-12-01T09:15:00.000Z"),
  });

  assert.deepEqual(slots, [
    "2026-12-01T09:30:00.000Z",
    "2026-12-01T10:00:00.000Z",
    "2026-12-01T10:30:00.000Z",
  ]);
});

test("respects DateOverride isUnavailable = true and custom override hours", () => {
  const blocked = computeAvailableSlots({
    dateString: "2026-12-01",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    availabilities: [{ dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }],
    dateOverrides: [{ date: "2026-12-01", isUnavailable: true }],
    bookings: [],
    now: new Date("2026-11-25T00:00:00.000Z"),
  });
  assert.deepEqual(blocked, []);

  const customHours = computeAvailableSlots({
    dateString: "2026-12-06", // Sunday (normally no availability)
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 60,
    stepMinutes: 60,
    availabilities: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
    dateOverrides: [
      {
        date: "2026-12-06",
        isUnavailable: false,
        startTime: "10:00",
        endTime: "12:00",
      },
    ],
    bookings: [],
    now: new Date("2026-11-25T00:00:00.000Z"),
  });
  assert.deepEqual(customHours, [
    "2026-12-06T10:00:00.000Z",
    "2026-12-06T11:00:00.000Z",
  ]);
});

test("subtracts confirmed bookings expanded by bufferBefore and bufferAfter", () => {
  const slots = computeAvailableSlots({
    dateString: "2026-12-01",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 15,
    bufferBeforeMinutes: 15,
    bufferAfterMinutes: 15,
    availabilities: [{ dayOfWeek: 2, startTime: "09:00", endTime: "11:30" }],
    dateOverrides: [],
    bookings: [
      {
        startTime: new Date("2026-12-01T10:00:00.000Z"),
        endTime: new Date("2026-12-01T10:30:00.000Z"),
      },
    ],
    now: new Date("2026-11-25T00:00:00.000Z"),
  });

  assert.deepEqual(slots, [
    "2026-12-01T09:00:00.000Z",
    "2026-12-01T09:15:00.000Z",
    "2026-12-01T10:45:00.000Z",
    "2026-12-01T11:00:00.000Z",
  ]);
});

test("handles cross-date timezone conversion (host in Asia/Tokyo UTC+9, invitee in America/Los_Angeles UTC-8)", () => {
  const slots = computeAvailableSlots({
    dateString: "2026-12-01",
    inviteeTimezone: "America/Los_Angeles",
    hostTimezone: "Asia/Tokyo",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities: [{ dayOfWeek: 3, startTime: "09:00", endTime: "10:00" }],
    dateOverrides: [],
    bookings: [],
    now: new Date("2026-11-25T00:00:00.000Z"),
  });

  assert.deepEqual(slots, [
    "2026-12-02T00:00:00.000Z",
    "2026-12-02T00:30:00.000Z",
  ]);
});

test("handles US DST spring-forward gap without phantom 02:xx slots (2026-03-08 America/New_York)", () => {
  const slots = computeAvailableSlots({
    dateString: "2026-03-08",
    inviteeTimezone: "America/New_York",
    hostTimezone: "America/New_York",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities: [{ dayOfWeek: 0, startTime: "01:30", endTime: "03:30" }],
    dateOverrides: [],
    bookings: [],
    now: new Date("2026-03-01T00:00:00.000Z"),
  });

  assert.deepEqual(slots, [
    "2026-03-08T06:30:00.000Z", // 01:30 EST
    "2026-03-08T07:00:00.000Z", // 03:00 EDT
  ]);
});
