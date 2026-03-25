"use client"

import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"

// Use plain types to avoid importing Prisma client in a client component
interface ExposureRow {
  id: string
  settlementDate: Date | string
  amount: string | number
  direction: string
  currency: string
  counterparty?: string | null
  hedgingStatus: string
}

interface TradeRow {
  status: string
  currencyPair: string
}

interface Props {
  exposures: ExposureRow[]
  trades: TradeRow[]
}

const hedgingBadge: Record<string, { label: string; className: string }> = {
  HEDGED: { label: "Hedged", className: "bg-green-50 text-green-700 border-green-200" },
  UNHEDGED: { label: "Unhedged", className: "bg-orange-50 text-orange-700 border-orange-200" },
  NO_EXPOSURE: { label: "No Exposure", className: "bg-gray-100 text-gray-500 border-gray-200" },
}

export function UpcomingExposuresTable({ exposures, trades }: Props) {
  // Build a set of hedged exposure currencies from active trades
  const hedgedCurrencies = new Set(
    trades.filter((t) => t.status === "ACTIVE").map((t) => t.currencyPair)
  )

  const rows = exposures.map((exp) => {
    const isHedged = hedgedCurrencies.has(exp.currency + "MXN") || hedgedCurrencies.has("USD" + exp.currency)
    return {
      ...exp,
      displayHedgingStatus: isHedged ? "HEDGED" : exp.hedgingStatus,
    }
  })

  if (rows.length === 0) {
    return (
      <div className="px-5 py-10 text-center text-sm text-gray-400">
        No upcoming exposures. Upload exposures to get started.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Date</th>
            <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wide">Amount</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Currency</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Counterparty</th>
            <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">Hedging Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const badge = hedgingBadge[row.displayHedgingStatus]
            const sign = row.direction === "RECEIVE" ? "+" : "-"
            const signColor = row.direction === "RECEIVE" ? "text-green-600" : "text-gray-900"
            return (
              <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3.5 text-gray-600">
                  {format(new Date(row.settlementDate), "dd/MM/yy")}
                </td>
                <td className={`px-5 py-3.5 text-right font-medium tabular-nums ${signColor}`}>
                  {sign}{Number(row.amount).toLocaleString()}
                </td>
                <td className="px-5 py-3.5 text-gray-900 font-medium">{row.currency}</td>
                <td className="px-5 py-3.5 text-gray-600">{row.counterparty ?? "—"}</td>
                <td className="px-5 py-3.5">
                  <Badge variant="outline" className={badge.className}>
                    {badge.label}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="px-5 py-2.5 border-t text-xs text-gray-400 text-right">
        Rows 1 to {rows.length} of {rows.length}
      </div>
    </div>
  )
}
