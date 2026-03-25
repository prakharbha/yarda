import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"

// Fetch Banxico USD/MXN FIX spot rate
async function fetchUsdMxnBanxico(): Promise<number | null> {
  const token = process.env.BANXICO_API_TOKEN
  if (!token) return null
  try {
    const res = await fetch(
      "https://www.banxico.org.mx/SieAPIRest/service/v1/series/SF43718/datos",
      { headers: { "Bmx-Token": token }, next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const payload = await res.json()
    const datos: { fecha: string; dato: string }[] = payload?.bmx?.series?.[0]?.datos ?? []
    for (let i = datos.length - 1; i >= 0; i--) {
      const v = String(datos[i].dato ?? "").trim()
      if (v && !["N/E", "null", "None"].includes(v)) {
        return parseFloat(v.replace(",", ""))
      }
    }
  } catch {}
  return null
}

// Fetch CURRENCY/USD rates from Twelve Data for a list of currencies
// Returns map of { "EUR": 1.0854, "GBP": 1.2671, ... }
async function fetchCurrencyUsdRates(currencies: string[], apiKey: string): Promise<Record<string, number>> {
  if (currencies.length === 0) return {}

  const symbols = currencies.map((c) => `${c}/USD`).join(",")
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbols)}&apikey=${apiKey}`,
    { next: { revalidate: 300 } }
  )
  if (!res.ok) throw new Error(`Twelve Data error: ${res.status}`)

  const data = await res.json()
  const result: Record<string, number> = {}

  if (currencies.length === 1) {
    // Single symbol: response is { "price": "1.0854" }
    if (data.price) result[currencies[0]] = parseFloat(data.price)
  } else {
    // Multiple symbols: response is { "EUR/USD": { "price": "1.0854" }, ... }
    for (const c of currencies) {
      const entry = data[`${c}/USD`]
      if (entry?.price) result[c] = parseFloat(entry.price)
    }
  }

  return result
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const currenciesParam = searchParams.get("currencies") ?? ""
  const currencies = currenciesParam.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean)

  if (currencies.length === 0) {
    return NextResponse.json({ rates: {}, usdMxn: null })
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: "TWELVE_DATA_API_KEY not configured" }, { status: 502 })
  }

  try {
    // Step 1: Get USD/MXN — try Banxico first, fall back to Twelve Data
    let usdMxn = await fetchUsdMxnBanxico()

    if (!usdMxn) {
      const fallback = await fetchCurrencyUsdRates(["MXN"], apiKey)
      // MXN/USD = 1/USD_MXN, so USD/MXN = 1/(MXN/USD)
      if (fallback["MXN"]) usdMxn = 1 / fallback["MXN"]
    }

    if (!usdMxn) {
      return NextResponse.json({ error: "Could not fetch USD/MXN rate" }, { status: 502 })
    }

    const today = new Date().toISOString().split("T")[0]
    const rates: Record<string, { rateToBase: number; rateToUsd: number; date: string }> = {}

    // MXN is the base — rate to itself is 1
    if (currencies.includes("MXN")) {
      rates["MXN"] = { rateToBase: 1, rateToUsd: 1 / usdMxn, date: today }
    }

    // USD → MXN is just the Banxico FIX
    if (currencies.includes("USD")) {
      rates["USD"] = { rateToBase: usdMxn, rateToUsd: 1, date: today }
    }

    // All other currencies: fetch CURRENCY/USD from Twelve Data, then cross with USD/MXN
    const foreign = currencies.filter((c) => c !== "MXN" && c !== "USD")
    if (foreign.length > 0) {
      const currencyToUsd = await fetchCurrencyUsdRates(foreign, apiKey)
      for (const c of foreign) {
        const toUsd = currencyToUsd[c]
        if (toUsd !== undefined) {
          rates[c] = { rateToBase: toUsd * usdMxn, rateToUsd: toUsd, date: today }
        }
      }
    }

    return NextResponse.json({ rates, usdMxn, baseCurrency: "MXN" })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch rates"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
