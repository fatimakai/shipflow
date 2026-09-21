import {
  LayoutDashboard,
  Settings,
  LogOut,
  X,
  Users,
  CreditCard,
  Bell,
  FolderOpen,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ShipFlowLogo } from "@/components/brand/ShipFlowLogo"
import { NavLink, useLocation } from "react-router-dom"
import { env } from "@/config/env"
import { ApiHealthIndicator } from "./ApiHealthIndicator"
import { getUserDisplayName, getUserInitials } from "@/features/auth/auth-user"
import { signOut } from "@/features/auth/auth-session"
import { useAuthStore } from "@/stores/auth.store"
import { OrganizationSwitcher } from "@/features/organizations/components/OrganizationSwitcher"
import type { OrganizationCapability } from "@/features/organizations/organization-capabilities"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { useActiveOrganization } from "@/features/organizations/organization-queries"

const mainNav = [
  { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  {
    name: "Team",
    path: "/team",
    icon: Users,
    capability: "membership:read",
  },
  {
    name: "Files",
    path: "/files",
    icon: FolderOpen,
    capability: "file:read",
  },
  {
    name: "Billing",
    path: "/billing",
    icon: CreditCard,
    capability: "billing:read",
  },
  {
    name: "Notifications",
    path: "/notifications",
    icon: Bell,
    capability: "notification:read",
  },
] satisfies Array<{
  capability?: OrganizationCapability
  icon: typeof LayoutDashboard
  name: string
  path: string
}>

const generalNav = [{ name: "Settings", path: "/settings", icon: Settings }]

interface SidebarProps {
  isOpen: boolean
  close: () => void
}

export function Sidebar({ isOpen, close }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const organization = useActiveOrganization()
  const displayName = user ? getUserDisplayName(user) : "ShipFlow user"

  const getLinkClass = (item: { name: string; path: string }) => {
    const isActive =
      item.path === "/settings" || item.path === "/notifications"
        ? location.pathname.startsWith(item.path)
        : location.pathname === item.path

    return `flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
      isActive
        ? "border-sidebar-primary bg-sidebar-accent text-sidebar-foreground"
        : "border-transparent text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
    }`
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[244px] flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="border-b border-sidebar-border px-4 pb-4 pt-5">
          <div className="flex items-center justify-between mb-4">
            <ShipFlowLogo inverse />
            <button
              onClick={close}
              aria-label="Close menu"
              className="cursor-pointer rounded-sm p-1 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <OrganizationSwitcher />
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 pt-6">
          <div className="mb-6">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
              Main
            </p>
            <div className="space-y-0.5">
              {mainNav
                .filter(
                  (item) =>
                    (item.path !== "/files" || !env.isPublicDemo) &&
                    (!item.capability ||
                      hasOrganizationCapability(organization, item.capability))
                )
                .map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={close}
                    className={() => getLinkClass(item)}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.name}
                  </NavLink>
                ))}
            </div>
          </div>

          <div>
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/50">
              General
            </p>
            <div className="space-y-0.5">
              {generalNav.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={close}
                  className={() => getLinkClass(item)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </div>
        </div>

        {env.isDevelopment && <ApiHealthIndicator />}

        {/* User Profile */}
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between rounded-sm p-2.5 transition-colors hover:bg-sidebar-accent">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={user?.avatarUrl ?? undefined}
                  alt={displayName}
                />
                <AvatarFallback>
                  {user ? getUserInitials(user) : "NS"}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium leading-tight text-sidebar-foreground">
                  {displayName}
                </span>
                <span className="text-xs text-sidebar-foreground/60">
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={() => void signOut().catch(() => undefined)}
              className="rounded-sm p-1.5 text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
