import { Shield, User } from "lucide-react"
import { useLocation, useNavigate } from "react-router-dom"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/stores/auth.store"

import { ProfileTab } from "./profile/components/ProfileTab"
import { SecurityTab } from "./profile/components/SecurityTab"

export function Profile() {
  const user = useAuthStore((state) => state.user)
  const location = useLocation()
  const navigate = useNavigate()
  const isSecurity = location.pathname.endsWith("/security")

  if (!user) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Profile & Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your account details and security.
        </p>
      </div>

      <Tabs
        value={isSecurity ? "security" : "profile"}
        onValueChange={(value) =>
          navigate(
            value === "security" ? "/settings/security" : "/settings/profile"
          )
        }
        className="space-y-6"
      >
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-0 outline-none">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="security" className="mt-0 outline-none">
          <SecurityTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
