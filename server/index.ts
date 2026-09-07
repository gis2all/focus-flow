import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { homedir } from 'node:os'
import { dirname, extname, isAbsolute, join, normalize, relative as relativePath } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { TimerSnapshot } from '@shared/types'
import { createServerComposition } from './composition'
import { dispatchRpc, type RpcServices } from './rpc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RENDERER_DIR = join(__dirname, '../renderer')
const DEFAULT_PORT = 5274
const DATA_DIR = join(homedir(), '.focusflow-web')

const port = Number(process.env.FOCUSFLOW_WEB_PORT ?? DEFAULT_PORT)
const host = process.env.FOCUSFLOW_WEB_HOST ?? '127.0.0.1'
const dataDir = process.env.FOCUSFLOW_WEB_DATA_DIR ?? DATA_DIR
const dbPath = join(dataDir, 'focusflow.sqlite')

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
}

const sseClients = new Set<ServerResponse>()

const broadcastSnapshot = (snapshot: TimerSnapshot): void => {
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`
  for (const response of sseClients) {
    if (!response.writableEnded) {
      response.write(payload)
    }
  }
}

const sendJson = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body === undefined ? null : body))
}

const handleRpc = async (
  request: IncomingMessage,
  response: ServerResponse,
  services: RpcServices
): Promise<void> => {
  let body = ''
  for await (const chunk of request) {
    body += chunk
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    sendJson(response, 400, { error: 'invalid json body' })
    return
  }

  try {
    const result = await dispatchRpc(services, parsed as { channel: string; payload?: unknown })
    sendJson(response, 200, result)
  } catch (error) {
    sendJson(response, 400, { error: error instanceof Error ? error.message : String(error) })
  }
}

const handleSse = (request: IncomingMessage, response: ServerResponse): void => {
  response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
  response.write(': connected\n\n')
  sseClients.add(response)
  request.on('close', () => {
    sseClients.delete(response)
  })
}

const serveStatic = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  let pathname: string
  try {
    pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://localhost').pathname)
  } catch {
    response.writeHead(400)
    response.end('Bad request')
    return
  }

  let filePath = normalize(join(RENDERER_DIR, pathname === '/' ? 'index.html' : pathname))
  const relative = relativePath(RENDERER_DIR, filePath)
  if (relative.startsWith('..') || isAbsolute(relative)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const fileStat = await stat(filePath)
    if (fileStat.isDirectory()) {
      filePath = join(filePath, 'index.html')
    }
    response.writeHead(200, { 'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream' })
    createReadStream(filePath).pipe(response)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
}

const main = async (): Promise<void> => {
  const composition = await createServerComposition(dbPath)
  const unsubscribe = composition.timer.onSnapshot(broadcastSnapshot)
  const tickId = setInterval(() => {
    void composition.timer.tick().catch((error) => console.error('[server] timer tick failed', error))
  }, 1_000)

  const shutdown = (): void => {
    clearInterval(tickId)
    unsubscribe()
    composition.dispose()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost')

    if (request.method === 'POST' && url.pathname === '/api/rpc') {
      void handleRpc(request, response, composition.services)
      return
    }
    if (request.method === 'GET' && url.pathname === '/api/events') {
      handleSse(request, response)
      return
    }
    if (request.method === 'GET') {
      void serveStatic(request, response)
      return
    }
    response.writeHead(405)
    response.end('Method Not Allowed')
  })

  server.listen(port, host, () => {
    console.log(`[server] FocusFlow web listening on http://${host}:${port}`)
    console.log(`[server] database: ${dbPath}`)
  })
}

void main().catch((error) => {
  console.error('[server] fatal startup error', error)
  process.exit(1)
})
