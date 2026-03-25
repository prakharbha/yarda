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

  const templates = await prisma.mappingTemplate.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, columnMap: true },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(templates)
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, columnMap } = body

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 })
  }
  if (!columnMap || typeof columnMap !== "object") {
    return NextResponse.json({ error: "columnMap is required" }, { status: 400 })
  }

  const template = await prisma.mappingTemplate.create({
    data: {
      organizationId: orgId,
      name: name.trim(),
      columnMap,
    },
    select: { id: true, name: true, columnMap: true },
  })

  return NextResponse.json(template, { status: 201 })
}
