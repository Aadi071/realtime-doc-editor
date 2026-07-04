// Wires Postgres up as the persistence layer for y-websocket's in-memory
// documents. y-websocket calls persistence.bindState(docName, ydoc) exactly
// once, the first time a document is opened after the server started (or
// re-opened after everyone left and it was forgotten) - our job there is
// to load any previously-saved bytes into the fresh Y.Doc. It calls
// persistence.writeState(docName, ydoc) when the last connected client
// disconnects, so we can flush a final save before the doc is dropped from
// memory.
const Y = require('yjs')
const debounce = require('lodash.debounce')
const { pool } = require('./db')

// One debounced save function per open document, so that typing in
// document A doesn't reset document B's save timer, and so each document
// gets its own independent "wait for a pause in typing" window.
const debouncedSavers = new Map()

async function loadSnapshot(docName) {
  const { rows } = await pool.query(
    'select content from documents where id = $1',
    [docName],
  )
  return rows[0]?.content || null
}

async function saveSnapshot(docName, ydoc) {
  // encodeStateAsUpdate() serializes the ENTIRE current document state
  // (not just the latest edit) into one binary blob - simple to store and
  // simple to reload, at the cost of re-sending the whole doc each save
  // instead of an incremental diff. Fine for a document-sized amount of
  // data; a very large/high-traffic doc might want incremental updates
  // instead, but that's a later optimization, not a correctness issue.
  const update = Buffer.from(Y.encodeStateAsUpdate(ydoc))
  await pool.query(
    'update documents set content = $1, updated_at = now() where id = $2',
    [update, docName],
  )
}

function getDebouncedSaver(docName) {
  if (!debouncedSavers.has(docName)) {
    debouncedSavers.set(
      docName,
      debounce(
        (ydoc) => {
          saveSnapshot(docName, ydoc).catch((err) => {
            console.error(`[persistence] failed to save "${docName}":`, err)
          })
        },
        2000, // wait 2s after the last edit before saving...
        { maxWait: 10000 }, // ...but never wait longer than 10s if edits keep coming
      ),
    )
  }
  return debouncedSavers.get(docName)
}

const persistence = {
  bindState: async (docName, ydoc) => {
    try {
      const existing = await loadSnapshot(docName)
      if (existing) {
        Y.applyUpdate(ydoc, existing)
        console.log(`[persistence] loaded saved content for "${docName}"`)
      } else {
        console.log(`[persistence] no saved content yet for "${docName}"`)
      }
    } catch (err) {
      console.error(`[persistence] failed to load "${docName}":`, err)
    }

    // Every future change to this doc (from ANY connected client) reschedules
    // the debounced save below.
    ydoc.on('update', () => {
      getDebouncedSaver(docName)(ydoc)
    })
  },

  writeState: async (docName, ydoc) => {
    // The last client just disconnected. Cancel any pending debounced call
    // and save immediately instead, so we don't lose up to ~2s of edits
    // sitting in the debounce window when the doc gets dropped from memory.
    const saver = debouncedSavers.get(docName)
    if (saver) saver.cancel()
    await saveSnapshot(docName, ydoc)
    console.log(`[persistence] flushed final save for "${docName}"`)
  },
}

module.exports = { persistence }
