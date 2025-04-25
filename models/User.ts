import type { ObjectId } from "mongodb"

export interface User {
  _id: ObjectId
  email: string
  password: string
  firstName: string
  lastName: string
  createdAt: Date
  lastLogin: Date
  isActive: boolean
  isSuperAdmin?: boolean
  termsAccepted?: Date
}

export interface UserInput {
  email: string
  password: string
  firstName: string
  lastName: string
  isSuperAdmin?: boolean
  termsAccepted?: Date
}
