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

// URL validation schema
export const websiteUrlSchema = z.object({
  url: z
    .string()
    .min(1, "Website URL is required")
    .url("Please enter a valid URL")
    .refine((value) => !containsXSSPatterns(value), {
      message: "URL contains potentially unsafe content",
    })
    .refine(
      (value) => {
        try {
          const url = new URL(value)
          return url.protocol === "http:" || url.protocol === "https:"
        } catch {
          return false
        }
      },
      {
        message: "URL must use http or https protocol",
      },
    ),
})

export type WebsiteUrlFormValues = z.infer<typeof websiteUrlSchema>
