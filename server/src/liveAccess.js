// Lets us reach into an already-open WebSocket connection when someone's
// access to a document changes, instead of only affecting future
// connections. y-websocket exports its live `docs` Map (docId -> the
// in-memory WSSharedDoc for that room) precisely so other code in the same
// process can do things like this.
const { docs } = require('y-websocket/bin/utils')

// If this user currently has an open connection to this document, close it
// immediately. Used when their access is REVOKED entirely - a hard,
// immediate cutoff, rather than waiting for them to notice on a poll or
// for their connection to naturally drop. Their client will try to
// reconnect automatically (that's built into WebsocketProvider); the
// server's upgrade handler will re-check permissions on that attempt and
// reject it, since the share row is already gone.
function disconnectUserFromDoc(docId, userId) {
  const doc = docs.get(docId)
  if (!doc) return // nobody has this document open right now - nothing to do

  for (const conn of doc.conns.keys()) {
    if (conn.userId === userId) {
      conn.close(4001, 'access revoked')
    }
  }
}

module.exports = { disconnectUserFromDoc }
