import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

async function fetchBanxicoSeries(seriesId: string) {
  const token = process.env.BANXICO_API_TOKEN
  if (!token) throw new Error("BANXICO_API_TOKEN not configured")

  const res = await fetch(
    `https://www.banxico.org.mx/SieAPIRest/service/v1/series/${seriesId}/datos`,
    {
      headers: { "Bmx-Token": token },
      next: { revalidate: 3600 },
    }
  )
  if (!res.ok) throw new Error(`Banxico API error: ${res.status}`)

  const payload = await res.json()
  const series = payload?.bmx?.series?.[0]
  if (!series) throw new Error(`No Banxico series found: ${seriesId}`)

  const datos: { fecha: string; dato: string }[] = series.datos ?? []

  // Get latest valid value
  let latestValid: { fecha: string; dato: string } | null = null
  for (let i = datos.length - 1; i >= 0; i--) {
    const dato = String(datos[i].dato ?? "").trim()
    if (dato && !["N/E", "null", "None"].includes(dato)) {
      latestValid = datos[i]
      break
    }
  }
  if (!latestValid) throw new Error(`No valid datapoints for Banxico ${seriesId}`)

  return {
    seriesId,
    title: series.titulo ?? seriesId,
    date: latestValid.fecha,
    value: parseFloat(latestValid.dato.replace(",", "")),
    rawData: datos,
  }
}

async function fetchFredLatest(seriesId: string) {
  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) throw new Error("FRED_API_KEY not configured")

  const url = new URL("https://api.stlouisfed.org/fred/series/observations")
  url.searchParams.set("series_id", seriesId)
  url.searchParams.set("api_key", apiKey)
  url.searchParams.set("file_type", "json")
  url.searchParams.set("sort_order", "desc")
  url.searchParams.set("limit", "10")

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`FRED API error: ${res.status}`)

  const payload = await res.json()
  const observations: { date: string; value: string }[] = payload.observations ?? []

  let latestValid: { date: string; value: string } | null = null
  for (const obs of observations) {
    const val = String(obs.value ?? "").trim()
    if (val && ![".", "null", "None"].includes(val)) {
      latestValid = obs
      break
    }
  }
  if (!latestValid) throw new Error(`No valid FRED datapoints for ${seriesId}`)

  return {
    seriesId,
    date: latestValid.date,
    value: parseFloat(latestValid.value) / 100, // convert percent to decimal
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [banxicoFix, tiie28, tiie91, sofr] = await Promise.all([
      fetchBanxicoSeries("SF43718"), // USD/MXN FIX spot
      fetchBanxicoSeries("SF60648"), // TIIE 28d
      fetchBanxicoSeries("SF60649"), // TIIE 91d
      fetchFredLatest("SOFR"),
    ])

    // Build spot history for scenarios (USD/MXN FIX history)
    const spotHistory = banxicoFix.rawData
      .filter((d) => {
        const v = String(d.dato ?? "").trim()
        return v && !["N/E", "null", "None"].includes(v)
      })
      .map((d) => ({
        date: d.fecha,
        spot: parseFloat(d.dato.replace(",", "")),
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json({
      spot: { value: banxicoFix.value, date: banxicoFix.date },
      tiie28: { value: tiie28.value, date: tiie28.date },
      tiie91: { value: tiie91.value, date: tiie91.date },
      sofr: { value: sofr.value, date: sofr.date },
      spotHistory,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch market data"
    return NextResponse.json({ error: msg }, { status: 502 })
  }
}
