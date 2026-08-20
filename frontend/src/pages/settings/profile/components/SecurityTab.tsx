import { ActiveSessionsCard } from "./ActiveSessionsCard"
import { ChangePasswordCard } from "./ChangePasswordCard"

export function SecurityTab() {
  return (
    <div className="space-y-6">
      <ChangePasswordCard />
      <ActiveSessionsCard />
    </div>
  )
}
