import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PORT = 5275;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = resolve("screenshots");
mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function waitForServer(url, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Server failed to start at ${url} within ${timeout}ms`);
}

async function run() {
  console.log("Starting preview server on port " + PORT);
  const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    shell: true,
    stdio: "inherit",
  });

  try {
    await waitForServer(`${BASE_URL}/`);
    console.log("Preview server is ready!");

    const browser = await chromium.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
    });

    const context = await browser.newContext({
      viewport: { width: 1680, height: 1050 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();

    // 1. Home page in Simplified Chinese
    console.log("Capturing: 1_home_zh_CN.png");
    await page.goto(`${BASE_URL}/?mock=1`, { waitUntil: "networkidle" });
    await page.evaluate(() => {
      localStorage.setItem("komari_lang", "zh-CN");
    });
    await page.goto(`${BASE_URL}/?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".km-node-card");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/1_home_zh_CN.png` });

    // 2. Language picker dropdown opened
    console.log("Capturing: 2_home_language_dropdown.png");
    await page.click(".km-lang-btn");
    await page.waitForSelector(".km-lang-dropdown");
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/2_home_language_dropdown.png` });

    // 3. Switch to English
    console.log("Capturing: 3_home_en.png");
    await page.click(`.km-lang-item[data-lang="en"]`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/3_home_en.png` });

    // 4. Switch to Traditional Chinese
    console.log("Capturing: 4_home_zh_TW.png");
    await page.click(".km-lang-btn");
    await page.click(`.km-lang-item[data-lang="zh-TW"]`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/4_home_zh_TW.png` });

    // 5. Switch to Japanese
    console.log("Capturing: 5_home_ja.png");
    await page.click(".km-lang-btn");
    await page.click(`.km-lang-item[data-lang="ja"]`);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/5_home_ja.png` });

    // Switch back to zh-CN for detailed feature inspection
    await page.click(".km-lang-btn");
    await page.click(`.km-lang-item[data-lang="zh-CN"]`);
    await page.waitForTimeout(300);

    // 6. Instance Page - Tokyo GPU Node
    console.log("Capturing: 6_instance_gpu_node.png");
    await page.goto(`${BASE_URL}/instance/tokyo-gpu-node-01?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".km-instance-sheet");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/6_instance_gpu_node.png`, fullPage: true });

    // 7. Instance Page - SiliconValley Non-GPU Node (auto-detect hide verification)
    console.log("Capturing: 7_instance_no_gpu_node.png");
    await page.goto(`${BASE_URL}/instance/sv-vps-no-gpu-02?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector(".km-instance-sheet");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/7_instance_no_gpu_node.png`, fullPage: true });

    // 8. Instance Latency Chart (Tokyo GPU Node) - uncompressed mode
    console.log("Capturing: 8_instance_latency_chart.png");
    await page.goto(`${BASE_URL}/instance/tokyo-gpu-node-01?mock=1`, { waitUntil: "networkidle" });
    await page.waitForSelector("#km-latency-tab");
    await page.click("#km-latency-tab");
    await page.waitForSelector(".km-chart-card--latency svg");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/8_instance_latency_chart.png` });

    await browser.close();
    console.log("All screenshots captured successfully in " + SCREENSHOT_DIR);
  } finally {
    server.kill();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
