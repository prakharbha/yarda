"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ForwardsTable } from "./forwards-table"
import { AddTradeDialog } from "./add-trade-dialog"
import { toast } from "sonner"
import { format } from "date-fns"

interface TradeRow {
  id: string
  tradeType: string
  currencyPair: string
  direction: string
  notional: string
  rate: string | null
  tradeDate: Date | string | null
  settlementDate: Date | string
  status: string
  notes: string | null
  provider: { id: string; name: string } | null
}

interface Provider {
  id: string
  name: string
}

interface Props {
  initialTrades: TradeRow[]
  providers: Provider[]
}

export function SpotsWallet({ initialTrades, providers }: Props) {
  const [trades, setTrades] = useState<TradeRow[]>(initialTrades)
  const [addOpen, setAddOpen] = useState(false)

  const handleAdd = (trade: TradeRow) => {
    setTrades((prev) => [trade, ...prev])
    setAddOpen(false)
    toast.success("Spot trade added.")
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" })
    if (res.ok) {
      setTrades((prev) => prev.filter((t) => t.id !== id))
      toast.success("Spot trade deleted.")
    } else {
      toast.error("Failed to delete spot trade.")
    }
  }

  const handleUpdate = async (id: string, data: Partial<TradeRow>) => {
    const res = await fetch(`/api/trades/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)))
      toast.success("Spot trade updated.")
    } else {
      toast.error("Failed to update spot trade.")
    }
  }

  // Group by currency pair for summary cards
  const summaryByPair: Record<string, { buy: number; sell: number; count: number; nextSettlement?: Date }> = {}
  for (const t of trades.filter((t) => t.status === "ACTIVE")) {
    if (!summaryByPair[t.currencyPair]) summaryByPair[t.currencyPair] = { buy: 0, sell: 0, count: 0 }
    summaryByPair[t.currencyPair].count++
    if (t.direction === "BUY") summaryByPair[t.currencyPair].buy += Number(t.notional)
    else summaryByPair[t.currencyPair].sell += Number(t.notional)
    const sd = new Date(t.settlementDate)
    const prev = summaryByPair[t.currencyPair].nextSettlement
    if (!prev || sd < prev) summaryByPair[t.currencyPair].nextSettlement = sd
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Spot Wallet</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {trades.filter((t) => t.status === "ACTIVE").length} active spot trade{trades.filter((t) => t.status === "ACTIVE").length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add spot trade
        </Button>
      </div>

      {Object.keys(summaryByPair).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(summaryByPair).map(([pair, data]) => (
            <div key={pair} className="bg-white rounded-xl border px-4 py-3">
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{pair}</p>
                <span className="text-xs text-gray-400">{data.count} trade{data.count !== 1 ? "s" : ""}</span>
              </div>
              <div className="mt-2 space-y-0.5">
                {data.buy > 0 && <p className="text-sm font-semibold text-blue-600">Buy {data.buy.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>}
                {data.sell > 0 && <p className="text-sm font-semibold text-red-600">Sell {data.sell.toLocaleString("en-US", { maximumFractionDigits: 0 })}</p>}
                {data.nextSettlement && (
                  <p className="text-xs text-gray-400 mt-1">Next: {format(data.nextSettlement, "MMM d")}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border">
        <ForwardsTable trades={trades} onDelete={handleDelete} onUpdate={handleUpdate} />
      </div>

      <AddTradeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
        tradeType="SPOT"
        providers={providers}
      />
    </div>
  )
}
