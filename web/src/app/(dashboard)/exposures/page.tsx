import { getOrgId } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ExposureTracker } from "@/components/exposures/exposure-tracker"

export default async function ExposuresPage() {
  const orgId = await getOrgId()

  const [exposures, templates] = await Promise.all([
    prisma.exposure.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: { settlementDate: "asc" },
    }),
    prisma.mappingTemplate.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, columnMap: true },
    }),
  ])

  return (
    <ExposureTracker
      initialExposures={exposures.map((e) => ({ ...e, amount: e.amount.toString() }))}
      mappingTemplates={templates}
    />
  )
}
