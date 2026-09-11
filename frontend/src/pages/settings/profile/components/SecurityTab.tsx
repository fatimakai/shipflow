import { ActiveSessionsCard } from "./ActiveSessionsCard"
import { ChangePasswordCard } from "./ChangePasswordCard"
import { TwoFactorCard } from "./TwoFactorCard"

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />
      <TwoFactorCard />
      <ActiveSessionsCard />
    </div>
  )
}
