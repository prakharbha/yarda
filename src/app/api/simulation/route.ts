import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { z } from "zod"

const TRADING_DAYS_PER_YEAR = 252
const DAYS_PER_YEAR = 365

function interpolateMxnRate(targetDays: number, tiie28Pct: number, tiie91Pct: number): number {
  const r28 = tiie28Pct / 100
  const r91 = tiie91Pct / 100
  if (targetDays <= 28) return r28
  if (targetDays >= 91) return r91
  // linear interpolation
  return r28 + (r91 - r28) * ((targetDays - 28) / (91 - 28))
}

function syntheticForward(spot: number, rMxn: number, rUsd: number, days: number, basis = 360): number {
  const tau = days / basis
  return spot * ((1 + rMxn * tau) / (1 + rUsd * tau))
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
  tiie28: z.number().positive(),
  tiie91: z.number().positive(),
  sofr: z.number(), // decimal
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
    tiie28,
    tiie91,
    sofr,
    spotHistory,
  } = parsed.data

  const today = new Date()
  const settleDate = new Date(settlementDate)
  const calendarDays = Math.max(1, Math.round((settleDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)))

  const mxnRate = interpolateMxnRate(calendarDays, tiie28, tiie91)
  const usdRate = sofr

  // Always compute forward for USD/MXN, then invert if pair is reversed
  const synForwardUsdMxn = syntheticForward(spotRef, mxnRate, usdRate, calendarDays, 360)

  let forwardRate: number
  let spotDisplay: number
  let forwardPoints: number
  const isUsdMxn = foreignCurrency === "USD" && localCurrency === "MXN"

  if (isUsdMxn) {
    forwardRate = synForwardUsdMxn
    spotDisplay = spotRef
    forwardPoints = synForwardUsdMxn - spotRef
  } else {
    forwardRate = 1 / synForwardUsdMxn
    spotDisplay = 1 / spotRef
    forwardPoints = forwardRate - spotDisplay
  }

  // Tenor in trading days
  const tenorTradingDays = Math.max(1, Math.round(calendarDays * (TRADING_DAYS_PER_YEAR / DAYS_PER_YEAR)))

  if (tenorTradingDays >= spotHistory.length) {
    return NextResponse.json(
      { error: `Not enough historical data (${spotHistory.length} records) for ${tenorTradingDays} trading days` },
      { status: 422 }
    )
  }

  // Generate scenarios using de-meaned historical moves
  const pctMoves: number[] = []
  for (let i = 0; i < spotHistory.length - tenorTradingDays; i++) {
    const startSpot = spotHistory[i].spot
    const endSpot = spotHistory[i + tenorTradingDays].spot
    // invert if MXN/USD
    const startS = isUsdMxn ? startSpot : 1 / startSpot
    const endS = isUsdMxn ? endSpot : 1 / endSpot
    pctMoves.push(endS / startS - 1)
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

    // Cash impact in local currency
    const unhedgedLocal = direction === "pay"
      ? notional * simSpot  // paying foreign, cost in local
      : notional * simSpot  // receiving foreign, proceeds in local

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
    const p5Index = Math.floor(n * 0.05)
    const p95Index = Math.floor(n * 0.95)
    const medianIndex = Math.floor(n / 2)
    summary[key] = {
      worst: pnlValues[0],
      best: pnlValues[n - 1],
      average: pnlValues.reduce((a, b) => a + b, 0) / n,
      p5: pnlValues[p5Index],
      p95: pnlValues[p95Index],
      median: pnlValues[medianIndex],
    }
  }

  // Distribution data for violin/density chart (sampled to limit payload)
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
      mxnRate: parseFloat((mxnRate * 100).toFixed(4)),
      usdRate: parseFloat((usdRate * 100).toFixed(4)),
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
