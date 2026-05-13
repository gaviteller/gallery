self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "New message"
  const options = {
    body: data.body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag ?? "dm",
    renotify: true,
    data: { url: data.url ?? "/messages" },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/messages"
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
