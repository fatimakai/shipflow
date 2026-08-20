import { defineConfig } from "@hey-api/openapi-ts"

export default defineConfig({
  input: process.env.OPENAPI_URL ?? "http://localhost:3000/api/docs-json",
  output: "src/api/generated",
  plugins: ["@hey-api/typescript"],
})
