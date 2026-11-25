import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  // Live Gemini + grammar checker responses in POST /api/check-usage are slow.
  timeout: 60_000,
  // Serial workers avoid Gemini free-tier rate limits and local DB races.
  fullyParallel: false,
  workers: 1,
  // Retries absorb transient provider capacity spikes (e.g. Gemini 503).
  retries: process.env.CI ? 2 : 1,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
