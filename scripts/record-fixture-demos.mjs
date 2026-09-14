import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = process.env.VIDEO_DIR
  ? process.env.VIDEO_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "..", "video");
const outDir = root;
mkdirSync(outDir, { recursive: true });

const SIZE = { width: 1440, height: 900 };

async function hold(page, ms) {
  await page.waitForTimeout(ms);
}

async function settle(page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await hold(page, 800);
}

async function recordHeadcount(browser) {
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 2,
    recordVideo: { dir: join(outDir, "raw-headcount"), size: SIZE },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/events\//);
  await settle(page);
  await hold(page, 2500);

  await page.locator("section").filter({ hasText: "No wave yet" }).getByRole("link", { name: "New wave" }).click();
  await settle(page);
  await hold(page, 1500);
  await page.locator("pre").first().scrollIntoViewIfNeeded();
  await hold(page, 3500);
  await page.getByRole("button", { name: "Confirm wave" }).scrollIntoViewIfNeeded();
  await hold(page, 800);
  await page.getByRole("button", { name: "Confirm wave" }).click();

  await page.waitForURL(/\/events\/evt_bennett_valley$/);
  await page.getByRole("heading", { name: "In progress" }).waitFor({ timeout: 15_000 });
  await hold(page, 12_000);

  await page.getByRole("heading", { name: "Unaccounted" }).waitFor({ timeout: 50_000 });
  await page.getByRole("link", { name: /Household 02/ }).waitFor({ timeout: 50_000 });
  await hold(page, 4000);

  await page.getByRole("link", { name: /Household 02/ }).click();
  await settle(page);
  await hold(page, 4000);
  await page.getByRole("navigation").getByRole("link", { name: "Coverage" }).click();
  await settle(page);

  const unsupported = page.getByRole("link", { name: /Household 07/ });
  if (await unsupported.count()) {
    await unsupported.click();
    await settle(page);
    await page.locator("table").first().scrollIntoViewIfNeeded();
    await hold(page, 4500);
    await page.getByText("Call reel").scrollIntoViewIfNeeded();
    await hold(page, 5000);
    await page.getByRole("navigation").getByRole("link", { name: "Coverage" }).click();
    await settle(page);
  }

  const emergency = page.getByRole("link", { name: /Household 04/ });
  if (await emergency.count()) {
    await emergency.click();
    await settle(page);
    await hold(page, 3500);
    await page.getByRole("navigation").getByRole("link", { name: "Coverage" }).click();
    await settle(page);
  }

  await page.getByText("Coverage reel").scrollIntoViewIfNeeded();
  await hold(page, 6000);

  const video = page.video();
  await context.close();
  const src = await video.path();
  return src;
}

async function recordVouch(browser) {
  const context = await browser.newContext({
    viewport: SIZE,
    deviceScaleFactor: 2,
    recordVideo: { dir: join(outDir, "raw-vouch"), size: SIZE },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);

  await page.goto("http://localhost:3001", { waitUntil: "domcontentloaded" });
  await settle(page);
  await hold(page, 2500);

  await page.getByRole("link", { name: /Alex Rivera/ }).click();
  await settle(page);
  await hold(page, 2500);
  await page.getByText(/California SB 1162|Salary history/).first().scrollIntoViewIfNeeded();
  await hold(page, 2500);
  await page.locator("pre").first().scrollIntoViewIfNeeded();
  await hold(page, 2500);
  await page.getByRole("button", { name: "Confirm dial" }).click();

  await page.waitForURL(/\/$/);
  await settle(page);
  await hold(page, 14_000);

  await page.getByRole("link", { name: /Jordan Hale/ }).click();
  await settle(page);
  await hold(page, 3500);
  await page.getByRole("link", { name: "Board" }).click();
  await settle(page);

  await page.getByRole("link", { name: /Sam Cole/ }).click();
  await settle(page);
  await hold(page, 2000);
  await page.getByRole("button", { name: "Confirm dial" }).click();
  await page.waitForURL(/\/$/);
  await settle(page);
  await hold(page, 14_000);

  await page.getByText("Verification reel").scrollIntoViewIfNeeded();
  await hold(page, 5000);

  const video = page.video();
  await context.close();
  const src = await video.path();
  return src;
}

const browser = await chromium.launch({ headless: true });
try {
  console.log("[record] headcount…");
  const headcount = await recordHeadcount(browser);
  console.log("[record] headcount raw", headcount);
  console.log("[record] vouch…");
  const vouch = await recordVouch(browser);
  console.log("[record] vouch raw", vouch);
} finally {
  await browser.close();
}
