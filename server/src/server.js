// This process now does two jobs on one HTTP server:
//   1. A REST API (/api/documents/...) for document METADATA - stateless,
//      backed by Postgres, used for "list my documents" / "create a
//      document" / basic document info.
//   2. The Yjs WebSocket sync layer - stateful, long-lived connections,
//      used for actual live document content and collaboration.
//
// They're different in nature (stateless HTTP vs. persistent sockets) but
// there's no reason they can't share one Node process and one port during
// development - we just attach both to the same underlying http.Server.

require('dotenv').config()

const http = require('http')
const express = require('express')
const cors = require('cors')
const WebSocket = require('ws')
const { setupWSConnection, setPersistence, setContentInitializor } = require('y-websocket/bin/utils')

const documentsRouter = require('./routes/documents')
const authRouter = require('./routes/auth')
const { persistence } = require('./persistence')
const { verifyToken } = require('./auth')
const { getDocumentRole } = require('./access')
const { attachPresenceBridge } = require('./presenceBridge')

// Tell y-websocket to use our Postgres-backed persistence hooks instead of
// the default (no persistence at all - documents live only in memory).
setPersistence(persistence)

// setContentInitializor runs once, the first time a given document is
// created in this process. Despite the name (it's meant for pre-loading
// document CONTENT), nothing stops us from also using this as the "a new
// room was just created here" hook to wire up its Redis presence bridge.
setContentInitializor((doc) => {
  attachPresenceBridge(doc)
  return Promise.resolve()
})

const PORT = process.env.PORT || 1234

const app = express()
// CORS_ORIGIN lets you lock this down to your deployed frontend's exact
// origin(s) in production - comma-separated if the app is reachable at more
// than one domain (e.g. a friendlier alias alongside the original Vercel
// URL). Defaults to "*" (allow anything) for local dev, where the frontend
// runs on a different port (5173) than this API.
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : '*'
app.use(cors({ origin: allowedOrigins }))
app.use(express.json()) // parse JSON request bodies into req.body

app.get('/', (_req, res) => {
  res.send('realtime doc editor: REST API + WebSocket server running')
})
app.use('/api/auth', authRouter)
app.use('/api/documents', documentsRouter)

const server = http.createServer(app)

const wss = new WebSocket.Server({ noServer: true })
wss.on('connection', (conn, req) => {
  console.log(`[ws connect] ${req.url}`)
  // The room name is now a real document id (passed from the frontend as
  // the WebsocketProvider's room argument), instead of the hardcoded
  // 'demo-room' from the last milestone.
  setupWSConnection(conn, req)
})

// Before letting a WebSocket connection through, verify the token AND that
// this user actually has at least "viewer" access to the requested
// document. The browser's WebSocket API can't send custom headers, so the
// frontend sends the JWT as a query string parameter instead
// (ws://.../<docId>?token=...) - y-websocket's client-side provider has a
// `params` option that appends exactly this kind of query string for us.
server.on('upgrade', async (request, socket, head) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    const docId = url.pathname.slice(1)
    const token = url.searchParams.get('token')

    const payload = token && verifyToken(token)
    if (!payload) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
      socket.destroy()
      return
    }

    const role = await getDocumentRole(docId, payload.sub)
    if (!role) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
      socket.destroy()
      return
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      // Tag the raw connection with who it belongs to, so if this user's
      // access is later revoked while they're still connected, we can find
      // and close THIS specific socket (see liveAccess.js).
      ws.userId = payload.sub
      wss.emit('connection', ws, request)
    })
  } catch (err) {
    console.error('[ws upgrade] rejected:', err.message)
    socket.destroy()
  }
})

server.listen(PORT, () => {
  console.log(`Server (REST + WebSocket) listening on http://localhost:${PORT}`)
})
