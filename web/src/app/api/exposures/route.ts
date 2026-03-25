import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

async function getOrgId(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  })
  return member?.organizationId ?? null
}

export async function GET(req: NextRequest) {
  const orgId = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") ?? "ACTIVE"
  const currency = searchParams.get("currency")
  const direction = searchParams.get("direction")

  const exposures = await prisma.exposure.findMany({
    where: {
      organizationId: orgId,
      ...(status ? { status: status as "ACTIVE" | "SETTLED" | "CANCELLED" } : {}),
      ...(currency ? { currency } : {}),
      ...(direction ? { direction: direction as "PAY" | "RECEIVE" } : {}),
    },
    orderBy: { settlementDate: "asc" },
  })

  return NextResponse.json(exposures.map((e) => ({ ...e, amount: e.amount.toString() })))
}

const createSchema = z.object({
  currency: z.string().min(1),
  amount: z.number().positive(),
  direction: z.enum(["PAY", "RECEIVE"]),
  settlementDate: z.string(),
  entity: z.string().optional(),
  counterparty: z.string().optional(),
  notes: z.string().optional(),
  invoiceId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const orgId = await getOrgId(req)
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const exposure = await prisma.exposure.create({
    data: {
      organizationId: orgId,
      ...parsed.data,
      settlementDate: new Date(parsed.data.settlementDate),
      uploadSource: "MANUAL",
    },
  })

  return NextResponse.json({ ...exposure, amount: exposure.amount.toString() }, { status: 201 })
}
