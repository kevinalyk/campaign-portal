import * as z from "zod"

// Helper function to check for common XSS patterns
const containsXSSPatterns = (value: string): boolean => {
  // Convert to lowercase for case-insensitive matching
  const lowerValue = value.toLowerCase()

  // Check for JavaScript protocol
  if (lowerValue.includes("javascript:")) return true

  // Check for HTML tags and event handlers
  if (/<[a-z][\s\S]*>/i.test(value)) return true
  if (/on\w+\s*=/i.test(value)) return true

  // Check for HTML encoded characters that might be used for XSS
  if (/&[#\w]+;/i.test(value)) return true

  return false
}

export const documentSchema = z.object({
  name: z
    .string()
    .min(1, "Document name is required")
    .max(100, "Document name must be less than 100 characters")
    .refine((value) => !containsXSSPatterns(value), {
      message: "Document name contains potentially unsafe content",
    }),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .refine((value) => !value || !containsXSSPatterns(value), {
      message: "Description contains potentially unsafe content",
    })
    .optional(),
})

export type DocumentFormValues = z.infer<typeof documentSchema>
