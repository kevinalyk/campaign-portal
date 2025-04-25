import { z } from "zod"

export const organizationSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required")
    .max(100, "Organization name must be less than 100 characters")
    .refine((name) => !/[<>{}[\]\\/]/.test(name), "Organization name contains invalid characters"),
  url: z
    .string()
    .min(1, "URL is required")
    .max(50, "URL must be less than 50 characters")
    .regex(/^[a-z0-9-]+$/, "URL can only contain lowercase letters, numbers, and hyphens"),
  donationUrl: z
    .string()
    .min(1, "WinRed Donation URL is required")
    .regex(/^https?:\/\//, "WinRed Donation URL must start with http:// or https://")
    .refine((url) => !/[<>{}[\]\\]/.test(url), "WinRed Donation URL contains invalid characters"),
  websiteUrl: z
    .string()
    .min(1, "Website URL is required")
    .regex(/^https?:\/\//, "Website URL must start with http:// or https://")
    .refine((url) => !/[<>{}[\]\\]/.test(url), "Website URL contains invalid characters"),
  description: z
    .string()
    .min(1, "Description is required")
    .max(1000, "Description must be less than 1000 characters")
    .refine((desc) => !/[<>]/.test(desc), "Description contains invalid characters"),
  logoUrl: z
    .string()
    .max(255, "Logo URL must be less than 255 characters")
    .regex(/^$|^https?:\/\//, "Logo URL must start with http:// or https://")
    .refine((url) => !/[<>{}[\]\\]/.test(url), "Logo URL contains invalid characters")
    .optional(),
  assistantIdentity: z
    .string()
    .max(100, "AI Assistant Identity must be less than 100 characters")
    .refine((identity) => !/[<>{}[\]\\]/.test(identity), "AI Assistant Identity contains invalid characters")
    .optional(),
  chatColor: z.string().optional(),
  chatWelcomeMessage: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  contactAddress: z.string().optional(),
})

export type OrganizationFormValues = z.infer<typeof organizationSchema>
