"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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
  open: boolean
  onClose: () => void
  onAdd: (trade: TradeRow) => void
  tradeType: "FORWARD" | "SPOT"
  providers: Provider[]
}

const COMMON_PAIRS = ["USD/MXN", "USD/BRL", "USD/COP", "USD/CLP", "USD/PEN", "EUR/USD", "GBP/USD", "USD/JPY"]

export function AddTradeDialog({ open, onClose, onAdd, tradeType, providers }: Props) {
  const [currencyPair, setCurrencyPair] = useState("USD/MXN")
  const [customPair, setCustomPair] = useState("")
  const [useCustomPair, setUseCustomPair] = useState(false)
  const [direction, setDirection] = useState<"BUY" | "SELL">("BUY")
  const [notional, setNotional] = useState("")
  const [rate, setRate] = useState("")
  const [tradeDate, setTradeDate] = useState("")
  const [settlementDate, setSettlementDate] = useState("")
  const [providerId, setProviderId] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCurrencyPair("USD/MXN")
    setCustomPair("")
    setUseCustomPair(false)
    setDirection("BUY")
    setNotional("")
    setRate("")
    setTradeDate("")
    setSettlementDate("")
    setProviderId("")
    setNotes("")
    setError(null)
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const pair = useCustomPair ? customPair.toUpperCase() : currencyPair
    if (!pair || pair.length < 6) { setError("Enter a valid currency pair (e.g. USD/MXN)."); return }
    if (!notional || isNaN(Number(notional)) || Number(notional) <= 0) { setError("Notional must be a positive number."); return }
    if (!settlementDate) { setError("Settlement date is required."); return }

    setLoading(true)
    try {
      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tradeType,
          currencyPair: pair,
          direction,
          notional: Number(notional),
          ...(rate ? { rate: Number(rate) } : {}),
          ...(tradeDate ? { tradeDate: new Date(tradeDate).toISOString() } : {}),
          settlementDate: new Date(settlementDate).toISOString(),
          ...(providerId ? { providerId } : {}),
          ...(notes ? { notes } : {}),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.formErrors?.[0] ?? "Failed to create trade.")
        return
      }
      const trade = await res.json()
      onAdd(trade)
      reset()
    } catch {
      setError("Unexpected error.")
    } finally {
      setLoading(false)
    }
  }

  const title = tradeType === "FORWARD" ? "Add forward" : "Add spot trade"

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Currency pair *</Label>
            {!useCustomPair ? (
              <div className="flex gap-2">
                <Select value={currencyPair} onValueChange={(v) => v && setCurrencyPair(v)}>
                  <SelectTrigger className="h-9 flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COMMON_PAIRS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setUseCustomPair(true)}>
                  Custom
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={customPair} onChange={(e) => setCustomPair(e.target.value.toUpperCase())}
                  placeholder="e.g. USD/ARS" className="h-9 flex-1" maxLength={7} />
                <Button type="button" variant="outline" size="sm" className="h-9" onClick={() => setUseCustomPair(false)}>
                  List
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Direction *</Label>
              <Select value={direction} onValueChange={(v) => v && setDirection(v as "BUY" | "SELL")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notional *</Label>
              <Input type="number" min="0" step="any" value={notional} onChange={(e) => setNotional(e.target.value)} className="h-9" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Rate {tradeType === "FORWARD" ? "(forward)" : "(spot)"}</Label>
              <Input type="number" step="0.0001" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" placeholder="optional" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Trade date</Label>
              <Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Settlement date *</Label>
            <Input type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} className="h-9" />
          </div>

          {providers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Provider / Bank</Label>
              <Select value={providerId} onValueChange={(v) => setProviderId(v ?? "")}>
                <SelectTrigger className="h-9"><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {providers.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-9" placeholder="Optional" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={loading}>{loading ? "Adding..." : title}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
