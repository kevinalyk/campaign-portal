"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Plus, Home, Menu, X } from "lucide-react"
import { OrganizationSwitcher } from "@/components/organization-switcher"
import { OrganizationNav } from "@/components/organization-nav"
import Image from "next/image"

interface UserData {
  email: string
  id: string
  firstName: string
  lastName: string
  isSuperAdmin?: boolean
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [organizationData, setOrganizationData] = useState<{ id: string; url: string } | null>(null)

  // Extract organization ID or URL from URL if present
  const organizationPathMatch = pathname.match(/\/dashboard\/campaigns\/([^/]+)/)
  const organizationPath = organizationPathMatch ? organizationPathMatch[1] : undefined

  // Determine if we're in an organization context
  const isInOrganization = !!organizationPath

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token")
    const userData = localStorage.getItem("user")

    if (!token || !userData) {
      router.push("/login")
      return
    }

    try {
      setUser(JSON.parse(userData))
    } catch (error) {
      router.push("/login")
    } finally {
      setLoading(false)
    }
  }, [router])

  // Fetch organization data if needed
  useEffect(() => {
    if (isInOrganization && organizationPath) {
      const fetchOrganizationData = async () => {
        try {
          const token = localStorage.getItem("token")
          if (!token) return

          const response = await fetch(`/api/campaigns/${organizationPath}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error("Failed to fetch organization")

          const data = await response.json()
          if (data.campaign) {
            setOrganizationData({
              id: data.campaign._id,
              url: data.campaign.url,
            })
          }
        } catch (error) {
          console.error("Error fetching organization data:", error)
        }
      }

      fetchOrganizationData()
    }
  }, [organizationPath, isInOrganization])

  // Redirect to first organization if on dashboard root
  useEffect(() => {
    if (pathname === "/dashboard" && !loading) {
      const fetchFirstOrganization = async () => {
        try {
          const token = localStorage.getItem("token")
          if (!token) return

          const response = await fetch("/api/user/organizations", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          })

          if (!response.ok) throw new Error("Failed to fetch organizations")

          const data = await response.json()
          if (data.organizations && data.organizations.length > 0) {
            router.push(`/dashboard/campaigns/${data.organizations[0].url || data.organizations[0]._id}`)
          } else {
            // No organizations, redirect to create new
            router.push("/dashboard/campaigns/new")
          }
        } catch (error) {
          // Error fetching first organization - silently fail
        }
      }

      fetchFirstOrganization()
    }
  }, [pathname, loading, router])

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-[#192745] shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between h-16 px-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="flex items-center space-x-2">
              <div className="h-10 w-10 relative">
                <Image
                  src="/images/logo-icon.png"
                  alt="Campaign Portal Logo"
                  width={40}
                  height={40}
                  className="h-10 w-10"
                  priority
                />
              </div>
              <div className="hidden sm:block">
                <Image
                  src="/images/logo-text.png"
                  alt="Campaign Portal"
                  width={240}
                  height={32}
                  className="h-8 w-auto"
                  priority
                />
              </div>
            </Link>
          </div>

          <div className="flex items-center">
            {/* Organization Switcher with user info */}
            {isInOrganization && organizationData ? (
              <OrganizationSwitcher currentOrganizationId={organizationData.id} user={user} />
            ) : (
              <OrganizationSwitcher user={user} />
            )}

            {/* Mobile menu button - keep this */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden text-white ml-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white shadow-md">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-800">
              {user?.firstName ? `${user.firstName} ${user.lastName}` : user?.email}
            </p>
          </div>

          <nav className="py-2">
            <ul className="space-y-1">
              {isInOrganization ? (
                // Organization-specific navigation for mobile
                <div className="px-2">
                  <OrganizationNav organizationId={organizationPath} />
                </div>
              ) : (
                // Default navigation for mobile
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Home className="h-4 w-4 mr-3" />
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/campaigns/new"
                      className="flex items-center px-4 py-3 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Plus className="h-4 w-4 mr-3" />
                      New Organization
                    </Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        {isInOrganization && pathname !== "/dashboard/campaigns/new" && (
          <div className="w-64 bg-white shadow-sm hidden md:block">
            {/* Removed the "New Organization" button from here */}

            {/* Organization-specific navigation */}
            <OrganizationNav organizationId={organizationPath} />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 p-4 md:p-8 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
