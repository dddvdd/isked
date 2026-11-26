import { z } from "zod";

export const customQuestionTypeSchema = z.enum([
  "text",
  "textarea",
  "email",
  "phone",
  "select",
  "checkbox",
]);

export function parseOptionsText(raw: string): string[] {
  return raw
    .split(/[\r\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type CustomQuestionType = z.infer<typeof customQuestionTypeSchema>;

export const customQuestionSchema = z.object({
  id: z.string().min(1).max(100),
  label: z.string().trim().min(1, "Question label is required").max(300),
  type: customQuestionTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

export type CustomQuestion = z.infer<typeof customQuestionSchema>;

export const bookingWindowTypeSchema = z.enum([
  "UNLIMITED",
  "DATE_RANGE",
  "SPECIFIC_DATES",
]);

export type BookingWindowType = z.infer<typeof bookingWindowTypeSchema>;

export const slotLimitScopeSchema = z.enum(["NONE", "PER_EVENT", "PER_DAY"]);
export type SlotLimitScope = z.infer<typeof slotLimitScopeSchema>;

export const locationLevelSchema = z.enum([
  "NONE",
  "PROVINCE",
  "MUNICIPALITY",
  "BARANGAY",
]);
export type LocationLevel = z.infer<typeof locationLevelSchema>;

const psgcCodeRegex = /^\d{9,10}$/;

export const locationAllocationItemSchema = z.object({
  code: z.string().trim().regex(psgcCodeRegex, "Invalid PSGC code"),
  name: z.string().trim().min(1).max(120),
  slots: z.coerce.number().int().min(0).max(100000),
  provinceCode: z.string().trim().regex(psgcCodeRegex).optional(),
  provinceName: z.string().trim().max(120).optional(),
  municipalityCode: z.string().trim().regex(psgcCodeRegex).optional(),
  municipalityName: z.string().trim().max(120).optional(),
});

export type LocationAllocationItem = z.infer<
  typeof locationAllocationItemSchema
>;

export const locationDistributionSchema = z.object({
  level: locationLevelSchema.default("NONE"),
  allocations: z.array(locationAllocationItemSchema).max(2000).default([]),
});

export type LocationDistribution = z.infer<typeof locationDistributionSchema>;

const ymdRegex = /^\d{4}-\d{2}-\d{2}$/;

export const eventTypeInputSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    slug: z
      .string()
      .trim()
      .min(1, "Slug is required")
      .max(80)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug must contain only lowercase letters, numbers, and hyphens"
      ),
    description: z.string().max(5000).optional().nullable(),
    durationMinutes: z.coerce.number().int().min(5).max(720),
    bufferBeforeMinutes: z.coerce.number().int().min(0).max(240).default(0),
    bufferAfterMinutes: z.coerce.number().int().min(0).max(240).default(0),
    location: z.string().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
    showAdditionalNotes: z.boolean().default(true),
    customQuestions: z.array(customQuestionSchema).max(30).default([]),
    bookingWindowType: bookingWindowTypeSchema.default("UNLIMITED"),
    bookingStartDate: z.string().trim().max(20).optional().nullable(),
    bookingEndDate: z.string().trim().max(20).optional().nullable(),
    allowedDates: z.array(z.string().regex(ymdRegex)).max(366).default([]),
    slotLimitScope: slotLimitScopeSchema.default("NONE"),
    slotLimit: z.coerce.number().int().min(1).max(100000).optional().nullable(),
    locationDistribution: locationDistributionSchema.default({
      level: "NONE",
      allocations: [],
    }),
    postBookingBehavior: z
      .enum(["CONFIRMATION_PAGE", "REDIRECT"])
      .default("CONFIRMATION_PAGE"),
    redirectUrl: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.bookingWindowType === "DATE_RANGE") {
      if (!data.bookingStartDate || !ymdRegex.test(data.bookingStartDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["bookingStartDate"],
          message: "Start date is required for a booking date range",
        });
      }
      if (!data.bookingEndDate || !ymdRegex.test(data.bookingEndDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["bookingEndDate"],
          message: "End date is required for a booking date range",
        });
      }
      if (
        data.bookingStartDate &&
        data.bookingEndDate &&
        data.bookingStartDate > data.bookingEndDate
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["bookingEndDate"],
          message: "End date must be on or after start date",
        });
      }
    }

    if (data.bookingWindowType === "SPECIFIC_DATES") {
      if (data.allowedDates.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["allowedDates"],
          message: "Select at least one open booking date",
        });
      }
    }

    if (data.slotLimitScope !== "NONE") {
      if (!data.slotLimit || data.slotLimit < 1) {
        ctx.addIssue({
          code: "custom",
          path: ["slotLimit"],
          message: "Enter a slot limit of at least 1",
        });
      }
    }

    if (data.locationDistribution.level !== "NONE") {
      if (data.slotLimitScope === "NONE") {
        ctx.addIssue({
          code: "custom",
          path: ["slotLimitScope"],
          message:
            "Choose Every Event or Every Day when distributing slots by location",
        });
      }

      const activeAllocations = data.locationDistribution.allocations.filter(
        (a) => a.slots > 0
      );
      if (activeAllocations.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["locationDistribution", "allocations"],
          message:
            "Select at least one location and assign at least 1 slot to it",
        });
      }

      const totalAllocated = activeAllocations.reduce(
        (sum, item) => sum + item.slots,
        0
      );
      if (data.slotLimit && totalAllocated > data.slotLimit) {
        ctx.addIssue({
          code: "custom",
          path: ["slotLimit"],
          message: `Assigned location slots (${totalAllocated}) exceed the total slot limit (${data.slotLimit})`,
        });
      }
    }

    if (data.postBookingBehavior === "REDIRECT") {
      if (!data.redirectUrl) {
        ctx.addIssue({
          code: "custom",
          path: ["redirectUrl"],
          message: "Redirect URL is required when redirect behavior is enabled",
        });
      } else {
        try {
          const parsed = new URL(data.redirectUrl);
          const host = parsed.hostname.toLowerCase();
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            ctx.addIssue({
              code: "custom",
              path: ["redirectUrl"],
              message: "Redirect URL must start with http:// or https://",
            });
          } else if (
            host === "169.254.169.254" ||
            host === "metadata.google.internal"
          ) {
            ctx.addIssue({
              code: "custom",
              path: ["redirectUrl"],
              message: "Redirect URL cannot target internal metadata addresses",
            });
          }
        } catch {
          ctx.addIssue({
            code: "custom",
            path: ["redirectUrl"],
            message: "Please enter a valid URL (e.g., https://example.com/thanks)",
          });
        }
      }
    }

    data.customQuestions.forEach((q, idx) => {
      if (q.type === "select" && (!q.options || q.options.length === 0)) {
        ctx.addIssue({
          code: "custom",
          path: ["customQuestions", idx, "options"],
          message: "Select questions require at least one option",
        });
      }
    });
  });

export type EventTypeInput = z.infer<typeof eventTypeInputSchema>;

export function parseCustomQuestions(raw: unknown): CustomQuestion[] {
  const parsed = z.array(customQuestionSchema).safeParse(raw);
  return parsed.success ? parsed.data : [];
}

export function parseAllowedDates(raw: unknown): string[] {
  const parsed = z.array(z.string().regex(ymdRegex)).safeParse(raw);
  return parsed.success ? Array.from(new Set(parsed.data)).sort() : [];
}

export function parseLocationDistribution(raw: unknown): LocationDistribution {
  const parsed = locationDistributionSchema.safeParse(raw);
  if (!parsed.success || parsed.data.level === "NONE") {
    return { level: "NONE", allocations: [] };
  }
  const deduped = new Map<string, LocationAllocationItem>();
  for (const item of parsed.data.allocations) {
    if (item.slots > 0) {
      deduped.set(item.code, item);
    }
  }
  return {
    level: parsed.data.level,
    allocations: Array.from(deduped.values()),
  };
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
