"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown, Search, X, LogOut, Shield, User, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar } from "@/components/ui/avatar"
import Link from "next/link"

interface Organization {
  _id: string
  name: string
  logoUrl?: string
  url?: string
}

interface OrganizationSwitcherProps {
  currentOrganizationId?: string
  user?: {
    firstName?: string
    lastName?: string
    email: string
    isSuperAdmin?: boolean
    id: string
  }
}

export function OrganizationSwitcher({ currentOrganizationId, user }: OrganizationSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [filteredOrganizations, setFilteredOrganizations] = useState<Organization[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    router.push("/login")
    setIsOpen(false)
  }

  // Fetch user's organizations
  useEffect(() => {
    const fetchOrganizations = async () => {
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
        setOrganizations(data.organizations || [])
        setFilteredOrganizations(data.organizations || [])

        // Find current organization
        if (currentOrganizationId) {
          const current = data.organizations.find((org: Organization) => org._id === currentOrganizationId)
          if (current) {
            setCurrentOrganization(current)
          }
        } else if (data.organizations.length > 0) {
          // Set first organization as current if none specified
          setCurrentOrganization(data.organizations[0])
        }
      } catch (error) {
        console.error("Error fetching organizations:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchOrganizations()
  }, [currentOrganizationId])

  // Filter organizations based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredOrganizations(organizations)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = organizations.filter((org) => org.name.toLowerCase().includes(query))
      setFilteredOrganizations(filtered)
    }
  }, [searchQuery, organizations])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleOrganizationSelect = (organization: Organization) => {
    router.push(`/dashboard/campaigns/${organization.url}`)
    setIsOpen(false)
  }

  if (loading) {
    return (
      <Button variant="ghost" className="h-9 w-9 px-0" disabled>
        <span className="h-5 w-5 rounded-full bg-gray-200 animate-pulse"></span>
      </Button>
    )
  }

  if (!currentOrganization) {
    return null
  }

  return (
    <div className="relative ml-auto" ref={dropdownRef}>
      <Button
        variant="ghost"
        className="flex items-center gap-2 h-auto py-1 px-2 text-white"
        onClick={() => setIsOpen(!isOpen)}
      >
        {user && (
          <span className="text-sm text-white hidden md:inline mr-2">
            {user.firstName ? `${user.firstName} ${user.lastName}` : user.email}
          </span>
        )}
        {currentOrganization && (
          <>
            <Avatar className="h-6 w-6">
              {currentOrganization.logoUrl ? (
                <img
                  src={currentOrganization.logoUrl || "/placeholder.svg"}
                  alt={currentOrganization.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-medium">
                  {currentOrganization.name.charAt(0)}
                </div>
              )}
            </Avatar>
            <span className="max-w-[150px] truncate text-sm font-medium text-white">{currentOrganization.name}</span>
          </>
        )}
        <ChevronDown className="h-4 w-4 text-white" />
      </Button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-80 bg-white rounded-md shadow-lg z-50 border border-gray-200">
          {/* User profile section */}
          {user && (
            <div className="p-3 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 text-sm font-medium">
                    {user.firstName ? user.firstName.charAt(0) : user.email.charAt(0)}
                  </div>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{user.firstName ? `${user.firstName} ${user.lastName}` : user.email}</p>
                  <p className="text-sm text-gray-500">{user.email}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsOpen(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Add New Organization button */}
          <div className="p-2 border-b border-gray-100">
            <Link href="/dashboard/campaigns/new" className="w-full" onClick={() => setIsOpen(false)}>
              <Button className="w-full bg-[#eb3339] hover:bg-[#d42d32] text-white">
                <Plus className="h-4 w-4 mr-2" />
                New Organization
              </Button>
            </Link>
          </div>

          {/* Current organization section */}
          {currentOrganization && (
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  {currentOrganization.logoUrl ? (
                    <img
                      src={currentOrganization.logoUrl || "/placeholder.svg"}
                      alt={currentOrganization.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-medium">
                      {currentOrganization.name.charAt(0)}
                    </div>
                  )}
                </Avatar>
                <span className="font-medium">{currentOrganization.name}</span>
              </div>
            </div>
          )}

          {/* Organization search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search Organizations"
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Organizations list */}
          <div className="max-h-[200px] overflow-y-auto border-b border-gray-100">
            {filteredOrganizations.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">No organizations found</div>
            ) : (
              <div className="py-1">
                {filteredOrganizations.map((org) => (
                  <button
                    key={org._id}
                    className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 ${
                      org._id === currentOrganization?._id ? "bg-gray-50" : ""
                    }`}
                    onClick={() => handleOrganizationSelect(org)}
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      {org.logoUrl ? (
                        <img
                          src={org.logoUrl || "/placeholder.svg"}
                          alt={org.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600 text-xs font-medium">
                          {org.name.charAt(0)}
                        </div>
                      )}
                    </Avatar>
                    <span className="flex-1 truncate">{org.name}</span>
                    {org._id === currentOrganization?._id && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Additional options */}
          <div className="py-1">
            <Link
              href="/dashboard/profile"
              className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4 text-gray-500" />
              <span>Profile Settings</span>
            </Link>

            {user?.isSuperAdmin && (
              <Link
                href="/admin"
                className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100"
                onClick={() => setIsOpen(false)}
              >
                <Shield className="h-4 w-4 text-gray-500" />
                <span>Admin Portal</span>
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-gray-100 text-red-600"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
