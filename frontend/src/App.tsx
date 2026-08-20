import { BrowserRouter } from "react-router-dom"
import { AuthBootstrap } from "./features/auth/components/AuthBootstrap"
import { AppRoutes } from "./AppRoutes"

function App() {
  return (
    <BrowserRouter>
      <AuthBootstrap />
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
