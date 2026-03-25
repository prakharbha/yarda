"use client"

import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
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
import { Upload, FileText, AlertCircle, CheckCircle2, ChevronRight } from "lucide-react"

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
  open: boolean
  onClose: () => void
  onComplete: (rows: ExposureRow[]) => void
  mappingTemplates: MappingTemplate[]
}

type Step = "upload" | "mapping" | "results"

// Yarda canonical fields
const YARDA_FIELDS = [
  { key: "currency", label: "Currency", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "direction", label: "Direction (PAY/RECEIVE)", required: true },
  { key: "settlement_date", label: "Settlement Date", required: true },
  { key: "entity", label: "Entity / Subsidiary", required: false },
  { key: "counterparty", label: "Counterparty", required: false },
  { key: "invoice_id", label: "Invoice ID", required: false },
  { key: "notes", label: "Notes / Description", required: false },
]

interface UploadResponse {
  uploadId: string
  totalRows: number
  validRows: number
  invalidRows: number
  errors: { rowIndex: number; errors: string[] }[]
  headers: string[]
}

export function UploadDialog({ open, onClose, onComplete, mappingTemplates }: Props) {
  const [step, setStep] = useState<Step>("upload")
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadResponse, setUploadResponse] = useState<UploadResponse | null>(null)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [selectedTemplate, setSelectedTemplate] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [createdRows, setCreatedRows] = useState<ExposureRow[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const reset = () => {
    setStep("upload")
    setFile(null)
    setDragging(false)
    setUploading(false)
    setUploadError(null)
    setUploadResponse(null)
    setMapping({})
    setSelectedTemplate("")
    setCreatedRows([])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx"))) {
      setFile(f)
      setUploadError(null)
    } else {
      setUploadError("Only .csv and .xlsx files are supported.")
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setUploadError(null)
    }
  }

  // Step 1 → Step 2: upload file to get headers, then show mapping UI
  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      // Send empty mapping to get headers back without inserting data yet
      // We re-upload with mapping in step 3
      const res = await fetch("/api/exposures/upload", { method: "POST", body: formData })
      const data: UploadResponse = await res.json()
      if (!res.ok) {
        setUploadError((data as { error?: string }).error ?? "Upload failed.")
        return
      }
      setUploadResponse(data)

      // Auto-apply template if one is selected
      if (selectedTemplate) {
        const tmpl = mappingTemplates.find((t) => t.id === selectedTemplate)
        if (tmpl && tmpl.columnMap && typeof tmpl.columnMap === "object") {
          setMapping(tmpl.columnMap as Record<string, string>)
        }
      } else {
        // Auto-detect obvious column matches
        const autoMap: Record<string, string> = {}
        for (const header of data.headers) {
          const h = header.toLowerCase().replace(/[\s_-]/g, "")
          if (h === "currency" || h === "ccy") autoMap[header] = "currency"
          else if (h === "amount" || h === "notional") autoMap[header] = "amount"
          else if (h === "direction" || h === "side") autoMap[header] = "direction"
          else if (h === "settlementdate" || h === "settlement" || h === "duedate" || h === "valuedate") autoMap[header] = "settlement_date"
          else if (h === "entity" || h === "subsidiary" || h === "company") autoMap[header] = "entity"
          else if (h === "counterparty" || h === "vendor" || h === "supplier") autoMap[header] = "counterparty"
          else if (h === "invoiceid" || h === "invoice") autoMap[header] = "invoice_id"
          else if (h === "notes" || h === "description" || h === "comment") autoMap[header] = "notes"
        }
        setMapping(autoMap)
      }
      setStep("mapping")
    } catch {
      setUploadError("Unexpected error during upload.")
    } finally {
      setUploading(false)
    }
  }

  // Step 2 → Step 3: re-upload with mapping to actually save
  const handleSaveWithMapping = async () => {
    if (!file) return
    setSaving(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mapping", JSON.stringify(mapping))
      const res = await fetch("/api/exposures/upload", { method: "POST", body: formData })
      const data: UploadResponse & { rows?: ExposureRow[] } = await res.json()
      if (!res.ok) {
        setUploadError((data as { error?: string }).error ?? "Failed to save.")
        setStep("upload")
        return
      }
      setUploadResponse(data)
      setCreatedRows(data.rows ?? [])
      setStep("results")
    } catch {
      setUploadError("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  const handleFinish = () => {
    onComplete(createdRows)
    reset()
  }

  const mappingComplete = YARDA_FIELDS.filter((f) => f.required).every((f) =>
    Object.values(mapping).includes(f.key)
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import exposures</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
          {(["upload", "mapping", "results"] as Step[]).map((s, i) => (
            <span key={s} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={step === s ? "text-gray-900 font-medium" : ""}>
                {i + 1}. {s === "upload" ? "Select file" : s === "mapping" ? "Map columns" : "Results"}
              </span>
            </span>
          ))}
        </div>

        {/* Step 1: File drop */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
                ${dragging ? "border-blue-400 bg-blue-50" : "border-gray-200 hover:border-gray-300"}`}
            >
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={handleFileChange} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileText className="h-8 w-8 text-blue-500" />
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-gray-300" />
                  <p className="text-sm font-medium text-gray-600">Drop your file here or click to browse</p>
                  <p className="text-xs text-gray-400">CSV or Excel (.xlsx) up to 10 MB</p>
                </div>
              )}
            </div>

            {mappingTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs">Apply saved template (optional)</Label>
                <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v ?? "")}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Auto-detect columns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect columns</SelectItem>
                    {mappingTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {uploadError && (
              <div className="flex items-center gap-2 text-xs text-red-500">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {uploadError}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
              <Button size="sm" disabled={!file || uploading} onClick={handleUpload}>
                {uploading ? "Uploading..." : "Next"}
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Column mapping */}
        {step === "mapping" && uploadResponse && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Map your file columns to Yarda fields. Required fields are marked with *.
            </p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Yarda field</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500">Your column</th>
                  </tr>
                </thead>
                <tbody>
                  {YARDA_FIELDS.map((field) => {
                    const currentCol = Object.entries(mapping).find(([, v]) => v === field.key)?.[0] ?? ""
                    return (
                      <tr key={field.key} className="border-b last:border-0">
                        <td className="px-4 py-2.5">
                          <span className="text-sm text-gray-700">{field.label}</span>
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <Select
                            value={currentCol}
                            onValueChange={(col) => {
                              setMapping((prev) => {
                                const next = { ...prev }
                                // Remove previous mapping for this yarda field
                                for (const [k, v] of Object.entries(next)) {
                                  if (v === field.key) delete next[k]
                                }
                                if (col) next[col] = field.key
                                return next
                              })
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="— skip —" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">— skip —</SelectItem>
                              {uploadResponse.headers.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {!mappingComplete && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Map all required fields to continue.
              </p>
            )}

            <div className="flex justify-between gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("upload")}>Back</Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleClose}>Cancel</Button>
                <Button size="sm" disabled={!mappingComplete || saving} onClick={handleSaveWithMapping}>
                  {saving ? "Importing..." : "Import"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && uploadResponse && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-semibold text-gray-900">{uploadResponse.totalRows}</p>
                <p className="text-xs text-gray-500 mt-0.5">Total rows</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center">
                <p className="text-2xl font-semibold text-green-700">{uploadResponse.validRows}</p>
                <p className="text-xs text-green-600 mt-0.5">Imported</p>
              </div>
              <div className={`rounded-lg p-4 text-center ${uploadResponse.invalidRows > 0 ? "bg-red-50" : "bg-gray-50"}`}>
                <p className={`text-2xl font-semibold ${uploadResponse.invalidRows > 0 ? "text-red-600" : "text-gray-400"}`}>
                  {uploadResponse.invalidRows}
                </p>
                <p className={`text-xs mt-0.5 ${uploadResponse.invalidRows > 0 ? "text-red-500" : "text-gray-400"}`}>Skipped</p>
              </div>
            </div>

            {uploadResponse.validRows > 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {uploadResponse.validRows} exposure{uploadResponse.validRows !== 1 ? "s" : ""} imported successfully.
              </div>
            )}

            {uploadResponse.errors.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-red-50 border-b px-4 py-2.5">
                  <p className="text-xs font-medium text-red-700">Rows with errors (skipped)</p>
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {uploadResponse.errors.map((err) => (
                    <div key={err.rowIndex} className="px-4 py-2 border-b last:border-0 flex items-start gap-3">
                      <span className="text-xs text-gray-400 shrink-0">Row {err.rowIndex}</span>
                      <span className="text-xs text-red-600">{err.errors.join(", ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleFinish}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
