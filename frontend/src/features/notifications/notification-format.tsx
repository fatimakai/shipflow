import type { NotificationResponseDto } from "@/api/generated"
import { AlertTriangle, Building2, CreditCard } from "lucide-react"

export function NotificationCategoryIcon({
  category,
}: {
  category: NotificationResponseDto["category"]
}) {
  if (category === "BILLING") {
    return <CreditCard className="h-4 w-4 text-warning" aria-hidden="true" />
  }
  if (category === "SECURITY") {
    return <AlertTriangle className="h-4 w-4 text-danger" aria-hidden="true" />
  }
  return <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
}
