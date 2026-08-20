import { LockKeyhole } from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"

interface AccessRestrictedProps {
  description?: string
  title?: string
}

export function AccessRestricted({
  description = "Your current organization access does not include this page.",
  title = "Access restricted",
}: AccessRestrictedProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
        <LockKeyhole className="h-6 w-6" />
      </div>
      <h1 className="font-heading text-xl font-semibold text-foreground">
        {title}
      </h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {description}
      </p>
      <Button
        className="mt-5"
        variant="outline"
        render={<Link to="/dashboard" />}
      >
        Back to dashboard
      </Button>
    </div>
  )
}
