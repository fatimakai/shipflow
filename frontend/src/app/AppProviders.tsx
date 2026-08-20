import { QueryClientProvider } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"

import { queryClient } from "@/api/query-client"
import { Toaster } from "@/components/ui/sonner"

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster position="bottom-right" richColors />
    </QueryClientProvider>
  )
}
