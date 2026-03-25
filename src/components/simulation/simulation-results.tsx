"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"

interface PricingData {
  spotDisplay: number
  forwardRate: number
  forwardPoints: number
  mxnRate: number
  usdRate: number
  calendarDays: number
  tenorTradingDays: number
  baselineCost: number
}

interface StrategyStats {
  worst: number
  best: number
  average: number
  p5: number
  p95: number
  median: number
}

interface SimulationOutput {
  pricing: PricingData
  summary: Record<string, StrategyStats>
  distributionData: Record<string, number[]>
  scenarioCount: number
  localCurrency: string
  notional: number
  hedgeRatios: number[]
}

interface Props {
  result: SimulationOutput
  direction: string
  foreignCurrency: string
  settlementDate: string
}

const STRATEGY_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"]

function formatNumber(n: number, currency: string) {
  return `${n >= 0 ? "+" : ""}${Math.round(n).toLocaleString("en-US")} ${currency}`
}

function buildHistogramData(values: number[], bins = 40): { bin: string; count: number; midpoint: number }[] {
  if (!values.length) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const binSize = range / bins

  const counts = Array(bins).fill(0)
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / binSize))
    counts[idx]++
  }

  return counts.map((count, i) => ({
    bin: `${Math.round(min + i * binSize).toLocaleString()}`,
    midpoint: min + (i + 0.5) * binSize,
    count,
  }))
}

