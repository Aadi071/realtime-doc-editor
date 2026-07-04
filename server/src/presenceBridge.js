// Why this file exists: y-websocket already relays awareness (presence)
// updates between clients connected to the SAME server process, entirely
// in memory - no Redis needed for that. But if you ever run more than one
// server instance behind a load balancer (which is the whole point of
// Node.js + horizontal scaling in production), a user connected to
// instance A would never see cursor updates from a user connected to
// instance B - they don't share memory.
//
// Redis Pub/Sub fixes this: every server instance publishes its local
// awareness changes to a Redis channel for that document, AND subscribes
// to that same channel to receive updates from every OTHER instance, then
// re-broadcasts those to its own locally-connected clients. Redis is a
// good fit here because presence is ephemeral and doesn't need Postgres's
// durability - if Redis restarts, everyone just re-announces their cursor
// on their next natural awareness update.
const Redis = require('ioredis')
const awarenessProtocol = require('y-protocols/awareness')

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'

// Called once per document (from server.js's setContentInitializor hook,
// which - despite the name - just runs once when a document is first
// created in this process, which is exactly when we want to start
// bridging its awareness to Redis).
function attachPresenceBridge(doc) {
  const channel = `presence:${doc.name}`
  const publisher = new Redis(REDIS_URL)
  const subscriber = new Redis(REDIS_URL)

  subscriber.subscribe(channel).catch((err) => {
    console.error(`[presence] failed to subscribe to ${channel}:`, err)
  })

  subscriber.on('message', (_channel, message) => {
    try {
      const { update } = JSON.parse(message)
      // "redis-remote" marks this as having come from another server
      // instance (via Redis), not a directly-connected client - see the
      // origin check below, which stops us re-publishing it right back to
      // Redis and looping forever.
      awarenessProtocol.applyAwarenessUpdate(
        doc.awareness,
        Uint8Array.from(Buffer.from(update, 'base64')),
        'redis-remote',
      )
    } catch (err) {
      console.error(`[presence] failed to apply update for ${doc.name}:`, err)
    }
  })

  doc.awareness.on('update', (changes, origin) => {
    if (origin === 'redis-remote') return // don't echo remote updates back out

    const changedClients = changes.added.concat(changes.updated, changes.removed)
    const update = awarenessProtocol.encodeAwarenessUpdate(doc.awareness, changedClients)
    publisher
      .publish(channel, JSON.stringify({ update: Buffer.from(update).toString('base64') }))
      .catch((err) => console.error(`[presence] failed to publish for ${doc.name}:`, err))
  })

  doc.on('destroy', () => {
    subscriber.unsubscribe(channel).catch(() => {})
    subscriber.quit().catch(() => {})
    publisher.quit().catch(() => {})
  })
}

module.exports = { attachPresenceBridge }
