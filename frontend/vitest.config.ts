import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.ts"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      clearMocks: true,
      environment: "jsdom",
      include: ["src/**/*.{test,spec}.{ts,tsx}"],
      restoreMocks: true,
      setupFiles: ["./src/test/setup.ts"],
    },
  })
)
