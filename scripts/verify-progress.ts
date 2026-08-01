import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const samples: number[] = [];
  await page.goto("http://127.0.0.1:44117/", { waitUntil: "domcontentloaded" });
  for (let index = 0; index < 120; index++) {
    const sample = await page.evaluate(() => {
      const loader = (window as unknown as { __LOTUS_STUDY__?: { scene: { loader?: { progress: number } } } }).__LOTUS_STUDY__?.scene.loader;
      const text = document.querySelector(".loading strong")?.textContent ?? "";
      return { raw: loader?.progress, shown: Number(text.match(/(\d+)%/)?.[1]) };
    });
    if (Number.isFinite(sample.shown)) samples.push(sample.shown);
    if (sample.shown === 100) break;
    await page.waitForTimeout(100);
  }
  const monotonic = samples.every((value, index) => index === 0 || value >= samples[index - 1]);
  console.log(JSON.stringify({ samples: samples.filter((value, index) => index === 0 || value !== samples[index - 1]), monotonic }, null, 2));
  await browser.close();
}
void run().catch((error) => { console.error(error); process.exitCode = 1; });
