"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"
import { AddUserModal } from "@/components/add-user-modal"
import type { UserRole } from "@/models/UserCampaign"

interface CampaignUser {
  userId: string
  role: string
  userDetails?: {
    firstName: string
    lastName: string
    email: string
  }
}

export default function OrganizationUsersPage() {
  const router = useRouter()
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [campaignUsers, setCampaignUsers] = useState<CampaignUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAddUserModalOpen, setIsAddUserModalOpen] = useState(false)
  const [addUserSuccess, setAddUserSuccess] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const token = localStorage.getItem("token")
        const orgId = localStorage.getItem("currentOrganizationId")

        if (!token || !orgId) {
          router.push("/login")
          return
        }

        setOrganizationId(orgId)

        // Fetch campaign users
        const usersResponse = await fetch(`/api/campaigns/${orgId}/users`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (!usersResponse.ok) {
          throw new Error("Failed to fetch users")
        }

        const usersData = await usersResponse.json()
        const users = usersData.users || []

        // Fetch user details for each user
        const usersWithDetails = await Promise.all(
          users.map(async (user: CampaignUser) => {
            try {
              const userResponse = await fetch(`/api/users/${user.userId}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              })

              if (userResponse.ok) {
                const userData = await userResponse.json()
                return {
                  ...user,
                  userDetails: {
                    firstName: userData.user.firstName,
                    lastName: userData.user.lastName,
                    email: userData.user.email,
                  },
                }
              }
              return user
            } catch (error) {
              console.error("Error fetching user details:", error)
              return user
            }
          }),
        )

        setCampaignUsers(usersWithDetails)
      } catch (error) {
        console.error("Error fetching users:", error)
        setError(error.message)
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [router])

  const handleAddUser = (email: string, role: UserRole) => {
    // In a real implementation, this would call an API to send the invitation
    setAddUserSuccess(`Invitation sent to ${email} with role: ${role}`)

    // Clear the success message after 5 seconds
    setTimeout(() => {
      setAddUserSuccess(null)
    }, 5000)
  }

  const getUserDisplayName = (user: CampaignUser) => {
    if (user.userDetails) {
      if (user.userDetails.firstName && user.userDetails.lastName) {
        return `${user.userDetails.firstName} ${user.userDetails.lastName}`
      }
      return user.userDetails.email
    }
    return user.userId
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard")}>
              Return to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Organization Users</CardTitle>
          <CardDescription>Manage users who have access to this organization.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Users</h3>
            <Button size="sm" onClick={() => setIsAddUserModalOpen(true)}>
              <Users className="h-4 w-4 mr-2" />
              Add User
            </Button>
          </div>

          {addUserSuccess && <div className="bg-green-50 text-green-700 p-3 rounded-md text-sm">{addUserSuccess}</div>}

          {campaignUsers.length === 0 ? (
            <p className="text-gray-500 text-sm">No other users have access to this organization.</p>
          ) : (
            <div className="border rounded-md overflow-x-auto">
              <div className="grid grid-cols-2 gap-4 p-4 font-medium text-sm text-gray-500 border-b">
                <div>User</div>
                <div>Role</div>
              </div>
              {campaignUsers.map((user) => (
                <div key={user.userId} className="grid grid-cols-2 gap-4 p-4 text-sm border-b last:border-0">
                  <div className="break-words">{getUserDisplayName(user)}</div>
                  <div className="capitalize">{user.role}</div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {organizationId && (
        <AddUserModal
          isOpen={isAddUserModalOpen}
          onClose={() => setIsAddUserModalOpen(false)}
          campaignId={organizationId}
          onAddUser={handleAddUser}
        />
      )}
    </div>
  )
}
