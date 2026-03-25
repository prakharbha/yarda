"use server"

import { signIn } from "@/lib/auth"
import { AuthError } from "next-auth"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
})

const signupSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters." })
    .regex(/[a-zA-Z]/, { message: "Must contain at least one letter." })
    .regex(/[0-9]/, { message: "Must contain at least one number." }),
  organizationName: z.string().min(2, { message: "Company name required." }),
})

type FormState =
  | {
      errors?: {
        name?: string[]
        email?: string[]
        password?: string[]
        organizationName?: string[]
      }
      message?: string
    }
  | undefined

export async function signInAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  try {
    await signIn("credentials", {
      email: validated.data.email,
      password: validated.data.password,
      redirectTo: "/",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { message: "Invalid email or password." }
    }
    throw error
  }
}

export async function signUpAction(
  _state: FormState,
  formData: FormData
): Promise<FormState> {
  const validated = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    organizationName: formData.get("organizationName"),
  })

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors }
  }

  const { name, email, password, organizationName } = validated.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { errors: { email: ["An account with this email already exists."] } }
  }

  const hashedPassword = await bcrypt.hash(password, 12)

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name, email, password: hashedPassword },
    })

    const org = await tx.organization.create({
      data: { name: organizationName },
    })

    await tx.organizationMember.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    })
  })

  await signIn("credentials", { email, password, redirectTo: "/" })
}
