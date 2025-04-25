"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { saveToGoogleSheets } from "@/app/actions/google-sheets"
import { signUpSchema, type SignUpFormData } from "@/lib/validations/sign-up-schema"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"

export default function SignUpForm() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      campaign: "",
    },
  })

  async function onSubmit(data: SignUpFormData) {
    setIsSubmitting(true)
    setMessage(null)

    try {
      // Convert form data to FormData for the server action
      const formData = new FormData()
      formData.append("firstName", data.firstName)
      formData.append("lastName", data.lastName)
      formData.append("email", data.email)
      if (data.campaign) formData.append("campaign", data.campaign)
      if (data.terms) formData.append("terms", "on")

      const result = await saveToGoogleSheets(formData)
      setMessage({ type: "success", text: "Thank you for signing up! We'll keep you updated." })
      setIsSubmitted(true)
      reset()
    } catch (error) {
      setMessage({ type: "error", text: "Something went wrong. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{isSubmitted ? "Thank You!" : "Sign Up"}</CardTitle>
        <CardDescription>
          {isSubmitted ? "We've received your information." : "Join our mailing list to receive updates"}
        </CardDescription>
      </CardHeader>
      {isSubmitted ? (
        <CardContent>
          <p className="text-center text-lg text-green-600">
            Your information has been successfully logged. We'll be in touch soon!
          </p>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  placeholder="John"
                  aria-invalid={errors.firstName ? "true" : "false"}
                />
                {errors.firstName && (
                  <p className="text-sm text-red-500" role="alert">
                    {errors.firstName.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  placeholder="Doe"
                  aria-invalid={errors.lastName ? "true" : "false"}
                />
                {errors.lastName && (
                  <p className="text-sm text-red-500" role="alert">
                    {errors.lastName.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="text" // Changed from "email" to "text" to allow our custom validation
                {...register("email")}
                placeholder="john.doe@example.com"
                aria-invalid={errors.email ? "true" : "false"}
              />
              {errors.email && (
                <p className="text-sm text-red-500" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign (Optional)</Label>
              <Input
                id="campaign"
                {...register("campaign")}
                placeholder="Campaign Name"
                aria-invalid={errors.campaign ? "true" : "false"}
              />
              {errors.campaign && (
                <p className="text-sm text-red-500" role="alert">
                  {errors.campaign.message}
                </p>
              )}
            </div>

            {message && (
              <div
                className={`p-3 rounded-md ${
                  message.type === "success" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                }`}
                role="alert"
              >
                {message.text}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Sign Up"}
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  )
}
