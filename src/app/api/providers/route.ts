import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function getOrgId() {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  })
  return member?.organizationId ?? null
}

const createSchema = z.object({
  name: z.string().min(1),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).default("SANDBOX"),
  accountId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const provider = await prisma.provider.create({
    data: { organizationId: orgId, ...parsed.data },
  })

  return NextResponse.json(provider, { status: 201 })
}
