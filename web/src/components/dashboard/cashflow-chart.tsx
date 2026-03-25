"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
interface Exposure {
  id: string
  settlementDate: Date | string
  amount: string | number
  direction: string
}
import { format, startOfMonth, addMonths } from "date-fns"

interface Props {
  exposures: Exposure[]
}

export function CashflowChart({ exposures }: Props) {
  // Group exposures by month
  const now = new Date()
  const months = Array.from({ length: 12 }, (_, i) => startOfMonth(addMonths(now, i - 2)))

  const data = months.map((month) => {
    const label = format(month, "M/yy")
    const monthExposures = exposures.filter((e) => {
      const d = startOfMonth(new Date(e.settlementDate))
      return d.getTime() === month.getTime()
    })

    const inflow = monthExposures
      .filter((e) => e.direction === "RECEIVE")
      .reduce((sum, e) => sum + Number(e.amount), 0)

    const outflow = monthExposures
      .filter((e) => e.direction === "PAY")
      .reduce((sum, e) => sum + Number(e.amount), 0)

    return { month: label, "Inflow (USD)": inflow, "Outflow (USD)": -outflow }
  })

  if (exposures.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-sm text-gray-400">
        No exposure data to display.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} barSize={16}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value) => [
            `$${Math.abs(Number(value)).toLocaleString()}`,
          ]}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="Inflow (USD)" fill="#4ade80" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Outflow (USD)" fill="#fca5a5" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
