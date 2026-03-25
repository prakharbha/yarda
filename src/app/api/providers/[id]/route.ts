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

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  active: z.boolean().optional(),
  environment: z.enum(["SANDBOX", "PRODUCTION"]).optional(),
  accountId: z.string().optional(),
  connectivityStatus: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const provider = await prisma.provider.findFirst({ where: { id, organizationId: orgId } })
  if (!provider) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.provider.update({ where: { id }, data: parsed.data })
  return NextResponse.json(updated)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const provider = await prisma.provider.findFirst({ where: { id, organizationId: orgId } })
  if (!provider) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.provider.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
