import { z } from "zod";
import { NUMBER_MAX, NUMBER_MIN } from "@/services/draw";
import { latestAllowedPlayDate } from "@/services/score-rules";

/**
 * Every request boundary parses through one of these. Nothing reaches a service
 * as an unvalidated shape.
 *
 * Note what is absent: no schema accepts a user_id. Identity always comes from
 * the session, never from the request.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

export const scoreInputSchema = z.object({
  value: z
    .number()
    .int("Stableford score must be a whole number")
    .min(NUMBER_MIN, `Score must be at least ${NUMBER_MIN}`)
    .max(NUMBER_MAX, `Score cannot exceed ${NUMBER_MAX}`),
  // ISO dates compare correctly as strings; see latestAllowedPlayDate for why
  // the limit is a day beyond today.
  playedOn: isoDate.refine(
    (value) => value <= latestAllowedPlayDate(),
    "You cannot record a round that has not been played yet",
  ),
});

export const scoreUpdateSchema = scoreInputSchema
  .partial()
  .refine((patch) => patch.value !== undefined || patch.playedOn !== undefined, {
    message: "Nothing to update",
  });

export const scoreIdSchema = z.string().uuid("That score could not be found");

export const charitySelectionSchema = z.object({
  charityId: z.string().uuid(),
  charityPercent: z
    .number()
    .int("Contribution percentage must be a whole number")
    .min(0)
    .max(100),
});

export const checkoutSchema = z.object({
  planCode: z.enum(["monthly", "yearly"]),
});

export const donationSchema = z.object({
  charityId: z.string().uuid("Please choose a charity"),
  amountCents: z
    .number()
    .int("Donation must be a whole number of pence")
    .min(100, "The minimum donation is £1")
    .max(1_000_000, "For gifts over £10,000 please contact the charity directly"),
});

export const drawSimulateSchema = z.object({
  periodMonth: isoDate,
  mode: z.enum(["random", "algorithmic"]),
});

export const drawPublishSchema = z.object({
  drawId: z.string().uuid(),
});

export const winnerReviewSchema = z.object({
  winnerId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(500).optional(),
});

export const winnerPayoutSchema = z.object({
  winnerId: z.string().uuid(),
});

export const charityUpsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  slug: z
    .string()
    .min(2)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "Slug may contain lowercase letters, numbers and hyphens"),
  tagline: z.string().max(200).optional().nullable(),
  description: z.string().max(5000).default(""),
  mission: z.string().max(5000).optional().nullable(),
  category: z.string().min(2).max(60).default("General"),
  logoUrl: z.string().url().optional().nullable(),
  heroImageUrl: z.string().url().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

// PRD section 08.1: a charity is chosen at signup, not bolted on afterwards.
export const signUpSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  fullName: z.string().trim().min(2, "Please enter your name").max(120),
  charityId: z.string().uuid("Please choose a charity to support"),
  charityPercent: z.number().int(),
});

export const signInSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export type ScoreInput = z.infer<typeof scoreInputSchema>;
export type CharitySelection = z.infer<typeof charitySelectionSchema>;
export type DrawSimulateInput = z.infer<typeof drawSimulateSchema>;
export type CharityUpsert = z.infer<typeof charityUpsertSchema>;
