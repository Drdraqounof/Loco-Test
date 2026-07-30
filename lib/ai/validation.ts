import { z } from "zod";

// In plain terms: never trust LLM JSON — validate before acting on it.

export const PipelineReviewSchema = z.object({
  approved: z.boolean(),
  matchesUserRequest: z.boolean(),
  worksLikely: z.boolean(),
  updatedUserQuery: z.string().min(1),
  reviewerNotes: z.string().min(1),
  fixes: z.array(z.string()),
});

export const CalendarDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  startIso: z.string().datetime({ offset: true }).or(z.string().min(1)),
  endIso: z.string().datetime({ offset: true }).or(z.string().min(1)),
  timeZone: z.string().min(1),
});

export const MemoryFactSchema = z.object({
  content: z.string().min(1).max(2000),
  kind: z.enum(["explicit", "implicit", "fact"]).default("fact"),
});

export const PlanetTourStepSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("flyTo"),
    locationQuery: z.string().optional(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
    height: z.number().optional(),
    durationMs: z.number().optional(),
    heading: z.number().optional(),
    pitch: z.number().optional(),
    roll: z.number().optional(),
  }),
  z.object({
    type: z.literal("orbit"),
    durationMs: z.number().optional(),
  }),
  z.object({
    type: z.literal("narrate"),
    text: z.string().optional(),
    durationMs: z.number().optional(),
  }),
  z.object({
    type: z.literal("pause"),
    durationMs: z.number().optional(),
  }),
]);

export const PlanetTourSchema = z.object({
  mode: z.literal("planet"),
  title: z.string().min(1),
  fullscreen: z.boolean().optional(),
  autoRotate: z.boolean().optional(),
  steps: z.array(PlanetTourStepSchema).min(1),
});

export type ValidationOutcome<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; issues: string[] };

export function validateWithSchema<T>(schema: z.ZodType<T>, value: unknown): ValidationOutcome<T> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { ok: true, data: result.data };
  }

  return {
    ok: false,
    error: "Validation failed",
    issues: result.error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`),
  };
}

export function parseJsonAndValidate<T>(schema: z.ZodType<T>, raw: string): ValidationOutcome<T> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return validateWithSchema(schema, parsed);
  } catch {
    return {
      ok: false,
      error: "Invalid JSON",
      issues: ["Response was not valid JSON"],
    };
  }
}
