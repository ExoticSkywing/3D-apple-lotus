import "../src/lotus-types";
import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-dev-shm-usage"] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:44117/");
  await page.waitForFunction(() => window.__LOTUS_STUDY__?.diagnostics().rendered === true, undefined, { timeout: 120_000 });
  const client = await context.newCDPSession(page);
  const before = await page.evaluate(() => ({ scale: window.__LOTUS_STUDY__?.scene?.camera?._fovScale, theta: window.__LOTUS_STUDY__?.scene?.interactiveCameraScript?.theta }));
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 145, y: 390, id: 1 }, { x: 245, y: 390, id: 2 }] });
  for (let i = 1; i <= 10; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 145 - 5 * i, y: 390, id: 1 }, { x: 245 + 5 * i, y: 390, id: 2 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ scale: window.__LOTUS_STUDY__?.scene?.camera?._fovScale, theta: window.__LOTUS_STUDY__?.scene?.interactiveCameraScript?.theta }));
  console.log(JSON.stringify({ before, after, zoomChanged: before.scale !== after.scale, rotationDelta: Math.abs((after.theta ?? 0) - (before.theta ?? 0)), rotationStable: Math.abs((after.theta ?? 0) - (before.theta ?? 0)) < 0.001 }, null, 2));
  await browser.close();
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
