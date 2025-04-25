import clientPromise from "@/lib/mongodb"
import { UserService } from "@/services/userService"

export async function initializeSuperAdmin() {
  try {
    const client = await clientPromise
    const userService = new UserService(client)

    // Initialize kevinalyk@gmail.com as super admin
    const email = "kevinalyk@gmail.com"
    const user = await userService.findUserByEmail(email)

    if (user) {
      // If the user exists but is not a super admin, make them one
      if (!user.isSuperAdmin) {
        console.log(`Making ${email} a super admin`)
        await userService.toggleSuperAdmin(user._id.toString(), true)
      }
    } else {
      console.log(`User ${email} not found yet. They will be made super admin when they register.`)
    }

    console.log("Super admin initialization check complete")
  } catch (error) {
    console.error("Error initializing super admin:", error)
  }
}
