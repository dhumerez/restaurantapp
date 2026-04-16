import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const STORAGE_DIR = path.join(__dirname, "..", "test-results", "storage");

setup.beforeAll(() => {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
});

setup("login as admin", async ({ page }) => {
  await page.goto("login");
  await page.getByPlaceholder(/correo electrónico/i).fill("admin@demo.com");
  await page.getByPlaceholder(/contraseña/i).fill("password123");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/admin/, { timeout: 10000 });
  await page.context().storageState({ path: path.join(STORAGE_DIR, "admin.json") });
});

setup("login as waiter", async ({ page }) => {
  await page.goto("login");
  await page.getByPlaceholder(/correo electrónico/i).fill("waiter@demo.com");
  await page.getByPlaceholder(/contraseña/i).fill("password123");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/tables/, { timeout: 10000 });
  await page.context().storageState({ path: path.join(STORAGE_DIR, "waiter.json") });
});

setup("login as kitchen", async ({ page }) => {
  await page.goto("login");
  await page.getByPlaceholder(/correo electrónico/i).fill("kitchen@demo.com");
  await page.getByPlaceholder(/contraseña/i).fill("password123");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/kitchen/, { timeout: 10000 });
  await page.context().storageState({ path: path.join(STORAGE_DIR, "kitchen.json") });
});

setup("login as cashier", async ({ page }) => {
  await page.waitForTimeout(5000);
  await page.goto("login");
  await page.getByPlaceholder(/correo electrónico/i).fill("cashier@demo.com");
  await page.getByPlaceholder(/contraseña/i).fill("password123");
  await page.getByRole("button", { name: /iniciar sesión/i }).click();
  await expect(page).toHaveURL(/\/cashier/, { timeout: 10000 });
  await page.context().storageState({ path: path.join(STORAGE_DIR, "cashier.json") });
});
