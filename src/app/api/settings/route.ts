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

const orgSchema = z.object({
  name: z.string().min(1).optional(),
  baseCurrency: z.string().length(3).optional(),
  reportingCurrency: z.string().length(3).optional(),
  timezone: z.string().optional(),
  operatingCountries: z.array(z.string()).optional(),
})

const userSchema = z.object({
  name: z.string().min(1).optional(),
})

const simSchema = z.object({
  defaultHedgeRatios: z.array(z.number().min(0).max(1)).optional(),
  defaultTenorDays: z.number().int().positive().optional(),
  showDisclosure: z.boolean().optional(),
})

const uploadSchemaInput = z.object({
  defaultDateFormat: z.string().optional(),
  defaultAmountFormat: z.string().optional(),
  directionPayLabel: z.string().optional(),
  directionReceiveLabel: z.string().optional(),
})

const bodySchema = z.object({
  section: z.enum(["organization", "user", "simulation", "upload"]),
  data: z.record(z.string(), z.unknown()),
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { section, data } = parsed.data

  if (section === "organization") {
    const p = orgSchema.safeParse(data)
    if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 })
    const updated = await prisma.organization.update({ where: { id: orgId }, data: p.data })
    return NextResponse.json(updated)
  }

  if (section === "user") {
    const p = userSchema.safeParse(data)
    if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 })
    const updated = await prisma.user.update({ where: { id: session.user.id }, data: p.data })
    return NextResponse.json({ name: updated.name, email: updated.email })
  }

  if (section === "simulation") {
    const p = simSchema.safeParse(data)
    if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 })
    const updated = await prisma.simulationSettings.upsert({
      where: { organizationId: orgId },
      update: p.data,
      create: { organizationId: orgId, ...p.data },
    })
    return NextResponse.json(updated)
  }

  if (section === "upload") {
    const p = uploadSchemaInput.safeParse(data)
    if (!p.success) return NextResponse.json({ error: p.error.flatten() }, { status: 400 })
    const updated = await prisma.uploadSettings.upsert({
      where: { organizationId: orgId },
      update: p.data,
      create: { organizationId: orgId, ...p.data },
    })
    return NextResponse.json(updated)
  }

  return NextResponse.json({ error: "Unknown section" }, { status: 400 })
}
