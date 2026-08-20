import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { configureApiAuth } from "./api/api-client"
import { AppProviders } from "./app/AppProviders"
import {
  clearSessionState,
  refreshForApiClient,
} from "./features/auth/auth-session"
import "./index.css"
import App from "./App.tsx"
import { useAuthStore } from "./stores/auth.store"

configureApiAuth({
  clearSession: clearSessionState,
  getAccessToken: () => useAuthStore.getState().accessToken,
  refreshAccessToken: refreshForApiClient,
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
)
