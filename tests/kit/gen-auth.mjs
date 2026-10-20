#!/usr/bin/env node
/**
 * FIX-NOW Session 3 — generate tests/.auth/owner.json for the readability suite.
 *
 * Logs in as the seeded owner (seed-owner@mapleleaf.example.ca / SeedPass123!,
 * created by tests/scripts/seed-e2e.mjs) via the UI and saves the
 * storageState. Run after the app is up on KIT_BASE_URL (default
 * http://127.0.0.1:3100).
 *
 * Usage: node tests/kit/gen-auth.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE_URL = process.env.KIT_BASE_URL ?? 'http://127.0.0.1:3100';
const OUT = join(ROOT, 'tests', '.auth', 'owner.json');

const browser = await chromium.launch();
const context = await browser.newContext({
  baseURL: BASE_URL,
  locale: 'en-CA',
  timezoneId: 'America/Toronto',
});
const page = await context.newPage();

await page.goto('/login');
await page.fill('input[type="email"]', 'seed-owner@mapleleaf.example.ca');
await page.fill('input[type="password"]', 'SeedPass123!');
await page.click('button[type="submit"]');
// Business users land on /dashboard after login.
await page.waitForURL('**/dashboard', { timeout: 30000 });

mkdirSync(join(ROOT, 'tests', '.auth'), { recursive: true });
await context.storageState({ path: OUT });
console.log(`auth: saved ${OUT}`);

await browser.close();
