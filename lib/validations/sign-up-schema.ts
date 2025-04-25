import { z } from "zod"

export const signUpSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .regex(/^[a-zA-Z\s\-']+$/, "First name can only contain letters, spaces, hyphens, and apostrophes"),

  lastName: z
    .string()
    .min(1, "Last name is required")
    .max(50, "Last name must be less than 50 characters")
    .regex(/^[a-zA-Z\s\-']+$/, "Last name can only contain letters, spaces, hyphens, and apostrophes"),

  email: z
    .string()
    .min(1, "Email is required")
    .max(100, "Email must be less than 100 characters")
    .email("Please enter a valid email address"),

  campaign: z
    .string()
    .max(100, "Campaign name must be less than 100 characters")
    // Stricter regex that explicitly disallows semicolons and other SQL injection characters
    .regex(/^[a-zA-Z0-9\s\-_'.()]*$/, "Campaign name contains invalid characters")
    .optional()
    .or(z.literal("")), // Allow empty string explicitly

  terms: z.boolean().optional(),
})

export type SignUpFormData = z.infer<typeof signUpSchema>