export function SimulationResults({ result, direction, foreignCurrency, settlementDate }: Props) {
  const { pricing, summary, distributionData, scenarioCount, localCurrency, notional, hedgeRatios } = result
  const [saving, setSaving] = useState(false)

  const saveAsDraftForward = async () => {
    setSaving(true)
    try {
      const currencyPair = direction === "pay"
        ? `${foreignCurrency}${localCurrency}`
        : `${localCurrency}${foreignCurrency}`
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeType: "FORWARD",
          currencyPair,
          direction: direction === "pay" ? "BUY" : "SELL",
          notional,
          rate: pricing.forwardRate,
          settlementDate,
          status: "DRAFT",
          notes: `Draft from simulation. Forward rate: ${pricing.forwardRate.toFixed(4)}`,
        }),
      })
      if (res.ok) {
        toast.success("Draft forward saved to Forwards Wallet.")
      } else {
        toast.error("Failed to save draft forward.")
      }
    } catch {
      toast.error("Unexpected error saving draft.")
    } finally {
      setSaving(false)
    }
  }

  const strategyLabel = (key: string) => {
    const ratio = parseInt(key)
    return ratio === 0 ? "Unhedged" : `${ratio}% Hedged`
  }

  // Build histogram for distribution chart
  const histogramsByStrategy = hedgeRatios.map((ratio, idx) => {
    const key = String(Math.round(ratio * 100))
    const values = distributionData[key] ?? []
    const hist = buildHistogramData(values, 30)
    return { key, label: strategyLabel(key), hist, color: STRATEGY_COLORS[idx % STRATEGY_COLORS.length] }
  })

  const downloadCSV = () => {
    const header = ["Strategy", "Worst Case", "P5", "Median", "Average", "P95", "Best Case"]
    const rows = hedgeRatios.map((ratio) => {
      const key = String(Math.round(ratio * 100))
      const s = summary[key]
      return [strategyLabel(key), s.worst, s.p5, s.median, s.average, s.p95, s.best].join(",")
    })
    const csv = [header.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "simulation-results.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  // Summary table data
  const summaryRows = hedgeRatios.map((ratio, idx) => {
    const key = String(Math.round(ratio * 100))
    const stats = summary[key]
    return { key, label: strategyLabel(key), stats, color: STRATEGY_COLORS[idx % STRATEGY_COLORS.length] }
  })

  // For the combined bar chart: bins from the first strategy (unhedged) used as x-axis reference
  const firstHist = histogramsByStrategy[0]?.hist ?? []

  return (
    <div className="space-y-5">
      {/* Pricing details */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Pricing Details</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: `Spot Reference`, value: pricing.spotDisplay.toFixed(4) },
            { label: `Synthetic Forward`, value: pricing.forwardRate.toFixed(4) },
            { label: "Forward Points", value: pricing.forwardPoints.toFixed(4) },
            { label: "Calendar Days", value: String(pricing.calendarDays) },
            { label: "Implied MXN Rate", value: `${pricing.mxnRate.toFixed(4)}%` },
            { label: "USD Rate (SOFR)", value: `${pricing.usdRate.toFixed(4)}%` },
          ].map((item) => (
            <div key={item.label} className="space-y-0.5">
              <p className="text-xs text-gray-500">{item.label}</p>
              <p className="text-base font-semibold text-gray-900 font-mono">{item.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            Hedge recommendation: to fully hedge, your company should{" "}
            <strong>{direction === "pay" ? "buy" : "sell"}</strong>{" "}
            {Number(notional).toLocaleString()} {foreignCurrency} forward at{" "}
            <span className="font-mono">{pricing.forwardRate.toFixed(4)}</span>.
          </p>
          <Button size="sm" variant="outline" onClick={saveAsDraftForward} disabled={saving} className="ml-4 shrink-0 text-xs h-7">
            {saving ? "Saving..." : "Save as draft forward"}
          </Button>
        </div>
      </div>

      {/* Simulation details */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Simulation Summary</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{scenarioCount.toLocaleString()} historical scenarios · Banxico FIX history</span>
            <Button size="sm" variant="outline" onClick={downloadCSV} className="h-7 text-xs gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Download CSV
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left text-xs font-medium text-gray-500">Strategy</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">Worst Case</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">P5</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">Median</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">Average</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">P95</th>
                <th className="py-2 text-right text-xs font-medium text-gray-500">Best Case</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map(({ key, label, stats, color }) => (
                <tr key={key} className="border-b last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-medium text-gray-800">{label}</span>
                    </div>
                  </td>
                  {[stats.worst, stats.p5, stats.median, stats.average, stats.p95, stats.best].map((v, i) => (
                    <td key={i} className={`py-2.5 text-right font-mono text-xs ${v >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatNumber(v, localCurrency)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Distribution chart */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">PnL Distribution Across Strategies</h2>
        <p className="text-xs text-gray-400 mb-4">
          Distribution of P&L outcomes in {localCurrency} across {scenarioCount.toLocaleString()} historical scenarios.
          Positive = favorable vs. hedged baseline.
        </p>

        {histogramsByStrategy.map(({ key, label, hist, color }) => (
          <div key={key} className="mb-6">
            <p className="text-xs font-medium text-gray-600 mb-2">{label}</p>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hist} margin={{ top: 2, right: 4, left: 4, bottom: 2 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="bin" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis tick={{ fontSize: 9 }} width={28} />
                  <Tooltip
                    formatter={(value) => [Number(value), "Scenarios"]}
                    labelFormatter={(label) => `PnL ~${label} ${localCurrency}`}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <ReferenceLine x={firstHist[Math.floor(firstHist.length / 2)]?.bin} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Bar dataKey="count" fill={color} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>

      {/* Comparative summary bar chart */}
      {hedgeRatios.length > 1 && (
        <div className="bg-white rounded-xl border p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Strategy Comparison</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={summaryRows.map((r) => ({
                  strategy: r.label,
                  Worst: Math.round(r.stats.worst),
                  P5: Math.round(r.stats.p5),
                  Median: Math.round(r.stats.median),
                  Average: Math.round(r.stats.average),
                  P95: Math.round(r.stats.p95),
                  Best: Math.round(r.stats.best),
                }))}
                margin={{ top: 4, right: 16, left: 16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="strategy" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v) => [Number(v).toLocaleString(), localCurrency]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#94a3b8" />
                <Bar dataKey="Worst" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P5" fill="#f97316" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Median" fill="#6366f1" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Average" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P95" fill="#10b981" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Best" fill="#22c55e" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 pb-2">
        This simulation is illustrative only. Scenarios are generated from de-meaned historical USD/MXN spot moves
        (Banxico FIX, ~20 years). Past performance does not guarantee future results. Not financial advice.
      </p>
    </div>
  )
}
