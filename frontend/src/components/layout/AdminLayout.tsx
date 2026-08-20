import { Suspense, useState } from "react"
import { Outlet } from "react-router-dom"

import { EmailVerificationBanner } from "@/features/auth/components/EmailVerificationBanner"
import { OrganizationBootstrap } from "@/features/organizations/components/OrganizationBootstrap"

import { PageLoading } from "./PageLoading"
import { Sidebar } from "./Sidebar"
import { Topbar } from "./Topbar"

export function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <OrganizationBootstrap>
      <div className="flex h-screen overflow-hidden bg-secondary">
        <Sidebar isOpen={isSidebarOpen} close={() => setIsSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Topbar openSidebar={() => setIsSidebarOpen(true)} />
          <EmailVerificationBanner />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <Suspense fallback={<PageLoading />}>
              <Outlet />
            </Suspense>
          </main>
        </div>
      </div>
    </OrganizationBootstrap>
  )
}
