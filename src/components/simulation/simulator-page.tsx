"use client"

import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SimulationResults } from "./simulation-results"

interface MarketData {
  symbol: string
  spot: { value: number; date: string }
  rForeign: { value: number; currency: string; date: string }
  rLocal: { value: number; currency: string; date: string }
  spotHistory: { date: string; spot: number }[]
}

interface SimulationOutput {
  pricing: {
    spotDisplay: number
    forwardRate: number
    forwardPoints: number
    rLocalPct: number
    rForeignPct: number
    calendarDays: number
    tenorTradingDays: number
    baselineCost: number
  }
  summary: Record<string, { worst: number; best: number; average: number; p5: number; p95: number; median: number }>
  distributionData: Record<string, number[]>
  scenarioCount: number
  localCurrency: string
  notional: number
  hedgeRatios: number[]
}

const HEDGE_RATIO_OPTIONS = [
  { value: 0, label: "0% (Unhedged)" },
  { value: 0.25, label: "25%" },
  { value: 0.5, label: "50%" },
  { value: 0.75, label: "75%" },
  { value: 1.0, label: "100% (Fully hedged)" },
]

const CURRENCIES = [
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "CHF", label: "CHF — Swiss Franc" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "NZD", label: "NZD — New Zealand Dollar" },
  { code: "SEK", label: "SEK — Swedish Krona" },
  { code: "NOK", label: "NOK — Norwegian Krone" },
  { code: "DKK", label: "DKK — Danish Krone" },
  { code: "MXN", label: "MXN — Mexican Peso" },
  { code: "BRL", label: "BRL — Brazilian Real" },
  { code: "COP", label: "COP — Colombian Peso" },
  { code: "CLP", label: "CLP — Chilean Peso" },
  { code: "PEN", label: "PEN — Peruvian Sol" },
  { code: "CNY", label: "CNY — Chinese Yuan" },
  { code: "HKD", label: "HKD — Hong Kong Dollar" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "INR", label: "INR — Indian Rupee" },
]

