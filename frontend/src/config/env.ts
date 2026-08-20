import { z } from "zod"

const featureFlag = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true")

const environmentSchema = z.object({
  VITE_API_BASE_URL: z.url().default("http://localhost:3000/api/v1"),
  VITE_APP_URL: z.url().default("http://localhost:5173"),
  VITE_GITHUB_OAUTH_ENABLED: featureFlag,
  VITE_GOOGLE_OAUTH_ENABLED: featureFlag,
})

const result = environmentSchema.safeParse(import.meta.env)

if (!result.success) {
  throw new Error(
    `Invalid frontend environment:\n${z.prettifyError(result.error)}`
  )
}

export const env = {
  apiBaseUrl: result.data.VITE_API_BASE_URL.replace(/\/$/, ""),
  appUrl: result.data.VITE_APP_URL.replace(/\/$/, ""),
  githubOAuthEnabled: result.data.VITE_GITHUB_OAUTH_ENABLED,
  googleOAuthEnabled: result.data.VITE_GOOGLE_OAUTH_ENABLED,
  isDevelopment: import.meta.env.DEV,
} as const
