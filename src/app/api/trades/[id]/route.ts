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
  currencyPair: z.string().optional(),
  direction: z.enum(["BUY", "SELL"]).optional(),
  notional: z.number().positive().optional(),
  rate: z.number().positive().optional(),
  settlementDate: z.string().optional(),
  status: z.enum(["DRAFT", "PENDING_QUOTE", "QUOTED", "PENDING_EXECUTION", "ACTIVE", "SETTLED", "CANCELLED"]).optional(),
  notes: z.string().optional(),
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

  const trade = await prisma.trade.findFirst({ where: { id, organizationId: orgId } })
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const updated = await prisma.trade.update({
    where: { id },
    data: {
      ...parsed.data,
      ...(parsed.data.settlementDate ? { settlementDate: new Date(parsed.data.settlementDate) } : {}),
      updatedAt: new Date(),
    },
    include: { provider: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    ...updated,
    notional: updated.notional.toString(),
    rate: updated.rate?.toString() ?? null,
    markToMarket: updated.markToMarket?.toString() ?? null,
  })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const trade = await prisma.trade.findFirst({ where: { id, organizationId: orgId } })
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.trade.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
