import { getOrgId } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { SpotsWallet } from "@/components/wallets/spots-wallet"

export default async function SpotsPage() {
  const orgId = await getOrgId()

  const [trades, providers, currencyBalances] = await Promise.all([
    prisma.trade.findMany({
      where: { organizationId: orgId, tradeType: "SPOT" },
      orderBy: { settlementDate: "asc" },
      include: { provider: { select: { id: true, name: true } } },
    }),
    prisma.provider.findMany({
      where: { organizationId: orgId, active: true },
      select: { id: true, name: true },
    }),
    prisma.currencyBalance.findMany({
      where: { organizationId: orgId },
      orderBy: { currency: "asc" },
    }),
  ])

  return (
    <SpotsWallet
      initialTrades={trades.map((t) => ({
        ...t,
        notional: t.notional.toString(),
        rate: t.rate?.toString() ?? null,
        markToMarket: t.markToMarket?.toString() ?? null,
      }))}
      providers={providers}
      initialBalances={currencyBalances.map((b) => ({ ...b, balance: b.balance.toString() }))}
    />
  )
}
