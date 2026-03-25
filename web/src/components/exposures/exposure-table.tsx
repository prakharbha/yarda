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
  exposures: ExposureRow[]
  onDelete: (id: string) => Promise<void>
  onUpdate: (id: string, data: Partial<ExposureRow>) => Promise<void>
}

const columnHelper = createColumnHelper<ExposureRow>()

function HedgingBadge({ status }: { status: string }) {
  if (status === "HEDGED") return <Badge className="bg-green-100 text-green-700 border-0 text-xs">Hedged</Badge>
  if (status === "PARTIAL") return <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">Partial</Badge>
  return <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">Unhedged</Badge>
}

function DirectionBadge({ direction }: { direction: string }) {
  if (direction === "PAY") return <Badge className="bg-red-50 text-red-600 border-0 text-xs">Pay</Badge>
  return <Badge className="bg-blue-50 text-blue-600 border-0 text-xs">Receive</Badge>
}

export function ExposureTable({ exposures, onDelete, onUpdate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ExposureRow>>({})
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const startEdit = (row: ExposureRow) => {
    setEditingId(row.id)
    setEditValues({
      currency: row.currency,
      amount: row.amount,
      direction: row.direction,
      settlementDate: row.settlementDate,
      entity: row.entity ?? "",
      counterparty: row.counterparty ?? "",
      notes: row.notes ?? "",
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const saveEdit = async (id: string) => {
    const payload: Record<string, unknown> = {}
    if (editValues.currency) payload.currency = editValues.currency
    if (editValues.amount) payload.amount = Number(editValues.amount)
    if (editValues.direction) payload.direction = editValues.direction
    if (editValues.settlementDate) {
      payload.settlementDate = new Date(editValues.settlementDate as string).toISOString()
    }
    if (editValues.entity !== undefined) payload.entity = editValues.entity || null
    if (editValues.counterparty !== undefined) payload.counterparty = editValues.counterparty || null
    if (editValues.notes !== undefined) payload.notes = editValues.notes || null
    await onUpdate(id, payload as Partial<ExposureRow>)
    setEditingId(null)
    setEditValues({})
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    await onDelete(id)
    setDeletingId(null)
  }

  const columns = [
    columnHelper.accessor("currency", {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs font-medium text-gray-500"
          onClick={() => column.toggleSorting()}>
          Currency <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input value={editValues.currency ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, currency: e.target.value.toUpperCase() }))}
              className="h-7 w-20 text-xs" maxLength={3} />
          )
        }
        return <span className="font-mono font-medium text-sm">{row.original.currency}</span>
      },
    }),
    columnHelper.accessor("amount", {
      header: ({ column }) => (
        <Button variant="ghost" size="sm" className="h-7 px-2 -ml-2 text-xs font-medium text-gray-500"
          onClick={() => column.toggleSorting()}>
          Amount <ArrowUpDown className="ml-1 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input value={editValues.amount ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, amount: e.target.value }))}
              className="h-7 w-32 text-xs" type="number" />
          )
        }
        return (
          <span className="font-mono text-sm text-right block">
            {Number(row.original.amount).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )
      },
    }),
    columnHelper.accessor("direction", {
      header: () => <span className="text-xs font-medium text-gray-500">Direction</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Select value={editValues.direction ?? row.original.direction}
              onValueChange={(v) => v && setEditValues((ev) => ({ ...ev, direction: v }))}>
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PAY">Pay</SelectItem>
                <SelectItem value="RECEIVE">Receive</SelectItem>
              </SelectContent>
            </Select>
          )
        }
        return <DirectionBadge direction={row.original.direction} />
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
          const dateVal = editValues.settlementDate
            ? new Date(editValues.settlementDate as string).toISOString().split("T")[0]
            : new Date(row.original.settlementDate).toISOString().split("T")[0]
          return (
            <Input type="date" value={dateVal}
              onChange={(e) => setEditValues((v) => ({ ...v, settlementDate: e.target.value }))}
              className="h-7 w-36 text-xs" />
          )
        }
        return <span className="text-sm text-gray-600">{format(new Date(row.original.settlementDate), "MMM d, yyyy")}</span>
      },
      sortingFn: (a, b) =>
        new Date(a.original.settlementDate).getTime() - new Date(b.original.settlementDate).getTime(),
    }),
    columnHelper.accessor("entity", {
      header: () => <span className="text-xs font-medium text-gray-500">Entity</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input value={editValues.entity ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, entity: e.target.value }))}
              className="h-7 w-28 text-xs" placeholder="Optional" />
          )
        }
        return <span className="text-sm text-gray-600">{row.original.entity ?? "—"}</span>
      },
    }),
    columnHelper.accessor("counterparty", {
      header: () => <span className="text-xs font-medium text-gray-500">Counterparty</span>,
      cell: ({ row }) => {
        if (editingId === row.original.id) {
          return (
            <Input value={editValues.counterparty ?? ""} onChange={(e) => setEditValues((v) => ({ ...v, counterparty: e.target.value }))}
              className="h-7 w-28 text-xs" placeholder="Optional" />
          )
        }
        return <span className="text-sm text-gray-600">{row.original.counterparty ?? "—"}</span>
      },
    }),
    columnHelper.accessor("hedgingStatus", {
      header: () => <span className="text-xs font-medium text-gray-500">Hedging</span>,
      cell: ({ row }) => <HedgingBadge status={row.original.hedgingStatus} />,
    }),
    columnHelper.display({
      id: "actions",
      cell: ({ row }) => {
        const isEditing = editingId === row.original.id
        const isDeleting = deletingId === row.original.id
        if (isEditing) {
          return (
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700"
                onClick={() => saveEdit(row.original.id)}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400"
                onClick={cancelEdit}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )
        }
        return (
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-gray-600"
              onClick={() => startEdit(row.original)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500"
              onClick={() => handleDelete(row.original.id)} disabled={isDeleting}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: exposures,
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
        <Input
          placeholder="Search exposures..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="h-8 w-64 text-sm"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b bg-gray-50/50">
                {hg.headers.map((header) => (
                  <th key={header.id} className="px-4 py-2.5 text-left">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                  No exposures found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0 hover:bg-gray-50/50 group">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
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
