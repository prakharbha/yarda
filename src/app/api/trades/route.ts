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

export async function GET(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get("type") // FORWARD | SPOT
  const status = searchParams.get("status")

  const trades = await prisma.trade.findMany({
    where: {
      organizationId: orgId,
      ...(type ? { tradeType: type as "FORWARD" | "SPOT" } : {}),
      ...(status ? { status: status as "DRAFT" | "ACTIVE" | "SETTLED" | "CANCELLED" } : {}),
    },
    orderBy: { settlementDate: "asc" },
    include: { provider: { select: { id: true, name: true } } },
  })

  return NextResponse.json(trades.map((t) => ({
    ...t,
    notional: t.notional.toString(),
    rate: t.rate?.toString() ?? null,
    markToMarket: t.markToMarket?.toString() ?? null,
  })))
}

const createSchema = z.object({
  tradeType: z.enum(["FORWARD", "SPOT"]),
  currencyPair: z.string().min(6).max(7),
  direction: z.enum(["BUY", "SELL"]),
  notional: z.number().positive(),
  rate: z.number().positive().optional(),
  tradeDate: z.string().optional(),
  settlementDate: z.string(),
  providerId: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const trade = await prisma.trade.create({
    data: {
      organizationId: orgId,
      ...parsed.data,
      settlementDate: new Date(parsed.data.settlementDate),
      ...(parsed.data.tradeDate ? { tradeDate: new Date(parsed.data.tradeDate) } : {}),
    },
    include: { provider: { select: { id: true, name: true } } },
  })

  return NextResponse.json({
    ...trade,
    notional: trade.notional.toString(),
    rate: trade.rate?.toString() ?? null,
    markToMarket: trade.markToMarket?.toString() ?? null,
  }, { status: 201 })
}
