import "server-only";
import { z } from "zod";

/** Local Zod mirrors of the provider candidate shapes (server-side only). */
export const sceneCandidateSchema = z.object({
  ordinal: z.number().int().positive(),
  title: z.string().min(1),
  body: z.string().min(1),
  illustrationPrompt: z.string().min(1),
});

export const storyCandidateSchema = z.object({
  title: z.string().min(1),
  scenes: z.array(sceneCandidateSchema).min(1),
});

export const moderationSchema = z.object({
  safe: z.boolean(),
  reason: z.string().nullable().optional(),
});
