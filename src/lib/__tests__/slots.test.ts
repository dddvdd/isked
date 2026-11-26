import test from "node:test";
import assert from "node:assert/strict";
import { computeAvailableSlots, computeQuotaRemaining } from "../slot-math.ts";

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

test("enforces DATE_RANGE and SPECIFIC_DATES booking windows", () => {
  const availabilities = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
    dayOfWeek,
    startTime: "09:00",
    endTime: "10:00",
  }));
  const now = new Date("2026-11-25T00:00:00.000Z");

  // Inside DATE_RANGE (Dec 2..Dec 4)
  const insideRange = computeAvailableSlots({
    dateString: "2026-12-03",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities,
    dateOverrides: [],
    bookings: [],
    bookingWindow: {
      type: "DATE_RANGE",
      startDate: "2026-12-02",
      endDate: "2026-12-04",
    },
    now,
  });
  assert.deepEqual(insideRange, [
    "2026-12-03T09:00:00.000Z",
    "2026-12-03T09:30:00.000Z",
  ]);

  // Outside DATE_RANGE
  const outsideRange = computeAvailableSlots({
    dateString: "2026-12-07",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities,
    dateOverrides: [],
    bookings: [],
    bookingWindow: {
      type: "DATE_RANGE",
      startDate: "2026-12-02",
      endDate: "2026-12-04",
    },
    now,
  });
  assert.deepEqual(outsideRange, []);

  // SPECIFIC_DATES allows listed dates and blocks unlisted dates
  const allowedSpecific = computeAvailableSlots({
    dateString: "2026-12-08",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 60,
    stepMinutes: 60,
    availabilities,
    dateOverrides: [],
    bookings: [],
    bookingWindow: {
      type: "SPECIFIC_DATES",
      allowedDates: ["2026-12-08", "2026-12-10"],
    },
    now,
  });
  assert.deepEqual(allowedSpecific, ["2026-12-08T09:00:00.000Z"]);

  const disallowedSpecific = computeAvailableSlots({
    dateString: "2026-12-09",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 60,
    stepMinutes: 60,
    availabilities,
    dateOverrides: [],
    bookings: [],
    bookingWindow: {
      type: "SPECIFIC_DATES",
      allowedDates: ["2026-12-08", "2026-12-10"],
    },
    now,
  });
  assert.deepEqual(disallowedSpecific, []);
});

test("supports PER_EVENT and PER_DAY multi-client quotas and PSGC barangay distribution", () => {
  const availabilities = [
    { dayOfWeek: 2, startTime: "09:00", endTime: "10:00" }, // Tue Dec 1
    { dayOfWeek: 3, startTime: "09:00", endTime: "10:00" }, // Wed Dec 2
  ];
  const now = new Date("2026-11-25T00:00:00.000Z");

  const existingTueBooking = {
    startTime: new Date("2026-12-01T09:00:00.000Z"),
    endTime: new Date("2026-12-01T09:30:00.000Z"),
    formResponses: {
      address: {
        provinceCode: "043400000",
        municipalityCode: "043405000",
        barangayCode: "043405001",
      },
    },
  };

  // PER_EVENT with slotLimit = 2 keeps 09:00 open even with 1 existing booking at 09:00
  const openEventSlots = computeAvailableSlots({
    dateString: "2026-12-01",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities,
    dateOverrides: [],
    bookings: [existingTueBooking],
    slotQuota: { scope: "PER_EVENT", slotLimit: 2, locationLevel: "NONE" },
    quotaBookings: [existingTueBooking],
    now,
  });
  assert.deepEqual(openEventSlots, [
    "2026-12-01T09:00:00.000Z",
    "2026-12-01T09:30:00.000Z",
  ]);

  // PER_DAY with slotLimit = 1 closes Dec 1 (1 booking) while keeping Dec 2 open
  const fullDaySlots = computeAvailableSlots({
    dateString: "2026-12-01",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities,
    dateOverrides: [],
    bookings: [],
    slotQuota: { scope: "PER_DAY", slotLimit: 1, locationLevel: "NONE" },
    quotaBookings: [existingTueBooking],
    now,
  });
  assert.deepEqual(fullDaySlots, []);

  const nextDayOpenSlots = computeAvailableSlots({
    dateString: "2026-12-02",
    inviteeTimezone: "UTC",
    hostTimezone: "UTC",
    durationMinutes: 30,
    stepMinutes: 30,
    availabilities,
    dateOverrides: [],
    bookings: [],
    slotQuota: { scope: "PER_DAY", slotLimit: 1, locationLevel: "NONE" },
    quotaBookings: [existingTueBooking],
    now,
  });
  assert.deepEqual(nextDayOpenSlots, [
    "2026-12-02T09:00:00.000Z",
    "2026-12-02T09:30:00.000Z",
  ]);

  // PSGC BARANGAY distribution tracks remaining per barangay and overall
  const quotaCheck = computeQuotaRemaining({
    slotQuota: {
      scope: "PER_EVENT",
      slotLimit: 5,
      locationLevel: "BARANGAY",
      allocations: [
        { code: "043405001", name: "Barangay 1", slots: 1 },
        { code: "043405002", name: "Barangay 2", slots: 3 },
      ],
    },
    scopedBookings: [existingTueBooking],
  });
  assert.equal(quotaCheck.remainingByCode.get("043405001"), 0);
  assert.equal(quotaCheck.remainingByCode.get("043405002"), 3);
  assert.equal(quotaCheck.remainingTotal, 3);
});
