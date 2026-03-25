"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Upload, Plus } from "lucide-react"
import { ExposureTable } from "./exposure-table"
import { UploadDialog } from "./upload-dialog"
import { AddExposureDialog } from "./add-exposure-dialog"
import { toast } from "sonner"

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

interface MappingTemplate {
  id: string
  name: string
  columnMap: unknown
}

interface Props {
  initialExposures: ExposureRow[]
  mappingTemplates: MappingTemplate[]
}

export function ExposureTracker({ initialExposures, mappingTemplates }: Props) {
  const [exposures, setExposures] = useState<ExposureRow[]>(initialExposures)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const handleUploadComplete = (newRows: ExposureRow[]) => {
    setExposures((prev) => [...newRows, ...prev])
    setUploadOpen(false)
    toast.success(`${newRows.length} exposures imported successfully.`)
  }

  const handleAdd = (row: ExposureRow) => {
    setExposures((prev) => [row, ...prev])
    setAddOpen(false)
    toast.success("Exposure added.")
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/exposures/${id}`, { method: "DELETE" })
    if (res.ok) {
      setExposures((prev) => prev.filter((e) => e.id !== id))
      toast.success("Exposure deleted.")
    } else {
      toast.error("Failed to delete exposure.")
    }
  }

  const handleUpdate = async (id: string, data: Partial<ExposureRow>) => {
    const res = await fetch(`/api/exposures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const updated = await res.json()
      setExposures((prev) => prev.map((e) => (e.id === id ? updated : e)))
      toast.success("Exposure updated.")
    } else {
      toast.error("Failed to update exposure.")
    }
  }

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Exposure Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {exposures.length} active exposure{exposures.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-1.5" />
            Upload file
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add exposure
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <ExposureTable
          exposures={exposures}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      </div>

      <UploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onComplete={handleUploadComplete}
        mappingTemplates={mappingTemplates}
      />

      <AddExposureDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={handleAdd}
      />
    </div>
  )
}