export function SimulatorPage() {
  const searchParams = useSearchParams()

  // Pre-fill from URL params if coming from Exposure Tracker
  const defaultDirection = (searchParams.get("direction") as "pay" | "receive") ?? "pay"
  const defaultCurrency = searchParams.get("currency") ?? "USD"
  const defaultNotional = searchParams.get("notional") ?? "1000000"
  const defaultSettlement = searchParams.get("settlement") ?? (() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split("T")[0]
  })()

  const [direction, setDirection] = useState<"pay" | "receive">(defaultDirection)
  const [foreignCurrency, setForeignCurrency] = useState(defaultCurrency)
  const [localCurrency, setLocalCurrency] = useState("MXN")
  const [notional, setNotional] = useState(defaultNotional)
  const [settlementDate, setSettlementDate] = useState(defaultSettlement)
  const [selectedRatios, setSelectedRatios] = useState<number[]>([0, 0.5, 1.0])

  // Re-apply URL params if they change (navigation from exposure)
  useEffect(() => {
    const dir = searchParams.get("direction") as "pay" | "receive" | null
    const cur = searchParams.get("currency")
    const not = searchParams.get("notional")
    const set = searchParams.get("settlement")
    if (dir) setDirection(dir)
    if (cur) setForeignCurrency(cur)
    if (not) setNotional(not)
    if (set) setSettlementDate(set)
  }, [searchParams])

  // Clear market data whenever the currency pair changes
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  const [marketLoading, setMarketLoading] = useState(false)
  const [marketError, setMarketError] = useState<string | null>(null)
  const [simResult, setSimResult] = useState<SimulationOutput | null>(null)
  const [simLoading, setSimLoading] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  const handleForeignChange = (v: string) => {
    setForeignCurrency(v)
    setMarketData(null)
    setSimResult(null)
  }

  const handleLocalChange = (v: string) => {
    setLocalCurrency(v)
    setMarketData(null)
    setSimResult(null)
  }

  const fetchMarketData = async () => {
    if (foreignCurrency === localCurrency) {
      setMarketError("Foreign and local currencies must differ.")
      return
    }
    setMarketLoading(true)
    setMarketError(null)
    setSimResult(null)
    try {
      const res = await fetch(`/api/market?foreign=${foreignCurrency}&local=${localCurrency}`)
      if (!res.ok) {
        const data = await res.json()
        setMarketError(data.error ?? "Failed to fetch market data.")
        return
      }
      const data: MarketData = await res.json()
      setMarketData(data)
    } catch {
      setMarketError("Network error fetching market data.")
    } finally {
      setMarketLoading(false)
    }
  }

  const runSimulation = async () => {
    if (!marketData) return
    if (!notional || isNaN(Number(notional)) || Number(notional) <= 0) {
      setSimError("Enter a valid notional amount.")
      return
    }
    if (!settlementDate) {
      setSimError("Select a settlement date.")
      return
    }
    if (selectedRatios.length === 0) {
      setSimError("Select at least one hedge ratio.")
      return
    }
    setSimLoading(true)
    setSimError(null)
    try {
      const res = await fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction,
          foreignCurrency,
          localCurrency,
          notional: Number(notional),
          settlementDate,
          hedgeRatios: selectedRatios,
          spot: marketData.spot.value,
          rForeign: marketData.rForeign.value,
          rLocal: marketData.rLocal.value,
          spotHistory: marketData.spotHistory,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSimError(data.error ?? "Simulation failed.")
        return
      }
      setSimResult(data)
    } catch {
      setSimError("Unexpected error running simulation.")
    } finally {
      setSimLoading(false)
    }
  }

  const toggleRatio = (ratio: number) => {
    setSelectedRatios((prev) =>
      prev.includes(ratio) ? prev.filter((r) => r !== ratio) : [...prev, ratio].sort((a, b) => a - b)
    )
  }

  // Options for local currency dropdown (exclude selected foreign)
  const localOptions = CURRENCIES.filter((c) => c.code !== foreignCurrency)
  // Options for foreign currency dropdown (exclude selected local)
  const foreignOptions = CURRENCIES.filter((c) => c.code !== localCurrency)

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">FX Hedge Simulator</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Illustrative tool. Spot rates via Twelve Data · Interest rates are estimated.
        </p>
      </div>

      {/* Input form */}
      <div className="bg-white rounded-xl border p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-700">Tell us about your exposure</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">My business will...</Label>
            <Select value={direction} onValueChange={(v) => v && setDirection(v as "pay" | "receive")}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pay">Pay</SelectItem>
                <SelectItem value="receive">Receive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Foreign currency</Label>
            <Select value={foreignCurrency} onValueChange={(v) => v && handleForeignChange(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {foreignOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Local currency</Label>
            <Select value={localCurrency} onValueChange={(v) => v && handleLocalChange(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {localOptions.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Settlement date</Label>
            <Input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Notional ({foreignCurrency})</Label>
            <Input
              type="number"
              min="1000"
              step="1000"
              value={notional}
              onChange={(e) => setNotional(e.target.value)}
              className="h-9"
              placeholder="1,000,000"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Hedge ratios to compare</Label>
          <div className="flex flex-wrap gap-2">
            {HEDGE_RATIO_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleRatio(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors
                  ${selectedRatios.includes(value)
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={fetchMarketData}
            variant="outline"
            size="sm"
            disabled={marketLoading}
          >
            {marketLoading ? "Fetching..." : marketData ? `Refresh ${foreignCurrency}/${localCurrency}` : `Load ${foreignCurrency}/${localCurrency} data`}
          </Button>
          <Button
            onClick={runSimulation}
            size="sm"
            disabled={!marketData || simLoading}
          >
            {simLoading ? "Simulating..." : "What will a hedge look like?"}
          </Button>
        </div>

        {/* Plain-English summary of inputs */}
        {notional && settlementDate && (
          <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
            Your business will{" "}
            <strong>{direction === "pay" ? "pay" : "receive"}</strong>{" "}
            <strong>{Number(notional).toLocaleString()} {foreignCurrency}</strong>{" "}
            in exchange for <strong>{localCurrency}</strong> on{" "}
            <strong>{new Date(settlementDate + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong>.
            {!marketData && ` Click "Load ${foreignCurrency}/${localCurrency} data" to run the simulation.`}
          </p>
        )}

        {marketError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <span className="text-red-500 text-base leading-none mt-0.5">⚠</span>
            <p className="text-xs text-red-700">{marketError}</p>
          </div>
        )}
        {simError && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
            <span className="text-red-500 text-base leading-none mt-0.5">⚠</span>
            <p className="text-xs text-red-700">{simError}</p>
          </div>
        )}
      </div>

      {/* Market data snapshot */}
      {marketData && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Market Data Snapshot — <span className="text-gray-500 font-normal">{marketData.symbol}</span>
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: `${marketData.symbol} Spot`, value: marketData.spot.value.toFixed(4), date: marketData.spot.date },
              { label: `${marketData.rForeign.currency} Rate (est.)`, value: `${(marketData.rForeign.value * 100).toFixed(2)}%`, date: marketData.rForeign.date },
              { label: `${marketData.rLocal.currency} Rate (est.)`, value: `${(marketData.rLocal.value * 100).toFixed(2)}%`, date: marketData.rLocal.date },
              { label: "History points", value: String(marketData.spotHistory.length), date: `from ${marketData.spotHistory[0]?.date ?? "—"}` },
            ].map((item) => (
              <div key={item.label} className="space-y-0.5">
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="text-lg font-semibold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-400">{item.date}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Simulation results */}
      {simResult && (
        <SimulationResults result={simResult} direction={direction} foreignCurrency={foreignCurrency} settlementDate={settlementDate} />
      )}
    </div>
  )
}
