"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Building2, User, Zap, Upload, Plus, Trash2 } from "lucide-react"

interface Org {
  id: string
  name: string
  baseCurrency: string
  reportingCurrency: string
  timezone: string
  operatingCountries: string[]
}

interface MappingTemplate {
  id: string
  name: string
}

interface UserData {
  id: string
  name: string | null
  email: string | null
}

interface Provider {
  id: string
  name: string
  active: boolean
  environment: string
  accountId: string | null
  connectivityStatus: string | null
}

interface SimSettings {
  defaultHedgeRatios: number[]
  defaultTenorDays: number
  showDisclosure: boolean
}

interface UploadSettingsData {
  defaultDateFormat: string
  defaultAmountFormat: string
  directionPayLabel: string
  directionReceiveLabel: string
}

interface Props {
  org: Org | null
  user: UserData | null
  providers: Provider[]
  simSettings: SimSettings | null
  uploadSettings: UploadSettingsData | null
  mappingTemplates: MappingTemplate[]
}

type Tab = "company" | "user" | "providers" | "simulation" | "upload"

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "company", label: "Company", icon: <Building2 className="h-4 w-4" /> },
  { id: "user", label: "Profile", icon: <User className="h-4 w-4" /> },
  { id: "providers", label: "Providers", icon: <Zap className="h-4 w-4" /> },
  { id: "simulation", label: "Simulation", icon: <Zap className="h-4 w-4" /> },
  { id: "upload", label: "Upload", icon: <Upload className="h-4 w-4" /> },
]

const TIMEZONES = [
  "America/Mexico_City",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "America/New_York",
  "Europe/London",
]

const CURRENCIES = ["MXN", "USD", "EUR", "BRL", "COP", "CLP", "PEN", "ARS"]

