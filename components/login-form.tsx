"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, X } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { z } from "zod"

// Simple validation schemas that don't interfere with existing functionality
const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(100, "Email must be less than 100 characters")

const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(50, "Name must be less than 50 characters")
  .regex(/^[a-zA-Z\s\-']+$/, "Name can only contain letters, spaces, hyphens, and apostrophes")

// Password schema to prevent XSS
const passwordSchema = z
  .string()
  .min(1, "Password is required")
  .refine((password) => !/<script|<\/script|javascript:|on\w+=/i.test(password), "Password contains invalid characters")

export default function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get("redirect") || "/dashboard"

  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isPasswordFocused, setIsPasswordFocused] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Validation errors
  const [emailError, setEmailError] = useState("")
  const [firstNameError, setFirstNameError] = useState("")
  const [lastNameError, setLastNameError] = useState("")
  const [passwordError, setPasswordError] = useState("")

  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  })

  const [passwordsMatch, setPasswordsMatch] = useState(true)

  useEffect(() => {
    setPasswordRequirements({
      length: password.length >= 10,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    })

    // Validate password for XSS
    try {
      passwordSchema.parse(password)
      setPasswordError("")
    } catch (err) {
      if (err instanceof z.ZodError) {
        setPasswordError(err.errors[0].message)
      }
    }
  }, [password])

  useEffect(() => {
    setPasswordsMatch(password === confirmPassword || confirmPassword === "")
  }, [password, confirmPassword])

  // Validate email when it changes
  useEffect(() => {
    if (email) {
      try {
        emailSchema.parse(email)
        setEmailError("")
      } catch (err) {
        if (err instanceof z.ZodError) {
          setEmailError(err.errors[0].message)
        }
      }
    } else {
      setEmailError("")
    }
  }, [email])

  // Validate first name when it changes
  useEffect(() => {
    if (firstName) {
      try {
        nameSchema.parse(firstName)
        setFirstNameError("")
      } catch (err) {
        if (err instanceof z.ZodError) {
          setFirstNameError(err.errors[0].message)
        }
      }
    } else {
      setFirstNameError("")
    }
  }, [firstName])

  // Validate last name when it changes
  useEffect(() => {
    if (lastName) {
      try {
        nameSchema.parse(lastName)
        setLastNameError("")
      } catch (err) {
        if (err instanceof z.ZodError) {
          setLastNameError(err.errors[0].message)
        }
      }
    } else {
      setLastNameError("")
    }
  }, [lastName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")

    // Validate inputs before submission
    let hasErrors = false

    try {
      emailSchema.parse(email)
    } catch (err) {
      if (err instanceof z.ZodError) {
        setEmailError(err.errors[0].message)
        hasErrors = true
      }
    }

    try {
      passwordSchema.parse(password)
    } catch (err) {
      if (err instanceof z.ZodError) {
        setPasswordError(err.errors[0].message)
        hasErrors = true
      }
    }

    if (!isLogin) {
      try {
        nameSchema.parse(firstName)
      } catch (err) {
        if (err instanceof z.ZodError) {
          setFirstNameError(err.errors[0].message)
          hasErrors = true
        }
      }

      try {
        nameSchema.parse(lastName)
      } catch (err) {
        if (err instanceof z.ZodError) {
          setLastNameError(err.errors[0].message)
          hasErrors = true
        }
      }

      // Check password requirements
      if (!Object.values(passwordRequirements).every(Boolean)) {
        hasErrors = true
      }

      // Check passwords match
      if (!passwordsMatch) {
        hasErrors = true
      }

      // Check terms accepted
      if (!termsAccepted) {
        hasErrors = true
      }
    }

    if (hasErrors) {
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: isLogin ? "login" : "register",
          email,
          password,
          firstName,
          lastName,
          termsAccepted: !isLogin ? new Date().toISOString() : undefined,
        }),
        credentials: "include", // Important: include cookies in the request
      })

      let data
      const textResponse = await response.text()

      try {
        data = JSON.parse(textResponse)
      } catch (jsonError) {
        throw new Error(`Invalid response from server: ${textResponse}`)
      }

      if (response.ok) {
        if (isLogin) {
          // Store token and user data in localStorage as a backup
          localStorage.setItem("token", data.token)
          localStorage.setItem("user", JSON.stringify(data.user))

          // Force a page reload to ensure cookies are properly recognized
          if (data.user.isSuperAdmin && redirectPath === "/dashboard") {
            window.location.href = "/admin"
          } else {
            window.location.href = redirectPath
          }
        } else {
          setIsLogin(true)
          setEmail("")
          setPassword("")
          setFirstName("")
          setLastName("")
          setConfirmPassword("")
          setSuccess("Registration successful. Please log in with your new account.")
          setIsLoading(false)
        }
      } else {
        setError(data.message || "An error occurred. Please try again.")
        setIsLoading(false)
      }
    } catch (error) {
      setError(`An error occurred: ${error.message}`)
      setIsLoading(false)
    }
  }

  const PasswordRequirement = ({ met, label }: { met: boolean; label: string }) => (
    <div className={`flex items-center space-x-2 ${met ? "text-green-600" : "text-red-600"}`}>
      {met ? <Check size={16} /> : <X size={16} />}
      <span>{label}</span>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isLogin ? "Login" : "Register"}</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required={!isLogin}
                  aria-invalid={firstNameError ? "true" : "false"}
                />
                {firstNameError && <p className="text-red-600 text-sm mt-1">{firstNameError}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required={!isLogin}
                  aria-invalid={lastNameError ? "true" : "false"}
                />
                {lastNameError && <p className="text-red-600 text-sm mt-1">{lastNameError}</p>}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={emailError ? "true" : "false"}
            />
            {emailError && <p className="text-red-600 text-sm mt-1">{emailError}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setIsPasswordFocused(true)}
              onBlur={() => setIsPasswordFocused(false)}
              aria-invalid={passwordError ? "true" : "false"}
            />
            {passwordError && <p className="text-red-600 text-sm mt-1">{passwordError}</p>}
            {!isLogin && isPasswordFocused && (
              <div className="mt-2 space-y-1 text-sm">
                <PasswordRequirement met={passwordRequirements.length} label="At least 10 characters long" />
                <PasswordRequirement met={passwordRequirements.uppercase} label="Contains an uppercase letter" />
                <PasswordRequirement met={passwordRequirements.lowercase} label="Contains a lowercase letter" />
                <PasswordRequirement met={passwordRequirements.number} label="Contains a number" />
                <PasswordRequirement met={passwordRequirements.special} label="Contains a special character" />
              </div>
            )}
          </div>
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {!passwordsMatch && confirmPassword !== "" && (
                  <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
                )}
              </div>
            </>
          )}
          {!isLogin && (
            <div className="flex items-start space-x-2 mt-4">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                required
              />
              <label
                htmlFor="terms"
                className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                By clicking "Continue" I accept Campaign Portal's{" "}
                <a
                  href="/terms-of-service"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  terms of use
                </a>{" "}
                and{" "}
                <a
                  href="/privacy-policy"
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  privacy policy
                </a>
                .
              </label>
            </div>
          )}
          {error && <p className="text-red-600 text-sm">{error}</p>}
          {success && <p className="text-green-600 text-sm">{success}</p>}
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full bg-red-600 hover:bg-red-700"
            disabled={
              isLoading ||
              Boolean(passwordError) ||
              (!isLogin &&
                (!Object.values(passwordRequirements).every(Boolean) ||
                  !passwordsMatch ||
                  (!isLogin && !termsAccepted)))
            }
          >
            {isLoading ? "Please wait..." : isLogin ? "Sign In" : "Continue"}
          </Button>
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setIsLogin(!isLogin)
              setPassword("")
              setConfirmPassword("")
              setFirstName("")
              setLastName("")
              setError("")
              setSuccess("")
              setEmailError("")
              setFirstNameError("")
              setLastNameError("")
              setPasswordError("")
            }}
            className="w-full"
            disabled={isLoading}
          >
            {isLogin ? "Need to create an account?" : "Already have an account?"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
