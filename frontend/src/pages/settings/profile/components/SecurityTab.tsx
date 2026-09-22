import { env } from "@/config/env"

import { ActiveSessionsCard } from "./ActiveSessionsCard"
import { ChangePasswordCard } from "./ChangePasswordCard"
import { TwoFactorCard } from "./TwoFactorCard"

export function SecurityTab() {
  return (
    <div className="space-y-6">
      {!env.isPublicDemo && <ChangePasswordCard />}
      <TwoFactorCard />
      <ActiveSessionsCard />
    </div>
  )
}
