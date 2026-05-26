import { defineConfig } from "vitest/config"
import tsconfigPaths from "vite-tsconfig-paths"

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    env: Object.fromEntries(
      (() => {
        const fs = require("fs")
        const path = require("path")
        const envFile = path.resolve(__dirname, ".env.local")
        if (!fs.existsSync(envFile)) return []
        return fs.readFileSync(envFile, "utf-8")
          .split("\n")
          .filter((line: string) => line.includes("=") && !line.startsWith("#"))
          .map((line: string) => {
            const idx = line.indexOf("=")
            const key = line.slice(0, idx).trim()
            const val = line.slice(idx + 1).trim().replace(/^"|"$/g, "")
            return [key, val]
          })
      })()
    ),
  },
})
