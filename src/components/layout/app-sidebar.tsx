"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Home,
  Briefcase,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Settings,
  ChevronDown,
  FileText,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const nav = [
  {
    label: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    label: "Exposures",
    href: "/exposures",
    icon: FileText,
  },
  {
    label: "Wallets",
    icon: Briefcase,
    children: [
      { label: "Forwards", href: "/wallets/forwards", icon: TrendingUp },
      { label: "Spots", href: "/wallets/spots", icon: TrendingDown },
    ],
  },
  {
    label: "Simulator",
    href: "/simulators",
    icon: BarChart2,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [walletsOpen, setWalletsOpen] = useState(
    pathname.startsWith("/wallets")
  )

  return (
    <aside className="w-52 shrink-0 border-r bg-white flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b">
        <span className="text-lg font-semibold tracking-tight text-gray-900">
          YARDA
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          if (item.children) {
            const isActive = pathname.startsWith("/wallets")
            return (
              <div key={item.label}>
                <button
                  onClick={() => setWalletsOpen((o) => !o)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      walletsOpen && "rotate-180"
                    )}
                  />
                </button>
                {walletsOpen && (
                  <div className="ml-6 mt-0.5 space-y-0.5">
                    {item.children.map((child) => {
                      const childActive = pathname === child.href
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors",
                            childActive
                              ? "bg-gray-100 font-medium text-gray-900"
                              : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                          )}
                        >
                          <child.icon className="h-3.5 w-3.5 shrink-0" />
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href!)
          return (
            <Link
              key={item.href}
              href={item.href!}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
