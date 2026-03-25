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

interface ExposureRow {
  id: string
  currency: string
  amount: string
  direction: string
  settlementDate: Date | string
  entity: string | null
  counterparty: string | null
  notes: string | null
  status: string
  hedgingStatus: string
}

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (row: ExposureRow) => void
}

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "MXN", "BRL", "COP", "CLP", "PEN", "ARS"]

export function AddExposureDialog({ open, onClose, onAdd }: Props) {
  const [currency, setCurrency] = useState("USD")
  const [amount, setAmount] = useState("")
  const [direction, setDirection] = useState<"PAY" | "RECEIVE">("PAY")
  const [settlementDate, setSettlementDate] = useState("")
  const [entity, setEntity] = useState("")
  const [counterparty, setCounterparty] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setCurrency("USD")
    setAmount("")
    setDirection("PAY")
    setSettlementDate("")
    setEntity("")
    setCounterparty("")
    setNotes("")
    setError(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Amount must be a positive number.")
      return
    }
    if (!settlementDate) {
      setError("Settlement date is required.")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/exposures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currency,
          amount: Number(amount),
          direction,
          settlementDate: new Date(settlementDate).toISOString(),
          entity: entity || undefined,
          counterparty: counterparty || undefined,
          notes: notes || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.formErrors?.[0] ?? "Failed to create exposure.")
        return
      }
      const row = await res.json()
      onAdd(row)
      reset()
    } catch {
      setError("Unexpected error.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add exposure</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="currency" className="text-xs">Currency *</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger id="currency" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-xs">Amount *</Label>
              <Input id="amount" type="number" min="0" step="any" value={amount}
                onChange={(e) => setAmount(e.target.value)} className="h-9" placeholder="0.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="direction" className="text-xs">Direction *</Label>
              <Select value={direction} onValueChange={(v) => v && setDirection(v as "PAY" | "RECEIVE")}>
                <SelectTrigger id="direction" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAY">Pay</SelectItem>
                  <SelectItem value="RECEIVE">Receive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="settlementDate" className="text-xs">Settlement date *</Label>
              <Input id="settlementDate" type="date" value={settlementDate}
                onChange={(e) => setSettlementDate(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="entity" className="text-xs">Entity / Subsidiary</Label>
            <Input id="entity" value={entity} onChange={(e) => setEntity(e.target.value)}
              className="h-9" placeholder="e.g. Mexico Operations" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="counterparty" className="text-xs">Counterparty</Label>
            <Input id="counterparty" value={counterparty} onChange={(e) => setCounterparty(e.target.value)}
              className="h-9" placeholder="e.g. Supplier name" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">Notes</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)}
              className="h-9" placeholder="Optional" />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Adding..." : "Add exposure"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
