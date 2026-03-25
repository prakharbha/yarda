import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { UpcomingExposuresTable } from "@/components/dashboard/upcoming-exposures-table"
import { CashflowChart } from "@/components/dashboard/cashflow-chart"

async function getDashboardData(organizationId: string) {
  const [upcomingExposures, trades] = await Promise.all([
    prisma.exposure.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        settlementDate: { gte: new Date() },
      },
      orderBy: { settlementDate: "asc" },
      take: 10,
    }),
    prisma.trade.findMany({
      where: {
        organizationId,
        status: { in: ["ACTIVE", "DRAFT"] },
        settlementDate: { gte: new Date() },
      },
      orderBy: { settlementDate: "asc" },
    }),
  ])

  return { upcomingExposures, trades }
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!member) {
    return (
      <div className="text-sm text-gray-500">
        No organization found. Please contact support.
      </div>
    )
  }

  const { upcomingExposures, trades } = await getDashboardData(member.organizationId)

  const firstName = session.user.name?.split(" ")[0] ?? "there"

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome, {firstName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {member.organization.name}
        </p>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">
            Upcoming Receivables / Deliverables
          </h2>
        </div>
        <UpcomingExposuresTable
          exposures={upcomingExposures.map((e) => ({
            ...e,
            amount: e.amount.toString(),
          }))}
          trades={trades.map((t) => ({
            ...t,
            notional: t.notional.toString(),
            rate: t.rate?.toString() ?? null,
            markToMarket: t.markToMarket?.toString() ?? null,
          }))}
        />
      </div>

      <div className="bg-white rounded-xl border">
        <div className="px-5 py-4 border-b">
          <h2 className="text-sm font-semibold text-gray-900">
            Inflow &amp; Outflow
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">USD equivalent</p>
        </div>
        <div className="p-5">
          <CashflowChart exposures={upcomingExposures.map((e) => ({ ...e, amount: e.amount.toString() }))} />
        </div>
      </div>
    </div>
  )
}
