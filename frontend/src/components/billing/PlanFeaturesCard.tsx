import type { BillingPlanResponseDto } from "@/api/generated"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check } from "lucide-react"

interface PlanFeaturesCardProps {
  plan: BillingPlanResponseDto
}

export function PlanFeaturesCard({ plan }: PlanFeaturesCardProps) {
  return (
    <Card>
      <CardHeader className="border-b border-border">
        <CardTitle>Included with {plan.name}</CardTitle>
        <CardDescription>Your current entitlement set</CardDescription>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        {plan.features.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This plan has no additional feature entitlements.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-2 text-sm">
                <Check
                  className="mt-0.5 h-4 w-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span className="text-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
