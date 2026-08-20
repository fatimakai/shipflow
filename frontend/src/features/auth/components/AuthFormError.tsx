import { AlertCircle } from "lucide-react"

interface AuthFormErrorProps {
  message?: string | null
}

export function AuthFormError({ message }: AuthFormErrorProps) {
  if (!message) {
    return null
  }

  return (
    <div
      className="flex gap-2.5 rounded-md border border-danger/20 bg-danger/10 px-3 py-2.5 text-sm text-danger"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  )
}