export function SettingsPage({ org, user, providers: initialProviders, simSettings, uploadSettings, mappingTemplates: initialTemplates }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("company")
  const [saving, setSaving] = useState(false)
  const [providers, setProviders] = useState<Provider[]>(initialProviders)

  // Company form
  const [orgName, setOrgName] = useState(org?.name ?? "")
  const [baseCurrency, setBaseCurrency] = useState(org?.baseCurrency ?? "MXN")
  const [reportingCurrency, setReportingCurrency] = useState(org?.reportingCurrency ?? "USD")
  const [timezone, setTimezone] = useState(org?.timezone ?? "America/Mexico_City")
  const [operatingCountries, setOperatingCountries] = useState<string[]>(org?.operatingCountries ?? [])
  const [countryInput, setCountryInput] = useState("")

  // Templates state
  const [templates, setTemplates] = useState<MappingTemplate[]>(initialTemplates)

  // User form
  const [userName, setUserName] = useState(user?.name ?? "")

  // Simulation form
  const [defaultTenorDays, setDefaultTenorDays] = useState(String(simSettings?.defaultTenorDays ?? 30))
  const [showDisclosure, setShowDisclosure] = useState(simSettings?.showDisclosure ?? true)

  // Upload form
  const [dateFormat, setDateFormat] = useState(uploadSettings?.defaultDateFormat ?? "YYYY-MM-DD")
  const [payLabel, setPayLabel] = useState(uploadSettings?.directionPayLabel ?? "Payable")
  const [receiveLabel, setReceiveLabel] = useState(uploadSettings?.directionReceiveLabel ?? "Receivable")

  // Add provider form
  const [newProviderName, setNewProviderName] = useState("")
  const [newProviderEnv, setNewProviderEnv] = useState<"SANDBOX" | "PRODUCTION">("SANDBOX")
  const [addingProvider, setAddingProvider] = useState(false)

  const save = async (section: string, data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section, data }),
      })
      if (res.ok) {
        toast.success("Settings saved.")
      } else {
        const d = await res.json()
        toast.error(d.error?.formErrors?.[0] ?? "Failed to save.")
      }
    } catch {
      toast.error("Unexpected error.")
    } finally {
      setSaving(false)
    }
  }

  const addProvider = async () => {
    if (!newProviderName.trim()) return
    setAddingProvider(true)
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProviderName.trim(), environment: newProviderEnv }),
      })
      if (res.ok) {
        const p = await res.json()
        setProviders((prev) => [...prev, p])
        setNewProviderName("")
        toast.success("Provider added.")
      } else {
        toast.error("Failed to add provider.")
      }
    } catch {
      toast.error("Unexpected error.")
    } finally {
      setAddingProvider(false)
    }
  }

  const toggleProviderActive = async (id: string, active: boolean) => {
    const res = await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    })
    if (res.ok) {
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)))
      toast.success(`Provider ${active ? "enabled" : "disabled"}.`)
    } else {
      toast.error("Failed to update provider.")
    }
  }

  const deleteProvider = async (id: string) => {
    const res = await fetch(`/api/providers/${id}`, { method: "DELETE" })
    if (res.ok) {
      setProviders((prev) => prev.filter((p) => p.id !== id))
      toast.success("Provider removed.")
    } else {
      toast.error("Failed to remove provider.")
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your organization and account preferences.</p>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors
              ${activeTab === tab.id ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Company */}
      {activeTab === "company" && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Company information</h2>
          <div className="space-y-1.5">
            <Label className="text-xs">Company name</Label>
            <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="h-9 max-w-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">Base currency</Label>
              <Select value={baseCurrency} onValueChange={(v) => v && setBaseCurrency(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reporting currency</Label>
              <Select value={reportingCurrency} onValueChange={(v) => v && setReportingCurrency(v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Timezone</Label>
            <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Operating countries</Label>
            <div className="flex gap-2">
              <Input
                value={countryInput}
                onChange={(e) => setCountryInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && countryInput.trim()) {
                    e.preventDefault()
                    const c = countryInput.trim()
                    if (!operatingCountries.includes(c)) setOperatingCountries((prev) => [...prev, c])
                    setCountryInput("")
                  }
                }}
                placeholder="e.g. MX, US, CO"
                maxLength={4}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0"
                disabled={!countryInput.trim()}
                onClick={() => {
                  const c = countryInput.trim()
                  if (c && !operatingCountries.includes(c)) setOperatingCountries((prev) => [...prev, c])
                  setCountryInput("")
                }}
              >
                Add
              </Button>
            </div>
            {operatingCountries.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {operatingCountries.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                    {c}
                    <button type="button" onClick={() => setOperatingCountries((prev) => prev.filter((x) => x !== c))} className="hover:text-red-500 leading-none">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <Button size="sm" disabled={saving} onClick={() => save("organization", { name: orgName, baseCurrency, reportingCurrency, timezone, operatingCountries })}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}

      {/* User profile */}
      {activeTab === "user" && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Profile</h2>
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Full name</Label>
            <Input value={userName} onChange={(e) => setUserName(e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5 max-w-sm">
            <Label className="text-xs">Email</Label>
            <Input value={user?.email ?? ""} disabled className="h-9 bg-gray-50 text-gray-400" />
            <p className="text-xs text-gray-400">Email cannot be changed.</p>
          </div>
          <Button size="sm" disabled={saving} onClick={() => save("user", { name: userName })}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}

      {/* Providers */}
      {activeTab === "providers" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border">
            {providers.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No providers configured yet.</div>
            ) : (
              <div className="divide-y">
                {providers.map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.environment} · {p.connectivityStatus ?? "Not tested"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleProviderActive(p.id, !p.active)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                          ${p.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {p.active ? "Active" : "Inactive"}
                      </button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500"
                        onClick={() => deleteProvider(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Add provider</h3>
            <div className="flex gap-3 items-end">
              <div className="space-y-1.5 flex-1">
                <Label className="text-xs">Provider name</Label>
                <Input value={newProviderName} onChange={(e) => setNewProviderName(e.target.value)}
                  placeholder="e.g. BBVA, Citibanamex" className="h-9" />
              </div>
              <div className="space-y-1.5 w-36">
                <Label className="text-xs">Environment</Label>
                <Select value={newProviderEnv} onValueChange={(v) => v && setNewProviderEnv(v as "SANDBOX" | "PRODUCTION")}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SANDBOX">Sandbox</SelectItem>
                    <SelectItem value="PRODUCTION">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="h-9" disabled={!newProviderName.trim() || addingProvider} onClick={addProvider}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Simulation settings */}
      {activeTab === "simulation" && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Simulation defaults</h2>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Default tenor (days)</Label>
            <Input type="number" min="1" max="3650" value={defaultTenorDays}
              onChange={(e) => setDefaultTenorDays(e.target.value)} className="h-9" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="disclosure" checked={showDisclosure}
              onChange={(e) => setShowDisclosure(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300" />
            <Label htmlFor="disclosure" className="text-sm cursor-pointer">
              Show illustrative disclaimer in simulation output
            </Label>
          </div>
          <Button size="sm" disabled={saving}
            onClick={() => save("simulation", { defaultTenorDays: Number(defaultTenorDays), showDisclosure })}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>
      )}

      {/* Upload settings */}
      {activeTab === "upload" && (
        <div className="space-y-4">
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-700">Upload defaults</h2>
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs">Default date format</Label>
            <Select value={dateFormat} onValueChange={(v) => v && setDateFormat(v)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                <SelectItem value="DD-MM-YYYY">DD-MM-YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <div className="space-y-1.5">
              <Label className="text-xs">Pay direction label</Label>
              <Input value={payLabel} onChange={(e) => setPayLabel(e.target.value)} className="h-9" placeholder="Payable" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Receive direction label</Label>
              <Input value={receiveLabel} onChange={(e) => setReceiveLabel(e.target.value)} className="h-9" placeholder="Receivable" />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            These labels help auto-map direction column values when uploading files.
          </p>
          <Button size="sm" disabled={saving}
            onClick={() => save("upload", { defaultDateFormat: dateFormat, directionPayLabel: payLabel, directionReceiveLabel: receiveLabel })}>
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </div>

        {/* Saved mapping templates */}
        <div className="bg-white rounded-xl border p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">Saved mapping templates</h2>
          {templates.length === 0 ? (
            <p className="text-sm text-gray-400">No templates saved yet. Save a template during file upload to see it here.</p>
          ) : (
            <div className="divide-y border rounded-lg overflow-hidden">
              {templates.map((t) => (
                <div key={t.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-gray-800">{t.name}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-gray-400 hover:text-red-500"
                    onClick={async () => {
                      const res = await fetch(`/api/mappingtemplates/${t.id}`, { method: "DELETE" })
                      if (res.ok) {
                        setTemplates((prev) => prev.filter((x) => x.id !== t.id))
                        toast.success("Template deleted.")
                      } else {
                        toast.error("Failed to delete template.")
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        </div>
      )}
    </div>
  )
}
