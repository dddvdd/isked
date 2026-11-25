import { z } from "zod";

export const customQuestionTypeSchema = z.enum([
  "text",
  "textarea",
  "select",
  "checkbox",
]);

export type CustomQuestionType = z.infer<typeof customQuestionTypeSchema>;

export const customQuestionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1, "Question label is required"),
  type: customQuestionTypeSchema,
  required: z.boolean().default(false),
  options: z.array(z.string().min(1)).optional(),
});

export type CustomQuestion = z.infer<typeof customQuestionSchema>;

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
    customQuestions: z.array(customQuestionSchema).default([]),
    postBookingBehavior: z
      .enum(["CONFIRMATION_PAGE", "REDIRECT"])
      .default("CONFIRMATION_PAGE"),
    redirectUrl: z.string().trim().optional().nullable(),
  })
  .superRefine((data, ctx) => {
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
          if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            ctx.addIssue({
              code: "custom",
              path: ["redirectUrl"],
              message: "Redirect URL must start with http:// or https://",
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

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

