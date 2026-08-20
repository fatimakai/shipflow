import { LogOut, Menu, Settings, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getUserDisplayName, getUserInitials } from "@/features/auth/auth-user"
import { signOut } from "@/features/auth/auth-session"
import { NotificationMenu } from "@/features/notifications/components/NotificationMenu"
import { useAuthStore } from "@/stores/auth.store"
import { useNavigate } from "react-router-dom"
import { hasOrganizationCapability } from "@/features/organizations/organization-capabilities"
import { useActiveOrganization } from "@/features/organizations/organization-queries"

interface TopbarProps {
  openSidebar: () => void
}

export function Topbar({ openSidebar }: TopbarProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const organization = useActiveOrganization()

  if (!user) {
    return null
  }

  const displayName = getUserDisplayName(user)
  const canReadNotifications = hasOrganizationCapability(
    organization,
    "notification:read"
  )
  const canManageNotifications = hasOrganizationCapability(
    organization,
    "notification:manage"
  )

  return (
    <header className="h-14 border-b border-border bg-background flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      <div className="flex items-center">
        <button
          onClick={openSidebar}
          aria-label="Open menu"
          className="lg:hidden p-2 -ml-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        {organization && canReadNotifications && (
          <NotificationMenu
            canManage={canManageNotifications}
            organization={organization}
          />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Open account menu"
            className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          >
            <Avatar className="h-8 w-8 border border-border">
              <AvatarImage
                src={user.avatarUrl ?? undefined}
                alt={displayName}
              />
              <AvatarFallback>{getUserInitials(user)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="bottom"
            align="end"
            sideOffset={8}
            className="w-56"
          >
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-foreground">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/profile")}>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings/password")}>
              <Settings className="h-4 w-4" />
              Security
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => void signOut().catch(() => undefined)}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
