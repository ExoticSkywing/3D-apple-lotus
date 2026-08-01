import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

type StudyAPI = { diagnostics: () => { rendered?: boolean }; setColor: (value: string) => void; setView: (value: string) => void };

async function run() {
  await mkdir("evidence/qa", { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("RGBELoader: Bad File Format")) consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} ${r.failure()?.errorText}`));
  const response = await page.goto("http://45.8.22.65:44117/", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForFunction(() => (window as unknown as { __LOTUS_STUDY__?: { diagnostics: () => { rendered?: boolean } } }).__LOTUS_STUDY__?.diagnostics().rendered === true, undefined, { timeout: 120_000 });
  const states = [
    ["backLeft", "Orange"],
    ["front", "Orange"],
    ["back", "Blue"],
    ["backLeft", "Silver"],
  ] as const;
  for (const [view, color] of states) {
    await page.evaluate(({ view, color }) => { const api = (window as unknown as { __LOTUS_STUDY__?: StudyAPI }).__LOTUS_STUDY__; api?.setColor(color); api?.setView(view); }, { view, color });
    await page.waitForTimeout(1800);
    const dataUrl = await page.evaluate(() => document.querySelector("canvas")?.toDataURL("image/png") ?? null);
    if (dataUrl) await writeFile(`evidence/qa/mobile-${view}-${color}.png`, Buffer.from(dataUrl.split(",")[1], "base64"));
  }
  const diagnostics = await page.evaluate(() => (window as unknown as { __LOTUS_STUDY__?: StudyAPI }).__LOTUS_STUDY__?.diagnostics());
  console.log(JSON.stringify({ status: response?.status(), diagnostics, consoleErrors, pageErrors, failedRequests }, null, 2));
  await browser.close();
}

void run().catch((error) => { console.error(error); process.exitCode = 1; });
