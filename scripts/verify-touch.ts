import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:44117/");
  await page.waitForFunction(() => (window as unknown as { __LOTUS_STUDY__?: { diagnostics: () => { rendered?: boolean } } }).__LOTUS_STUDY__?.diagnostics().rendered, undefined, { timeout: 120_000 });
  const before = await page.evaluate(() => { const script = (window as unknown as { __LOTUS_STUDY__: { scene: { interactiveCameraScript: { theta: number; phi: number } } } }).__LOTUS_STUDY__.scene.interactiveCameraScript; return { theta: script.theta, phi: script.phi }; });
  const client = await context.newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: 110, y: 320, id: 1, radiusX: 5, radiusY: 5, force: 1 }] });
  for (let i = 1; i <= 12; i++) {
    await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: 110 + 10 * i, y: 320 + 3 * i, id: 1, radiusX: 5, radiusY: 5, force: 1 }] });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => { const script = (window as unknown as { __LOTUS_STUDY__: { scene: { interactiveCameraScript: { theta: number; phi: number } } } }).__LOTUS_STUDY__.scene.interactiveCameraScript; return { theta: script.theta, phi: script.phi }; });
  console.log(JSON.stringify({ before, after, changed: before.theta !== after.theta || before.phi !== after.phi }, null, 2));
  await browser.close();
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
