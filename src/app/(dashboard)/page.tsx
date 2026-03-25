import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { UpcomingExposuresTable } from "@/components/dashboard/upcoming-exposures-table"
import { CashflowChart } from "@/components/dashboard/cashflow-chart"
import { Badge } from "@/components/ui/badge"

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

async function getAdminData() {
  const orgs = await prisma.organization.findMany({
    include: {
      members: { include: { user: { select: { email: true, name: true } } } },
      _count: { select: { exposures: true, trades: true } },
    },
    orderBy: { createdAt: "desc" },
  })
  return orgs
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")

  const isAdmin = session.user.role === "ADMIN"

  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    include: { organization: true },
  })

  if (!member && !isAdmin) {
    return (
      <div className="text-sm text-gray-500">
        No organization found. Please contact support.
      </div>
    )
  }

  const firstName = session.user.name?.split(" ")[0] ?? "there"

  // Admin sees all organizations overview
  if (isAdmin) {
    const allOrgs = await getAdminData()
    return (
      <div className="space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Welcome, {firstName}!</h1>
            <p className="text-sm text-gray-500 mt-0.5">Yarda Admin — Platform Overview</p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 border-0">Admin</Badge>
        </div>

        {/* Platform stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total Organizations", value: allOrgs.length },
            { label: "Total Exposures", value: allOrgs.reduce((s, o) => s + o._count.exposures, 0) },
            { label: "Total Trades", value: allOrgs.reduce((s, o) => s + o._count.trades, 0) },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border px-5 py-4">
              <p className="text-xs text-gray-500">{stat.label}</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* All organizations table */}
        <div className="bg-white rounded-xl border">
          <div className="px-5 py-4 border-b">
            <h2 className="text-sm font-semibold text-gray-900">All Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50/50">
                  {["Organization", "Base Currency", "Members", "Exposures", "Trades", "Created"].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allOrgs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-gray-400">No organizations yet.</td></tr>
                ) : allOrgs.map((org) => (
                  <tr key={org.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{org.name}</p>
                      <p className="text-xs text-gray-400">{org.members[0]?.user.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{org.baseCurrency}</td>
                    <td className="px-4 py-3 text-gray-600">{org.members.length}</td>
                    <td className="px-4 py-3 text-gray-600">{org._count.exposures}</td>
                    <td className="px-4 py-3 text-gray-600">{org._count.trades}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(org.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // Regular client dashboard
  const { upcomingExposures, trades } = await getDashboardData(member!.organizationId)

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">
          Welcome, {firstName}!
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {member!.organization.name}
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
