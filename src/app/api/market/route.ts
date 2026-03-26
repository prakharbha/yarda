import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

const TWELVE_DATA_BASE = "https://api.twelvedata.com"

async function fetchSpotAndHistory(apiKey: string): Promise<{
  spot: number
  date: string
  spotHistory: { date: string; spot: number }[]
}> {
  const [priceRes, historyRes] = await Promise.all([
    fetch(`${TWELVE_DATA_BASE}/price?symbol=USD/MXN&apikey=${apiKey}`, {
      next: { revalidate: 300 },
    }),
    fetch(`${TWELVE_DATA_BASE}/time_series?symbol=USD/MXN&interval=1day&outputsize=300&apikey=${apiKey}`, {
      next: { revalidate: 3600 },
    }),
  ])

  if (!priceRes.ok) throw new Error(`Twelve Data price error: ${priceRes.status}`)
  if (!historyRes.ok) throw new Error(`Twelve Data time_series error: ${historyRes.status}`)

  const priceData = await priceRes.json()
  const historyData = await historyRes.json()

  if (!priceData.price) throw new Error(priceData.message ?? "Could not fetch USD/MXN spot")

  const spot = parseFloat(priceData.price)
  const today = new Date().toISOString().split("T")[0]

  const values: { datetime: string; close: string }[] = historyData.values ?? []
  const spotHistory = values
    .map((v) => ({ date: v.datetime, spot: parseFloat(v.close) }))
    .filter((v) => !isNaN(v.spot))
    .reverse() // ascending order

  return { spot, date: today, spotHistory }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 502 })

  try {
    const { spot, date, spotHistory } = await fetchSpotAndHistory(apiKey)

    // TIIE and SOFR: not available on Twelve Data free tier.
    // These are central-bank policy rates that change infrequently.
    // Values reflect current market approximations (updated manually as needed).
    const tiie28 = { value: 9.0, date }   // Banxico TIIE 28d ~9.0% (March 2026)
    const tiie91 = { value: 9.1, date }   // Banxico TIIE 91d ~9.1% (March 2026)
    const sofr   = { value: 0.0433, date } // SOFR ~4.33% (March 2026)

    return NextResponse.json({
      spot: { value: spot, date },
      tiie28,
      tiie91,
      sofr,
      spotHistory,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch market data"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
