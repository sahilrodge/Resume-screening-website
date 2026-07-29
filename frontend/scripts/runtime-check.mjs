const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  const pageErrors = [];
  const failed = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push({ url: page.url(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push({ url: page.url(), text: String(err?.stack || err) });
  });
  page.on("response", (res) => {
    if (res.status() >= 500) failed.push({ url: res.url(), status: res.status() });
  });

  for (const route of ["/login", "/register"]) {
    await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(800);
  }

  const email = `runtime.${Date.now()}@example.com`;
  const password = "Password123!";
  const reg = await page.request.post("http://127.0.0.1:8000/api/v1/auth/register", {
    data: { email, password, full_name: "Runtime Tester", role: "candidate" },
  });
  const regBody = await reg.json().catch(() => ({}));
  console.log("REGISTER_STATUS", reg.status(), regBody?.user?.role || JSON.stringify(regBody).slice(0, 200));

  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  console.log("AFTER_LOGIN", page.url());

  for (const route of [
    "/portal",
    "/portal/jobs",
    "/portal/profile",
    "/portal/screening",
    "/portal/settings",
    "/portal/notifications",
    "/portal/assistant",
  ]) {
    try {
      await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);
      console.log("VISITED", route, "->", page.url());
    } catch (e) {
      pageErrors.push({ url: route, text: "NAV_FAIL " + e.message });
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ["/portal", "/portal/profile", "/portal/jobs"]) {
    try {
      await page.goto("http://127.0.0.1:3000" + route, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1200);
      console.log("MOBILE", route, "->", page.url());
    } catch (e) {
      pageErrors.push({ url: route + "@mobile", text: "NAV_FAIL " + e.message });
    }
  }

  console.log(JSON.stringify({ pageErrors, errors: errors.slice(0, 80), failed: failed.slice(0, 40) }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error("SCRIPT_FAIL", e);
  process.exit(1);
});
