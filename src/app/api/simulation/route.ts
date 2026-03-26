import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"

const TRADING_DAYS_PER_YEAR = 252
const DAYS_PER_YEAR = 365

// Covered interest rate parity: Forward(FOREIGN/LOCAL) = Spot × (1 + rLocal×T) / (1 + rForeign×T)
function syntheticForward(spot: number, rLocal: number, rForeign: number, days: number, basis = 360): number {
  const tau = days / basis
  return spot * ((1 + rLocal * tau) / (1 + rForeign * tau))
}

const inputSchema = z.object({
  direction: z.enum(["pay", "receive"]),
  foreignCurrency: z.string(),
  localCurrency: z.string(),
  notional: z.number().positive(),
  settlementDate: z.string(),
  hedgeRatios: z.array(z.number().min(0).max(1)).min(1),
  // Market data (passed from client to avoid re-fetching)
  spot: z.number().positive(),
  rForeign: z.number(), // decimal, e.g. 0.0433 for 4.33%
  rLocal: z.number(),   // decimal, e.g. 0.09 for 9%
  spotHistory: z.array(z.object({ date: z.string(), spot: z.number() })),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const {
    direction,
    foreignCurrency,
    localCurrency,
    notional,
    settlementDate,
    hedgeRatios,
    spot: spotRef,
    rForeign,
    rLocal,
    spotHistory,
  } = parsed.data

  const today = new Date()
  const settleDate = new Date(settlementDate)
  const calendarDays = Math.max(1, Math.round((settleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  // spotRef and spotHistory are both FOREIGN/LOCAL — no inversion needed
  const forwardRate = syntheticForward(spotRef, rLocal, rForeign, calendarDays, 360)
  const spotDisplay = spotRef
  const forwardPoints = forwardRate - spotRef

  // Tenor in trading days
  const tenorTradingDays = Math.max(1, Math.round(calendarDays * (TRADING_DAYS_PER_YEAR / DAYS_PER_YEAR)))

  if (tenorTradingDays >= spotHistory.length) {
    return NextResponse.json(
      { error: `Not enough historical data (${spotHistory.length} records) for ${tenorTradingDays} trading days` },
      { status: 422 }
    )
  }

  // Generate scenarios using de-meaned historical moves on FOREIGN/LOCAL directly
  const pctMoves: number[] = []
  for (let i = 0; i < spotHistory.length - tenorTradingDays; i++) {
    const startSpot = spotHistory[i].spot
    const endSpot = spotHistory[i + tenorTradingDays].spot
    pctMoves.push(endSpot / startSpot - 1)
  }

  const meanMove = pctMoves.reduce((a, b) => a + b, 0) / pctMoves.length

  // Baseline cost for PnL calculation
  const baselineCost = notional * forwardRate

  interface ScenarioResult {
    simulatedSpot: number
    unhedgedLocal: number
    hedgedLocals: Record<string, number>
    pnls: Record<string, number>
  }

  const scenarios: ScenarioResult[] = pctMoves.map((pctMove) => {
    const demeanedMove = pctMove - meanMove
    const simSpot = forwardRate * (1 + demeanedMove)

    const unhedgedLocal = notional * simSpot

    const hedgedLocals: Record<string, number> = {}
    const pnls: Record<string, number> = {}

    for (const ratio of hedgeRatios) {
      const key = String(Math.round(ratio * 100))
      if (ratio === 0) {
        hedgedLocals[key] = unhedgedLocal
        pnls[key] = direction === "pay"
          ? baselineCost - unhedgedLocal
          : unhedgedLocal - baselineCost
      } else {
        const hedgedPortion = notional * ratio * forwardRate
        const unhedgedPortion = notional * (1 - ratio) * simSpot
        const total = hedgedPortion + unhedgedPortion
        hedgedLocals[key] = total
        pnls[key] = direction === "pay"
          ? baselineCost - total
          : total - baselineCost
      }
    }

    return { simulatedSpot: simSpot, unhedgedLocal, hedgedLocals, pnls }
  })

  // Summarize PnL per hedge ratio
  const summary: Record<string, { worst: number; best: number; average: number; p5: number; p95: number; median: number }> = {}

  for (const ratio of hedgeRatios) {
    const key = String(Math.round(ratio * 100))
    const pnlValues = scenarios.map((s) => s.pnls[key]).sort((a, b) => a - b)
    const n = pnlValues.length
    summary[key] = {
      worst: pnlValues[0],
      best: pnlValues[n - 1],
      average: pnlValues.reduce((a, b) => a + b, 0) / n,
      p5: pnlValues[Math.floor(n * 0.05)],
      p95: pnlValues[Math.floor(n * 0.95)],
      median: pnlValues[Math.floor(n / 2)],
    }
  }

  // Distribution data (sampled to limit payload)
  const MAX_POINTS = 1000
  const step = Math.max(1, Math.floor(scenarios.length / MAX_POINTS))
  const distributionData: Record<string, number[]> = {}
  for (const ratio of hedgeRatios) {
    const key = String(Math.round(ratio * 100))
    distributionData[key] = scenarios
      .filter((_, i) => i % step === 0)
      .map((s) => s.pnls[key])
  }

  return NextResponse.json({
    pricing: {
      spotDisplay: parseFloat(spotDisplay.toFixed(4)),
      forwardRate: parseFloat(forwardRate.toFixed(4)),
      forwardPoints: parseFloat(forwardPoints.toFixed(4)),
      rLocalPct: parseFloat((rLocal * 100).toFixed(2)),
      rForeignPct: parseFloat((rForeign * 100).toFixed(2)),
      calendarDays,
      tenorTradingDays,
      baselineCost: parseFloat(baselineCost.toFixed(2)),
    },
    summary,
    distributionData,
    scenarioCount: scenarios.length,
    localCurrency,
    notional,
    hedgeRatios,
  })
}
