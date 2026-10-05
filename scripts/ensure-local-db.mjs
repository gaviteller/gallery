import { existsSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import { spawn } from "node:child_process"

const host = "127.0.0.1"
const port = 55432

function canConnect() {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    const finish = (result) => {
      socket.destroy()
      resolve(result)
    }
    socket.setTimeout(500)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
  })
}

if (process.platform === "win32" && !(await canConnect())) {
  const dataDir = path.resolve(process.cwd(), "..", "pgdata-gallery")
  const candidates = [
    "C:\\Program Files\\PostgreSQL\\18\\bin\\postgres.exe",
    "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe",
  ]
  const postgres = candidates.find(existsSync)

  if (postgres && existsSync(dataDir)) {
    const child = spawn(postgres, ["-D", dataDir, "-p", String(port)], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    })
    child.unref()

    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250))
      if (await canConnect()) break
    }
  }
}
