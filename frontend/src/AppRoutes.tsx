import { lazy, Suspense } from "react"
import { Navigate, Route, Routes } from "react-router-dom"

import { AdminLayout } from "./components/layout/AdminLayout"
import { PageLoading } from "./components/layout/PageLoading"
import {
  ProtectedRoute,
  PublicOnlyRoute,
} from "./features/auth/components/RouteGuards"
import { OrganizationCapabilityRoute } from "./features/organizations/components/OrganizationCapabilityRoute"

const Dashboard = lazy(() =>
  import("./pages/dashboard/Dashboard").then((module) => ({
    default: module.Dashboard,
  }))
)
const Profile = lazy(() =>
  import("./pages/settings/Profile").then((module) => ({
    default: module.Profile,
  }))
)
const Team = lazy(() =>
  import("./pages/settings/Team").then((module) => ({ default: module.Team }))
)
const Billing = lazy(() =>
  import("./pages/settings/Billing").then((module) => ({
    default: module.Billing,
  }))
)
const Notifications = lazy(() =>
  import("./pages/settings/Notifications").then((module) => ({
    default: module.Notifications,
  }))
)
const Files = lazy(() =>
  import("./pages/files/Files").then((module) => ({
    default: module.Files,
  }))
)
const OrganizationSettings = lazy(() =>
  import("./pages/settings/Organization").then((module) => ({
    default: module.OrganizationSettings,
  }))
)
const ForgotPasswordPage = lazy(() =>
  import("./features/auth/pages/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  }))
)
const LoginPage = lazy(() =>
  import("./features/auth/pages/LoginPage").then((module) => ({
    default: module.LoginPage,
  }))
)
const OAuthCallbackPage = lazy(() =>
  import("./features/auth/pages/OAuthCallbackPage").then((module) => ({
    default: module.OAuthCallbackPage,
  }))
)
const TwoFactorChallengePage = lazy(() =>
  import("./features/auth/pages/TwoFactorChallengePage").then((module) => ({
    default: module.TwoFactorChallengePage,
  }))
)
const RegisterPage = lazy(() =>
  import("./features/auth/pages/RegisterPage").then((module) => ({
    default: module.RegisterPage,
  }))
)
const ResetPasswordPage = lazy(() =>
  import("./features/auth/pages/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  }))
)
const VerifyEmailPage = lazy(() =>
  import("./features/auth/pages/VerifyEmailPage").then((module) => ({
    default: module.VerifyEmailPage,
  }))
)
const AcceptInvitationPage = lazy(() =>
  import("./features/organizations/pages/AcceptInvitationPage").then(
    (module) => ({ default: module.AcceptInvitationPage })
  )
)

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/auth/callback" element={<OAuthCallbackPage />} />
        <Route path="/auth/two-factor" element={<TwoFactorChallengePage />} />

        <Route element={<ProtectedRoute />}>
          <Route
            path="/invitations/accept"
            element={<AcceptInvitationPage />}
          />
          <Route element={<AdminLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route
              element={
                <OrganizationCapabilityRoute capability="membership:read" />
              }
            >
              <Route path="/team" element={<Team />} />
            </Route>
            <Route
              element={
                <OrganizationCapabilityRoute capability="billing:read" />
              }
            >
              <Route path="/billing" element={<Billing />} />
            </Route>
            <Route
              element={
                <OrganizationCapabilityRoute capability="notification:read" />
              }
            >
              <Route path="/notifications" element={<Notifications />} />
            </Route>
            <Route
              element={<OrganizationCapabilityRoute capability="file:read" />}
            >
              <Route path="/files" element={<Files />} />
            </Route>
            <Route
              element={
                <OrganizationCapabilityRoute capability="notification:manage" />
              }
            >
              <Route
                path="/notifications/settings"
                element={<Notifications />}
              />
            </Route>
            <Route path="/settings/profile" element={<Profile />} />
            <Route path="/settings/security" element={<Profile />} />
            <Route
              element={
                <OrganizationCapabilityRoute capability="organization:read" />
              }
            >
              <Route
                path="/settings/organization"
                element={<OrganizationSettings />}
              />
            </Route>
          </Route>
        </Route>

        <Route
          path="/settings/team"
          element={<Navigate to="/team" replace />}
        />
        <Route
          path="/settings/billing"
          element={<Navigate to="/billing" replace />}
        />
        <Route
          path="/settings/notifications"
          element={<Navigate to="/notifications" replace />}
        />
        <Route
          path="/settings/password"
          element={<Navigate to="/settings/security" replace />}
        />
        <Route
          path="/settings"
          element={<Navigate to="/settings/profile" replace />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}
