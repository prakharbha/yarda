"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Download } from "lucide-react"
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

export function ForwardsWallet({ initialTrades, providers }: Props) {
  const [trades, setTrades] = useState<TradeRow[]>(initialTrades)
  const [addOpen, setAddOpen] = useState(false)

  const handleAdd = (trade: TradeRow) => {
    setTrades((prev) => [trade, ...prev])
    setAddOpen(false)
    toast.success("Forward added.")
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/trades/${id}`, { method: "DELETE" })
    if (res.ok) {
      setTrades((prev) => prev.filter((t) => t.id !== id))
      toast.success("Forward deleted.")
    } else {
      toast.error("Failed to delete forward.")
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
      toast.success("Forward updated.")
    } else {
      toast.error("Failed to update forward.")
    }
  }

  const exportCSV = () => {
    const header = ["Trade Date", "Settlement Date", "Currency Pair", "Direction", "Notional", "Forward Rate", "Status", "Provider", "Notes"]
    const rows = trades.map((t) => [
      t.tradeDate ? format(new Date(t.tradeDate), "yyyy-MM-dd") : "",
      format(new Date(t.settlementDate), "yyyy-MM-dd"),
      t.currencyPair,
      t.direction,
      t.notional,
      t.rate ?? "",
      t.status,
      t.provider?.name ?? "",
      t.notes ?? "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    const csv = [header.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `forwards-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary stats
  const active = trades.filter((t) => t.status === "ACTIVE")
  const totalByPair: Record<string, { buy: number; sell: number }> = {}
  for (const t of active) {
    if (!totalByPair[t.currencyPair]) totalByPair[t.currencyPair] = { buy: 0, sell: 0 }
    if (t.direction === "BUY") totalByPair[t.currencyPair].buy += Number(t.notional)
    else totalByPair[t.currencyPair].sell += Number(t.notional)
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Forwards Wallet</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {active.length} active forward{active.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {trades.length > 0 && (
            <Button size="sm" variant="outline" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
          )}
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add forward
          </Button>
        </div>
      </div>

      {Object.keys(totalByPair).length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(totalByPair).map(([pair, { buy, sell }]) => (
            <div key={pair} className="bg-white rounded-xl border px-4 py-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{pair}</p>
              <div className="mt-1 space-y-0.5">
                {buy > 0 && (
                  <p className="text-sm font-semibold text-blue-600">
                    Buy {buy.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
                )}
                {sell > 0 && (
                  <p className="text-sm font-semibold text-red-600">
                    Sell {sell.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </p>
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
        tradeType="FORWARD"
        providers={providers}
      />
    </div>
  )
}
