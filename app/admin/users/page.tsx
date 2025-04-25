"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Shield, Search, Trash2, UserX, UserCheck } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  createdAt: string
  lastLogin: string
  isActive: boolean
  isSuperAdmin: boolean
}

export default function UserManagement() {
  // Add this sanitizeInput function right after the component declaration
  const sanitizeInput = (input: string): string => {
    if (!input) return input
    // Remove HTML tags
    let sanitized = input.replace(/<[^>]*>/g, "")
    // Remove dangerous patterns
    sanitized = sanitized.replace(/javascript:/gi, "")
    sanitized = sanitized.replace(/data:/gi, "")
    sanitized = sanitized.replace(/vbscript:/gi, "")
    sanitized = sanitized.replace(/on\w+=/gi, "")
    return sanitized
  }

  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [isSuperAdmin, setIsSuperAdmin] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [currentUserEmail, setCurrentUserEmail] = useState("")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
  const [userToToggleStatus, setUserToToggleStatus] = useState<User | null>(null)
  const [isTogglingStatus, setIsTogglingStatus] = useState(false)

  useEffect(() => {
    // Get current user email
    const userData = localStorage.getItem("user")
    if (userData) {
      try {
        const parsedUser = JSON.parse(userData)
        setCurrentUserEmail(parsedUser.email)
      } catch (error) {
        console.error("Error parsing user data:", error)
      }
    }

    fetchUsers()
  }, [])

  useEffect(() => {
    let filtered = users

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((user) => user.isActive)
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((user) => !user.isActive)
    }

    // Apply search filter
    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          (user.firstName && user.firstName.toLowerCase().includes(query)) ||
          (user.lastName && user.lastName.toLowerCase().includes(query)),
      )
    }

    setFilteredUsers(filtered)
  }, [searchQuery, statusFilter, users])

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch("/api/admin/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error("Failed to fetch users")
      }

      const data = await response.json()
      setUsers(data.users || [])
      setFilteredUsers(data.users || [])
    } catch (error) {
      console.error("Error fetching users:", error)
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleToggleSuperAdmin = async () => {
    if (!selectedUser) return

    setIsSubmitting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/admin/users/${selectedUser.id}/super-admin`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isSuperAdmin }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update super admin status")
      }

      // Update the user in the list
      setUsers((prevUsers) => prevUsers.map((user) => (user.id === selectedUser.id ? { ...user, isSuperAdmin } : user)))

      setIsDialogOpen(false)
    } catch (error) {
      console.error("Error updating super admin status:", error)
      setError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!userToDelete) return

    setIsDeleting(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to delete user")
      }

      // Remove the user from the list
      setUsers((prev) => prev.filter((user) => user.id !== userToDelete.id))
      setIsDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting user:", error)
      setError(error.message)
    } finally {
      setIsDeleting(false)
      setUserToDelete(null)
    }
  }

  const handleToggleUserStatus = async () => {
    if (!userToToggleStatus) return

    setIsTogglingStatus(true)

    try {
      const token = localStorage.getItem("token")
      if (!token) {
        throw new Error("No authentication token found")
      }

      const newStatus = !userToToggleStatus.isActive

      const response = await fetch(`/api/admin/users/${userToToggleStatus.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: newStatus }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Failed to ${newStatus ? "activate" : "deactivate"} user`)
      }

      // Update the user in the list
      setUsers((prevUsers) =>
        prevUsers.map((user) => (user.id === userToToggleStatus.id ? { ...user, isActive: newStatus } : user)),
      )

      setIsStatusDialogOpen(false)
    } catch (error) {
      console.error("Error toggling user status:", error)
      setError(error.message)
    } finally {
      setIsTogglingStatus(false)
      setUserToToggleStatus(null)
    }
  }

  const openSuperAdminDialog = (user: User) => {
    setSelectedUser(user)
    setIsSuperAdmin(user.isSuperAdmin)
    setIsDialogOpen(true)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + " " + new Date(dateString).toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold">User Management</h1>
        <Button onClick={fetchUsers}>Refresh</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(sanitizeInput(e.target.value))}
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="active">Active Users</SelectItem>
            <SelectItem value="inactive">Inactive Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card>
          <CardContent className="p-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Users ({filteredUsers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Super Admin</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id} className={!user.isActive ? "bg-gray-50" : ""}>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        {user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : "Not set"}
                      </TableCell>
                      <TableCell>
                        {user.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell>{formatDate(user.lastLogin)}</TableCell>
                      <TableCell>
                        {user.isSuperAdmin ? (
                          <div className="flex items-center">
                            <Shield className="h-4 w-4 text-green-500 mr-1" />
                            <span>Yes</span>
                          </div>
                        ) : (
                          <span>No</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openSuperAdminDialog(user)}
                            disabled={user.email === currentUserEmail}
                            title={user.email === currentUserEmail ? "Cannot modify your own super admin status" : ""}
                          >
                            <Shield className="h-4 w-4 mr-2" />
                            Access
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setUserToToggleStatus(user)
                              setIsStatusDialogOpen(true)
                            }}
                            disabled={user.email === currentUserEmail}
                            title={user.email === currentUserEmail ? "Cannot modify your own account status" : ""}
                          >
                            {user.isActive ? (
                              <>
                                <UserX className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => {
                              setUserToDelete(user)
                              setIsDeleteDialogOpen(true)
                            }}
                            disabled={user.isSuperAdmin || user.email === currentUserEmail}
                            title={
                              user.isSuperAdmin
                                ? "Cannot delete a super admin"
                                : user.email === currentUserEmail
                                  ? "Cannot delete your own account"
                                  : ""
                            }
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Super Admin Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Super Admin Access</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="py-4">
              <p className="mb-4">
                User: <strong>{selectedUser.email}</strong>
              </p>
              <div className="flex items-center space-x-2">
                <Switch id="super-admin" checked={isSuperAdmin} onCheckedChange={setIsSuperAdmin} />
                <Label htmlFor="super-admin">Super Admin Access</Label>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Super admins have full access to manage all users and organizations on the platform.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleToggleSuperAdmin} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Deletion</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to delete the user "{userToDelete?.email}"? This action cannot be undone and will
            remove all associated data.
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUser} disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle User Status Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{userToToggleStatus?.isActive ? "Deactivate User" : "Activate User"}</DialogTitle>
          </DialogHeader>
          <p>
            Are you sure you want to {userToToggleStatus?.isActive ? "deactivate" : "activate"} the user "
            {userToToggleStatus?.email}"?
            {userToToggleStatus?.isActive
              ? " Deactivated users cannot log in to the platform but their data will be preserved."
              : " Activating this user will allow them to log in to the platform again."}
          </p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={userToToggleStatus?.isActive ? "destructive" : "default"}
              onClick={handleToggleUserStatus}
              disabled={isTogglingStatus}
            >
              {isTogglingStatus
                ? userToToggleStatus?.isActive
                  ? "Deactivating..."
                  : "Activating..."
                : userToToggleStatus?.isActive
                  ? "Deactivate User"
                  : "Activate User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
