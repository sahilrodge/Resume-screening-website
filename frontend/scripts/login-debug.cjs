const { chromium } = require("playwright")

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const net = []
  page.on("request", (req) => {
    if (req.url().includes("/auth/") || req.url().includes("/api/auth/")) {
      net.push({ type: "req", method: req.method(), url: req.url() })
    }
  })
  page.on("response", async (res) => {
    if (res.url().includes("/auth/") || res.url().includes("/api/auth/")) {
      let body = ""
      try {
        body = (await res.text()).slice(0, 300)
      } catch {}
      net.push({ type: "res", status: res.status(), url: res.url(), body })
    }
  })
  page.on("pageerror", (err) => console.log("PAGEERROR", err))
  page.on("console", (msg) => {
    const t = msg.text()
    if (msg.type() === "error" || t.includes("[authStorage]")) {
      console.log("CONSOLE", msg.type(), t.slice(0, 1200))
    }
  })

  const email = `uilogin.${Date.now()}@example.com`
  const password = "Password123!"
  await page.request.post("http://127.0.0.1:8000/api/v1/auth/register", {
    data: { email, password, full_name: "UI Login", role: "candidate" },
  })

  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" })
  await page.waitForSelector("#email")
  await page.locator("#email").click()
  await page.locator("#email").fill(email)
  await page.locator("#password").click()
  await page.locator("#password").fill(password)
  console.log("EMAIL_VALUE", await page.inputValue("#email"))
  console.log("PASS_VALUE_LEN", (await page.inputValue("#password")).length)
  await page.locator('button[type="submit"]').click()
  await page.waitForTimeout(5000)
  console.log("URL", page.url())
  console.log("NET", JSON.stringify(net, null, 2))
  console.log(
    "STORAGE",
    await page.evaluate(() => ({
      access: !!(
        localStorage.getItem("hirepulse_access_token") ||
        sessionStorage.getItem("hirepulse_access_token")
      ),
      refresh: !!(
        localStorage.getItem("hirepulse_refresh_token") ||
        sessionStorage.getItem("hirepulse_refresh_token")
      ),
      user:
        localStorage.getItem("hirepulse_user") ||
        sessionStorage.getItem("hirepulse_user"),
    }))
  )
  console.log("BODY", (await page.locator("body").innerText()).slice(0, 600))
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
