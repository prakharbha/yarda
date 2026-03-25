"use client"

import { useState } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table"
import { format } from "date-fns"
import { ArrowUpDown, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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

interface Props {
  trades: TradeRow[]
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, data: Partial<TradeRow>) => Promise<void>
}

const columnHelper = createColumnHelper<TradeRow>()

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  PENDING_QUOTE: "bg-yellow-100 text-yellow-700",
  QUOTED: "bg-blue-100 text-blue-700",
  PENDING_EXECUTION: "bg-purple-100 text-purple-700",
  ACTIVE: "bg-green-100 text-green-700",
  SETTLED: "bg-teal-100 text-teal-700",
  CANCELLED: "bg-red-50 text-red-500",
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${STATUS_COLORS[status] ?? "bg-gray-100 text-gray-600"} border-0 text-xs`}>
      {status.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
    </Badge>
  )
}

export function ForwardsTable({ trades, onDelete, onUpdate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<TradeRow>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const startEdit = (row: TradeRow) => {
    setEditingId(row.id)
    setEditValues({
      currencyPair: row.currencyPair,
      direction: row.direction,
      notional: row.notional,
      rate: row.rate ?? "",
      settlementDate: row.settlementDate,
      status: row.status,
      notes: row.notes ?? "",
    })
  }

  const cancelEdit = () => { setEditingId(null); setEditValues({}) }

  const saveEdit = async (id: string) => {
    const payload: Record<string, unknown> = {}
    if (editValues.currencyPair) payload.currencyPair = editValues.currencyPair
    if (editValues.direction) payload.direction = editValues.direction
    if (editValues.notional) payload.notional = Number(editValues.notional)
    if (editValues.rate) payload.rate = Number(editValues.rate)
    if (editValues.settlementDate) payload.settlementDate = new Date(editValues.settlementDate as string).toISOString()
    if (editValues.status) payload.status = editValues.status
    if (editValues.notes !== undefined) payload.notes = editValues.notes || null
    await onUpdate(id, payload as Partial<TradeRow>)
    cancelEdit()
  }

  const columns = [
    columnHelper.accessor("currencyPair", {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs font-medium text-gray-500"
          onClick={() => column.toggleSorting()}>
          Pair <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return <Input value={editValues.currencyPair ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, currencyPair: e.target.value.toUpperCase() }))} className="h-7 w-24 text-xs" />
        }
        return <span className="font-mono font-medium text-sm">{row.original.currencyPair}</span>
      },
    }),
    columnHelper.accessor("direction", {
      header: () => <span className="text-xs font-medium text-gray-500">Direction</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Select value={editValues.direction ?? row.original.direction}
              onValueChange={(v) => v && setEditValues((ev) => ({ ...ev, direction: v }))}>
              <SelectTrigger className="h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BUY">Buy</SelectItem>
                <SelectItem value="SELL">Sell</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        return row.original.direction === "BUY"
          ? <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Buy</Badge>
          : <Badge className="bg-red-50 text-red-600 border-0 text-xs">Sell</Badge>
      },
    }),
    columnHelper.accessor("notional", {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs font-medium text-gray-500"
          onClick={() => column.toggleSorting()}>
          Notional <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return <Input type="number" value={editValues.notional ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, notional: e.target.value }))} className="h-7 w-32 text-xs" />
        }
        return <span className="font-mono text-sm">{Number(row.original.notional).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
      },
    }),
    columnHelper.accessor("rate", {
      header: () => <span className="text-xs font-medium text-gray-500">Rate</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return <Input type="number" step="0.0001" value={editValues.rate ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, rate: e.target.value }))} className="h-7 w-24 text-xs" placeholder="optional" />
        }
        return <span className="font-mono text-sm text-gray-600">{row.original.rate ? Number(row.original.rate).toFixed(4) : "—"}</span>
      },
    }),
    columnHelper.accessor("settlementDate", {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs font-medium text-gray-500"
          onClick={() => column.toggleSorting()}>
          Settlement <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          const dv = editValues.settlementDate
            ? new Date(editValues.settlementDate as string).toISOString().split("T")[0]
            : new Date(row.original.settlementDate).toISOString().split("T")[0]
          return <Input type="date" value={dv} onChange={(e) => setEditValues((v) => ({ ...v, settlementDate: e.target.value }))} className="h-7 w-36 text-xs" />
        }
        return <span className="text-sm text-gray-600">{format(new Date(row.original.settlementDate), "MMM d, yyyy")}</span>
      },
      sortingFn: (a, b) =>
        new Date(a.original.settlementDate).getTime() - new Date(b.original.settlementDate).getTime(),
    }),
    columnHelper.accessor("status", {
      header: () => <span className="text-xs font-medium text-gray-500">Status</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Select value={editValues.status ?? row.original.status}
              onValueChange={(v) => v && setEditValues((ev) => ({ ...ev, status: v }))}>
              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["DRAFT", "PENDING_QUOTE", "QUOTED", "PENDING_EXECUTION", "ACTIVE", "SETTLED", "CANCELLED"].map((s) => (
                  <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        }
        return <StatusBadge status={row.original.status} />
      },
    }),
    columnHelper.accessor("provider", {
      header: () => <span className="text-xs font-medium text-gray-500">Provider</span>,
      cell: ({ row }) => <span className="text-sm text-gray-600">{row.original.provider?.name ?? "—"}</span>,
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const isEditing = editingId === row.original.id
        if (isEditing) {
          return (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => saveEdit(row.original.id)}><Check className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={cancelEdit}><X className="h-3.5 w-3.5" /></Button>
            </div>
          )
        }
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600" onClick={() => startEdit(row.original)}><Pencil className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500" onClick={() => onDelete(row.original.id)} disabled={deletingId === row.original.id}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div>
      <div className="px-4 py-3 border-b">
        <Input placeholder="Search forwards..." value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="h-8 w-64 text-sm" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-gray-50/50">
                {hg.headers.map((h) => (
                  <th key={h.id} className="px-4 py-2.5 text-left">{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">No forwards found.</td></tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50/50 group">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
