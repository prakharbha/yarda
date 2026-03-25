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
  currency: z.string().optional(),
  amount: z.number().positive().optional(),
  direction: z.enum(["PAY", "RECEIVE"]).optional(),
  settlementDate: z.string().optional(),
  entity: z.string().optional(),
  counterparty: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["ACTIVE", "SETTLED", "CANCELLED"]).optional(),
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

  const exposure = await prisma.exposure.findFirst({ where: { id, organizationId: orgId } })
  if (!exposure) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.exposure.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.settlementDate ? { settlementDate: new Date(parsed.data.settlementDate) } : {}),
      updatedAt: new Date(),
    },
  })

  return NextResponse.json({ ...updated, amount: updated.amount.toString() })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const exposure = await prisma.exposure.findFirst({ where: { id, organizationId: orgId } })
  if (!exposure) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.exposure.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
