/* HirePulse Web Push service worker */
self.addEventListener("push", (event) => {
  let data = { title: "HirePulse", body: "You have a new notification", url: "/notifications" }
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() }
    }
  } catch {
    // ignore parse errors
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "HirePulse", {
      body: data.body,
      data: { url: data.url || "/notifications" },
      icon: "/favicon.ico",
    })
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url || "/notifications"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url)
      }
      return undefined
    })
  )
})
