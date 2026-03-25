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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const template = await prisma.mappingTemplate.findFirst({ where: { id, organizationId: orgId } })
  if (!template) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.mappingTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
