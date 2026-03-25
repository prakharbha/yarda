import { getOrgId, getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SettingsPage } from "@/components/settings/settings-page"

export default async function Settings() {
  const [orgId, session] = await Promise.all([getOrgId(), getSession()])

  const [org, user, providers, simSettings, uploadSettings, mappingTemplates] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId } }),
    prisma.user.findUnique({ where: { id: session!.user.id }, select: { id: true, name: true, email: true } }),
    prisma.provider.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "asc" } }),
    prisma.simulationSettings.findUnique({ where: { organizationId: orgId } }),
    prisma.uploadSettings.findUnique({ where: { organizationId: orgId } }),
    prisma.mappingTemplate.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { createdAt: "desc" } }),
  ])

  return (
    <SettingsPage
      org={org ? { ...org, operatingCountries: org.operatingCountries } : null}
      user={user}
      providers={providers}
      simSettings={simSettings}
      uploadSettings={uploadSettings}
      mappingTemplates={mappingTemplates}
    />
  )
}
