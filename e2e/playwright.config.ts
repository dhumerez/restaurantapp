import { defineConfig, devices } from "@playwright/test";
import path from "path";

const STORAGE_DIR = path.join(__dirname, "test-results", "storage");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "list",
  timeout: 30000,
  expect: { timeout: 10000 },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    ignoreHTTPSErrors: true,
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "auth",
      testMatch: /auth\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
      // Auth tests handle their own login (testing the login flow itself)
    },
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(STORAGE_DIR, "admin.json"),
      },
    },
    {
      name: "waiter",
      testMatch: /waiter\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(STORAGE_DIR, "waiter.json"),
      },
    },
    {
      name: "kitchen",
      testMatch: /kitchen\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(STORAGE_DIR, "kitchen.json"),
      },
    },
    {
      name: "cashier",
      testMatch: /cashier\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: path.join(STORAGE_DIR, "cashier.json"),
      },
    },
    {
      name: "pwa",
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "realtime",
      testMatch: /realtime\.spec\.ts/,
      dependencies: ["setup"],
      // This spec manages its own contexts — both kitchen and waiter storage
      // states are loaded inside the test, so no project-level storageState.
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
