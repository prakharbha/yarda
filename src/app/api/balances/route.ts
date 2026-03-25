import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function getOrgId() {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  })
  return member?.organizationId ?? null
}

export async function GET() {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const balances = await prisma.currencyBalance.findMany({
    where: { organizationId: orgId },
    orderBy: { currency: "asc" },
  })

  return NextResponse.json(balances.map((b) => ({ ...b, balance: b.balance.toString() })))
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { currency, balance } = body

  if (!currency || typeof currency !== "string" || currency.trim().length < 2) {
    return NextResponse.json({ error: "Valid currency code required" }, { status: 400 })
  }
  if (balance === undefined || isNaN(Number(balance))) {
    return NextResponse.json({ error: "Numeric balance required" }, { status: 400 })
  }

  const result = await prisma.currencyBalance.upsert({
    where: { organizationId_currency: { organizationId: orgId, currency: currency.toUpperCase().trim() } },
    update: { balance: Number(balance) },
    create: { organizationId: orgId, currency: currency.toUpperCase().trim(), balance: Number(balance) },
  })

  return NextResponse.json({ ...result, balance: result.balance.toString() })
}
