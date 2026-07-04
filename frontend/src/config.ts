// Centralizes the backend URLs so they aren't hardcoded to localhost in
// five different files. Vite exposes any env var prefixed with VITE_ to
// browser code via import.meta.env - falls back to localhost defaults so
// local dev keeps working with zero setup.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:1234'

export const AUTH_API_URL = `${BASE_URL}/api/auth`
export const DOCUMENTS_API_URL = `${BASE_URL}/api/documents`
export const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:1234'
