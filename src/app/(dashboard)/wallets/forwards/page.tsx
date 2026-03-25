import { getOrgId } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { ForwardsWallet } from "@/components/wallets/forwards-wallet"

export default async function ForwardsPage() {
  const orgId = await getOrgId()

  const trades = await prisma.trade.findMany({
    where: { organizationId: orgId, tradeType: "FORWARD" },
    orderBy: { settlementDate: "asc" },
    include: { provider: { select: { id: true, name: true } } },
  })

  const providers = await prisma.provider.findMany({
    where: { organizationId: orgId, active: true },
    select: { id: true, name: true },
  })

  return (
    <ForwardsWallet
      initialTrades={trades.map((t) => ({
        ...t,
        notional: t.notional.toString(),
        rate: t.rate?.toString() ?? null,
        markToMarket: t.markToMarket?.toString() ?? null,
      }))}
      providers={providers}
    />
  )
}
