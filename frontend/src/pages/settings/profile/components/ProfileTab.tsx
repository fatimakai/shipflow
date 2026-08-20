import { AvatarCard } from "./AvatarCard"
import { PersonalInfoCard } from "./PersonalInfoCard"

export function ProfileTab() {
  return (
    <div className="space-y-6">
      <AvatarCard />
      <PersonalInfoCard />
    </div>
  )
}
