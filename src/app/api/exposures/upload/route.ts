import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { put } from "@vercel/blob"
import Papa from "papaparse"
import * as XLSX from "xlsx"

async function getOrgId() {
  const session = await auth()
  if (!session?.user?.id) return null
  const member = await prisma.organizationMember.findFirst({
    where: { userId: session.user.id },
    select: { organizationId: true },
  })
  return member?.organizationId ?? null
}

// Validate a single parsed row
function validateRow(row: Record<string, string>, index: number) {
  const errors: string[] = []

  if (!row.currency || row.currency.length < 2) errors.push("Invalid currency")
  if (!row.amount || isNaN(Number(row.amount))) errors.push("Non-numeric amount")
  if (!row.direction || !["PAY", "RECEIVE", "pay", "receive"].includes(row.direction))
    errors.push("Missing or invalid direction")
  if (!row.settlement_date && !row.settlementDate)
    errors.push("Missing settlement date")
  else {
    const dateStr = row.settlement_date ?? row.settlementDate
    if (isNaN(Date.parse(dateStr))) errors.push("Invalid date format")
  }

  return { rowIndex: index + 1, errors, valid: errors.length === 0 }
}

export async function POST(req: NextRequest) {
  const orgId = await getOrgId()
  if (!orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const mappingJson = formData.get("mapping") as string | null

  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 })

  const fileType = file.name.endsWith(".csv") ? "csv" : "xlsx"
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Parse file to rows
  let rawRows: Record<string, string>[] = []

  if (fileType === "csv") {
    const text = buffer.toString("utf-8")
    const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true })
    rawRows = result.data
  } else {
    const workbook = XLSX.read(buffer, { type: "buffer" })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]
    rawRows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" })
  }

  // Apply column mapping if provided
  const mapping: Record<string, string> = mappingJson ? JSON.parse(mappingJson) : {}
  const mappedRows = rawRows.map((row) => {
    if (Object.keys(mapping).length === 0) return row
    const mapped: Record<string, string> = {}
    for (const [sourceCol, yardaField] of Object.entries(mapping)) {
      mapped[yardaField] = row[sourceCol] ?? ""
    }
    return mapped
  })

  // Step 1 (no mapping): just return headers for column mapping UI — don't persist anything
  if (Object.keys(mapping).length === 0) {
    return NextResponse.json({
      uploadId: "",
      totalRows: rawRows.length,
      validRows: 0,
      invalidRows: 0,
      errors: [],
      headers: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
      rows: [],
    })
  }

  // Validate rows
  const validationResults = mappedRows.map((row, i) => validateRow(row, i))
  const validRows = validationResults.filter((r) => r.valid)
  const invalidRows = validationResults.filter((r) => !r.valid)

  // Store original file to Vercel Blob (skip gracefully if token not set)
  let blobUrl = ""
  try {
    const blob = await put(`exposures/${orgId}/${Date.now()}-${file.name}`, buffer, {
      access: "private",
      contentType: file.type,
    })
    blobUrl = blob.url
  } catch {
    // Blob storage unavailable (e.g. local dev without BLOB_READ_WRITE_TOKEN) — continue without storing file
  }

  // Create Upload record
  const upload = await prisma.upload.create({
    data: {
      organizationId: orgId,
      fileName: file.name,
      fileType,
      blobUrl,
      rowCount: rawRows.length,
    },
  })

  // Insert valid rows and return them
  let createdExposures: { id: string; currency: string; amount: { toString(): string }; direction: string; settlementDate: Date; entity: string | null; counterparty: string | null; notes: string | null; status: string; hedgingStatus: string }[] = []
  if (validRows.length > 0) {
    const validMappedRows = validRows.map((vr) => mappedRows[vr.rowIndex - 1])
    await prisma.exposure.createMany({
      data: validMappedRows.map((row) => ({
        organizationId: orgId,
        uploadId: upload.id,
        currency: (row.currency ?? "").toUpperCase().trim(),
        amount: Number(row.amount),
        direction: (row.direction ?? "").toUpperCase().trim() as "PAY" | "RECEIVE",
        settlementDate: new Date(row.settlement_date ?? row.settlementDate),
        entity: row.entity ?? row.subsidiary ?? null,
        counterparty: row.counterparty ?? null,
        invoiceId: row.invoice_id ?? row.invoiceId ?? null,
        notes: row.notes ?? row.description ?? null,
        uploadSource: fileType === "csv" ? "CSV" : "EXCEL",
      })),
    })
    createdExposures = await prisma.exposure.findMany({
      where: { uploadId: upload.id },
      orderBy: { settlementDate: "asc" },
    })
  }

  return NextResponse.json({
    uploadId: upload.id,
    totalRows: rawRows.length,
    validRows: validRows.length,
    invalidRows: invalidRows.length,
    errors: invalidRows,
    headers: rawRows.length > 0 ? Object.keys(rawRows[0]) : [],
    rows: createdExposures.map((e) => ({ ...e, amount: e.amount.toString() })),
  })
}
