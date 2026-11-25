import { z } from "zod"

export const createWordSchema = z.object({
  english: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "English and Vietnamese are required.",
    }),
  vietnamese: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "English and Vietnamese are required.",
    }),
  example: z
    .string()
    .default("")
    .transform((val) => val.trim()),
})

export const updateWordSchema = z.object({
  id: z.string().min(1, { message: "Vietnamese is required." }),
  vietnamese: z
    .string()
    .transform((val) => val.trim())
    .refine((val) => val.length > 0, {
      message: "Vietnamese is required.",
    }),
  example: z
    .string()
    .default("")
    .transform((val) => val.trim()),
})

export const fetchMoreWordsSchema = z.object({
  limit: z.number().int().positive().max(100),
  cursor: z.string().optional(),
})

export type CreateWordInput = z.infer<typeof createWordSchema>
export type UpdateWordInput = z.infer<typeof updateWordSchema>
export type FetchMoreWordsInput = z.infer<typeof fetchMoreWordsSchema>
