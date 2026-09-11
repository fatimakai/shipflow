import {
  LayoutDashboard,
  Settings,
  LogOut,
  Hexagon,
  X,
  Users,
  CreditCard,
  Bell,
  FolderOpen,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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

    return `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
      isActive
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
        className={`fixed inset-y-0 left-0 z-50 w-[232px] flex flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-primary rounded-lg p-1.5">
                <Hexagon className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
              </div>
              <span className="font-heading font-bold text-lg text-foreground tracking-tight">
                ShipFlow
              </span>
            </div>
            <button
              onClick={close}
              aria-label="Close menu"
              className="lg:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <OrganizationSwitcher />
        </div>

        {/* Navigation */}
        <div className="flex-1 px-3 overflow-y-auto">
          <div className="mb-6">
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
              Main
            </p>
            <div className="space-y-0.5">
              {mainNav
                .filter(
                  (item) =>
                    !item.capability ||
                    hasOrganizationCapability(organization, item.capability)
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
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
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
        <div className="p-3 border-t border-border">
          <div className="flex items-center justify-between hover:bg-secondary p-2.5 rounded-lg cursor-pointer transition-colors">
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
                <span className="text-sm font-medium text-foreground leading-tight">
                  {displayName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.email}
                </span>
              </div>
            </div>
            <button
              type="button"
              aria-label="Log out"
              title="Log out"
              onClick={() => void signOut().catch(() => undefined)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
