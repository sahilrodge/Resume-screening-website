const { chromium } = require("playwright")

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const bag = { pageErrors: [], console: [], failed: [] }

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      bag.console.push({ text: msg.text(), url: page.url() })
    }
  })
  page.on("pageerror", (err) => {
    bag.pageErrors.push({ url: page.url(), text: String(err?.stack || err) })
  })
  page.on("response", (res) => {
    if (res.status() >= 500) {
      bag.failed.push({ url: res.url(), status: res.status() })
    }
  })

  const email = `runtime.${Date.now()}@example.com`
  const password = "Password123!"
  await page.request.post("http://127.0.0.1:8000/api/v1/auth/register", {
    data: { email, password, full_name: "Runtime Tester", role: "candidate" },
  })

  await page.goto("http://127.0.0.1:3000/login", { waitUntil: "networkidle" })
  await page.fill("#email", email)
  await page.fill("#password", password)
  await page.click('button[type="submit"]')
  await page.waitForURL("**/portal**", { timeout: 15000 })
  console.log("AFTER_LOGIN", page.url())

  const routes = [
    "/portal",
    "/portal/jobs",
    "/portal/profile",
    "/portal/screening",
    "/portal/settings",
    "/portal/notifications",
    "/portal/assistant",
  ]

  for (const route of routes) {
    await page.goto("http://127.0.0.1:3000" + route, {
      waitUntil: "networkidle",
      timeout: 60000,
    })
    await page.waitForTimeout(800)
    const bodyText = await page.locator("body").innerText().catch(() => "")
    const hasAppError =
      /Application error|Unhandled Runtime Error|client-side exception|Minified React error/i.test(
        bodyText
      )
    console.log("DESKTOP", route, "->", page.url(), "ERR?", hasAppError)
    if (hasAppError) {
      bag.pageErrors.push({ url: page.url(), text: bodyText.slice(0, 800) })
    }
  }

  await page.setViewportSize({ width: 390, height: 844 })
  for (const route of ["/portal", "/portal/profile", "/portal/jobs", "/portal/settings"]) {
    await page.goto("http://127.0.0.1:3000" + route, {
      waitUntil: "networkidle",
      timeout: 60000,
    })
    await page.waitForTimeout(800)
    const bodyText = await page.locator("body").innerText().catch(() => "")
    const hasAppError =
      /Application error|Unhandled Runtime Error|client-side exception|Minified React error/i.test(
        bodyText
      )
    console.log("MOBILE", route, "->", page.url(), "ERR?", hasAppError)
    if (hasAppError) {
      bag.pageErrors.push({
        url: page.url() + "@mobile",
        text: bodyText.slice(0, 800),
      })
    }
  }

  // Profile edit smoke
  await page.goto("http://127.0.0.1:3000/portal/profile", {
    waitUntil: "networkidle",
    timeout: 60000,
  })
  const edit = page.getByRole("button", { name: /Edit profile/i })
  if (await edit.count()) {
    await edit.click()
    await page.fill("#full_name", "Runtime Tester Updated")
    await page.getByRole("button", { name: /Save profile/i }).click()
    await page.waitForTimeout(2000)
    console.log("PROFILE_SAVE_URL", page.url())
  }

  const filtered = bag.console.filter(
    (c) =>
      !/401|favicon|Download the React DevTools/i.test(c.text) &&
      /hydrat|Error|exception|TypeError|undefined/i.test(c.text)
  )

  console.log(
    JSON.stringify(
      {
        pageErrors: bag.pageErrors,
        console: filtered.slice(0, 40),
        failed5xx: bag.failed.slice(0, 20),
      },
      null,
      2
    )
  )

  await browser.close()
  if (bag.pageErrors.length) process.exit(1)
})().catch((e) => {
  console.error("SCRIPT_FAIL", e)
  process.exit(1)
})
