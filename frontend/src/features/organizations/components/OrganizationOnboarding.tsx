import { Building2, LoaderCircle, LogOut } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { signOut } from "@/features/auth/auth-session"
import { EmailVerificationBanner } from "@/features/auth/components/EmailVerificationBanner"
import { useAuthStore } from "@/stores/auth.store"

import { CreateOrganizationDialog } from "./CreateOrganizationDialog"

export function OrganizationOnboarding() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const user = useAuthStore((state) => state.user)
  const canCreateOrganization = user?.emailVerified ?? false

  return (
    <div className="flex min-h-screen flex-col bg-secondary">
      <EmailVerificationBanner />
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="flex flex-col items-center px-6 py-12 text-center">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <h1 className="font-heading text-xl font-semibold text-foreground">
              Create your first organization
            </h1>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {canCreateOrganization
                ? "Organizations keep members, permissions, billing, and project data separated."
                : "Verify your email address before creating an organization."}
            </p>
            <Button
              className="mt-6"
              disabled={!canCreateOrganization}
              onClick={() => setIsCreateOpen(true)}
            >
              Create organization
            </Button>
            <Button
              className="mt-2"
              variant="ghost"
              disabled={isSigningOut}
              onClick={() => {
                setIsSigningOut(true)
                void signOut().catch(() => setIsSigningOut(false))
              }}
            >
              {isSigningOut ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <LogOut />
              )}
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
      <CreateOrganizationDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />
    </div>
  )
}
