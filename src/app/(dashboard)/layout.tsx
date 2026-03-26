import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { Topbar } from "@/components/layout/topbar"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()
  if (!session) redirect("/login")

  return (
    <div className="flex h-full">
      <AppSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar userName={session.user?.name} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
        <footer className="shrink-0 border-t bg-white px-6 py-3 text-center text-xs text-gray-400">
          MVP by{" "}
          <a
            href="https://nandann.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
          >
            Nandann Creative
          </a>
        </footer>
      </div>
    </div>
  )
}
