import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const TWELVE_DATA_BASE = "https://api.twelvedata.com"

// Central-bank overnight/short-term rates, approximate March 2026.
// These are policy rates that change infrequently — updated here manually as needed.
const POLICY_RATES: Record<string, number> = {
  MXN: 0.090,   // Banxico TIIE ~9.0%
  USD: 0.0433,  // SOFR ~4.33%
  EUR: 0.025,   // ECB ESTR ~2.5%
  GBP: 0.045,   // BOE SONIA ~4.5%
  JPY: 0.005,   // BOJ ~0.5%
  CAD: 0.030,   // BOC CORRA ~3.0%
  CHF: 0.005,   // SNB SARON ~0.5%
  AUD: 0.041,   // RBA AONIA ~4.1%
  NZD: 0.035,   // RBNZ ~3.5%
  SEK: 0.025,   // Riksbank ~2.5%
  NOK: 0.045,   // Norges Bank ~4.5%
  DKK: 0.025,   // DN ~2.5%
  BRL: 0.1475,  // BCB SELIC ~14.75%
  COP: 0.105,   // BanRep IBR ~10.5%
  CLP: 0.050,   // BCCh ~5.0%
  PEN: 0.0475,  // BCRP ~4.75%
  CNY: 0.020,   // PBoC LPR ~2.0%
  HKD: 0.043,   // HKMA (pegged to USD) ~4.3%
  SGD: 0.035,   // MAS ~3.5%
  INR: 0.0625,  // RBI repo ~6.25%
}

async function fetchPairData(symbol: string, apiKey: string) {
  const [priceRes, historyRes] = await Promise.all([
    fetch(`${TWELVE_DATA_BASE}/price?symbol=${symbol}&apikey=${apiKey}`, {
      next: { revalidate: 300 },
    }),
    fetch(
      `${TWELVE_DATA_BASE}/time_series?symbol=${symbol}&interval=1day&outputsize=300&apikey=${apiKey}`,
      { next: { revalidate: 3600 } }
    ),
  ])

  if (!priceRes.ok) throw new Error(`Twelve Data price error ${priceRes.status} for ${symbol}`)
  if (!historyRes.ok) throw new Error(`Twelve Data history error ${historyRes.status} for ${symbol}`)

  const priceData = await priceRes.json()
  const historyData = await historyRes.json()

  if (!priceData.price) {
    throw new Error(priceData.message ?? `Could not fetch spot for ${symbol}`)
  }

  const spot = parseFloat(priceData.price)
  const today = new Date().toISOString().split("T")[0]

  const values: { datetime: string; close: string }[] = historyData.values ?? []
  const spotHistory = values
    .map((v) => ({ date: v.datetime, spot: parseFloat(v.close) }))
    .filter((v) => !isNaN(v.spot))
    .reverse() // ascending chronological order

  return { spot, date: today, spotHistory }
}

// GET /api/market?foreign=EUR&local=MXN
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 502 })

  const { searchParams } = new URL(req.url)
  const foreign = (searchParams.get("foreign") ?? "USD").toUpperCase()
  const local = (searchParams.get("local") ?? "MXN").toUpperCase()

  if (foreign === local) {
    return NextResponse.json({ error: "Foreign and local currencies must differ" }, { status: 400 })
  }

  const symbol = `${foreign}/${local}`

  try {
    const { spot, date, spotHistory } = await fetchPairData(symbol, apiKey)

    const rForeign = POLICY_RATES[foreign] ?? 0.04
    const rLocal = POLICY_RATES[local] ?? 0.04

    return NextResponse.json({
      symbol,
      spot: { value: spot, date },
      rForeign: { value: rForeign, currency: foreign, date },
      rLocal: { value: rLocal, currency: local, date },
      spotHistory,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch market data"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
