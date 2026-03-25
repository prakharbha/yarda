"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, RefreshCw, Trash2, Check, X } from "lucide-react"
import { ForwardsTable } from "./forwards-table"
import { AddTradeDialog } from "./add-trade-dialog"
import { toast } from "sonner"
import { format, addMonths, startOfMonth } from "date-fns"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface CurrencyBalance {
  id: string
  currency: string
  balance: string
}

interface RateEntry {
  rateToBase: number
  rateToUsd: number
  date: string
}

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
  initialBalances: CurrencyBalance[]
}

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "MXN", "BRL", "COP", "CLP", "CNY", "CAD"]

export function SpotsWallet({ initialTrades, providers, initialBalances }: Props) {
  const [trades, setTrades] = useState<TradeRow[]>(initialTrades)
  const [addOpen, setAddOpen] = useState(false)

  // Currency balance state
  const [balances, setBalances] = useState<CurrencyBalance[]>(initialBalances)
  const [rates, setRates] = useState<Record<string, RateEntry>>({})
  const [ratesLoading, setRatesLoading] = useState(false)
  const [ratesError, setRatesError] = useState<string | null>(null)
  const [ratesFetched, setRatesFetched] = useState(false)

  // Add currency form
  const [addCurrency, setAddCurrency] = useState("")
  const [addBalance, setAddBalance] = useState("")
  const [addingCurrency, setAddingCurrency] = useState(false)

  // Inline balance editing
  const [editingCurrency, setEditingCurrency] = useState<string | null>(null)
  const [editBalanceVal, setEditBalanceVal] = useState("")

  const fetchRates = useCallback(async (currencyList: string[]) => {
    if (currencyList.length === 0) return
    setRatesLoading(true)
    setRatesError(null)
    try {
      const res = await fetch(`/api/market/rates?currencies=${currencyList.join(",")}`)
      const data = await res.json()
      if (!res.ok) {
        setRatesError(data.error ?? "Failed to fetch rates")
        return
      }
      setRates(data.rates ?? {})
      setRatesFetched(true)
    } catch {
      setRatesError("Network error fetching rates")
    } finally {
      setRatesLoading(false)
    }
  }, [])

  const refreshRates = () => {
    const currencies = balances.map((b) => b.currency)
    if (currencies.length > 0) fetchRates(currencies)
  }

  const addCurrencyBalance = async () => {
    if (!addCurrency.trim() || !addBalance || isNaN(Number(addBalance))) return
    setAddingCurrency(true)
    try {
      const res = await fetch("/api/balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency: addCurrency.toUpperCase().trim(), balance: Number(addBalance) }),
      })
      if (res.ok) {
        const created: CurrencyBalance = await res.json()
        setBalances((prev) => {
          const existing = prev.find((b) => b.currency === created.currency)
          if (existing) return prev.map((b) => (b.currency === created.currency ? created : b))
          return [...prev, created]
        })
        // Fetch rate for the new currency
        fetchRates([...balances.map((b) => b.currency), created.currency])
        setAddCurrency("")
        setAddBalance("")
        toast.success(`${created.currency} balance added.`)
      } else {
        toast.error("Failed to add currency.")
      }
    } catch {
      toast.error("Unexpected error.")
    } finally {
      setAddingCurrency(false)
    }
  }

  const saveEditBalance = async (currency: string) => {
    if (!editBalanceVal || isNaN(Number(editBalanceVal))) return
    const res = await fetch("/api/balances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency, balance: Number(editBalanceVal) }),
    })
    if (res.ok) {
      const updated: CurrencyBalance = await res.json()
      setBalances((prev) => prev.map((b) => (b.currency === currency ? updated : b)))
      toast.success("Balance updated.")
    } else {
      toast.error("Failed to update balance.")
    }
    setEditingCurrency(null)
    setEditBalanceVal("")
  }

  const deleteCurrencyBalance = async (currency: string) => {
    const res = await fetch(`/api/balances/${currency}`, { method: "DELETE" })
    if (res.ok) {
      setBalances((prev) => prev.filter((b) => b.currency !== currency))
      toast.success(`${currency} removed.`)
    } else {
      toast.error("Failed to remove currency.")
    }
  }

  // Total balance in MXN
  const totalMxn = balances.reduce((sum, b) => {
    const rate = rates[b.currency]?.rateToBase
    if (rate === undefined) return sum
    return sum + Number(b.balance) * rate
  }, 0)
  const hasAllRates = balances.length > 0 && balances.every((b) => rates[b.currency] !== undefined)

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

  // Build wallet value chart: 12 months back + 6 months forward
  const chartData = (() => {
    const now = new Date()
    const months: { label: string; date: Date }[] = []
    for (let i = -12; i <= 6; i++) {
      const d = startOfMonth(addMonths(now, i))
      months.push({ label: format(d, "MMM yy"), date: d })
    }
    return months.map(({ label, date }) => {
      const isFuture = date > now
      const walletValue = trades
        .filter((t) => t.status === "ACTIVE" && new Date(t.settlementDate) <= addMonths(date, 1))
        .reduce((sum, t) => sum + (t.direction === "BUY" ? Number(t.notional) : -Number(t.notional)), 0)
      const projected = trades
        .filter((t) => ["ACTIVE", "DRAFT", "PENDING_QUOTE"].includes(t.status) && new Date(t.settlementDate) <= addMonths(date, 1))
        .reduce((sum, t) => sum + (t.direction === "BUY" ? Number(t.notional) : -Number(t.notional)), 0)
      const unhedged = trades
        .filter((t) => t.status === "DRAFT" && new Date(t.settlementDate) <= addMonths(date, 1))
        .reduce((sum, t) => sum + (t.direction === "BUY" ? Number(t.notional) : -Number(t.notional)), 0)
      return {
        label,
        ...(isFuture ? {} : { "Wallet Value": walletValue }),
        Projected: projected,
        "Unhedged Exposure": unhedged,
      }
    })
  })()

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

      {/* Currency Balances */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Currencies</h2>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={refreshRates}
            disabled={ratesLoading || balances.length === 0}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${ratesLoading ? "animate-spin" : ""}`} />
            {ratesLoading ? "Fetching rates..." : ratesFetched ? "Refresh rates" : "Load rates"}
          </Button>
        </div>

        {ratesError && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            ⚠ {ratesError}
          </p>
        )}

        {balances.length === 0 ? (
          <p className="text-sm text-gray-400">No currencies added yet. Add a currency balance below.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {balances.map((b) => {
              const rate = rates[b.currency]
              const mxnEquiv = rate ? Number(b.balance) * rate.rateToBase : null
              const isEditing = editingCurrency === b.currency
              return (
                <div key={b.currency} className="border rounded-xl px-4 py-3 space-y-1.5 group relative">
                  <div className="flex items-start justify-between">
                    <p className="text-sm font-semibold text-gray-900">{b.currency}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-opacity"
                      onClick={() => deleteCurrencyBalance(b.currency)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={editBalanceVal}
                        onChange={(e) => setEditBalanceVal(e.target.value)}
                        className="h-6 text-xs px-1.5 w-24"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEditBalance(b.currency)
                          if (e.key === "Escape") { setEditingCurrency(null); setEditBalanceVal("") }
                        }}
                      />
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-green-600" onClick={() => saveEditBalance(b.currency)}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-gray-400" onClick={() => { setEditingCurrency(null); setEditBalanceVal("") }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <p
                      className="text-base font-medium text-gray-800 cursor-pointer hover:text-indigo-600 transition-colors"
                      onClick={() => { setEditingCurrency(b.currency); setEditBalanceVal(b.balance) }}
                      title="Click to edit"
                    >
                      {Number(b.balance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}

                  <div className="space-y-0.5">
                    {rate ? (
                      <>
                        <p className="text-xs text-gray-400">Rate: <span className="font-mono text-gray-600">{rate.rateToBase.toFixed(4)}</span> MXN</p>
                        <p className="text-xs font-medium text-indigo-600">
                          ≈ {mxnEquiv!.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} MXN
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-300 italic">Rate not loaded</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Total balance */}
        {hasAllRates && (
          <div className="flex items-center justify-between border-t pt-3 mt-1">
            <span className="text-sm font-medium text-gray-700">Total Balance (MXN equiv.)</span>
            <span className="text-lg font-semibold text-gray-900">
              {totalMxn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN
            </span>
          </div>
        )}

        {/* Add currency row */}
        <div className="flex items-end gap-2 pt-1 border-t">
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Currency</p>
            <div className="relative">
              <Input
                value={addCurrency}
                onChange={(e) => setAddCurrency(e.target.value.toUpperCase())}
                placeholder="e.g. EUR"
                maxLength={4}
                className="h-8 w-24 text-xs"
                list="currency-suggestions"
              />
              <datalist id="currency-suggestions">
                {COMMON_CURRENCIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-gray-500">Balance</p>
            <Input
              type="number"
              value={addBalance}
              onChange={(e) => setAddBalance(e.target.value)}
              placeholder="0.00"
              className="h-8 w-36 text-xs"
              onKeyDown={(e) => e.key === "Enter" && addCurrencyBalance()}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            disabled={!addCurrency.trim() || !addBalance || addingCurrency}
            onClick={addCurrencyBalance}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* FX Wallet Value Over Time chart */}
      {trades.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">FX Wallet Value Over Time</h2>
          <p className="text-xs text-gray-400 mb-4">Cumulative notional in base currency. Projected includes draft and pending trades.</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={2} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [Number(v).toLocaleString("en-US", { maximumFractionDigits: 0 })]} contentStyle={{ fontSize: 11 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="Wallet Value" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="Projected" stroke="#10b981" strokeWidth={2} dot={false} strokeDasharray="4 2" connectNulls />
                <Line type="monotone" dataKey="Unhedged Exposure" stroke="#f59e0b" strokeWidth={2} dot={false} strokeDasharray="2 2" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Spot trades table */}
      <div className="bg-white rounded-xl border">
        <ForwardsTable
          trades={trades}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
          emptyMessage="No spot trades found."
          searchPlaceholder="Search spot trades..."
        />
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
