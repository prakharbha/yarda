import "server-only"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export async function getOrgId(): Promise<string> {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  })

  if (!member) throw new Error("No organization found for user")
  return member.organizationId
}

export async function getSession() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  return session
}
