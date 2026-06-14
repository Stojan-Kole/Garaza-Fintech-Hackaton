const API_BASE = ''  // Vite proxies /screen, /analyze, /health to localhost:8000

export async function screenPayment(payload) {
  const res = await fetch(`${API_BASE}/screen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function analyzeTransaction(payload) {
  const res = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error('API unavailable')
  return res.json()
}

export async function getEntityGraph(uid) {
  const res = await fetch(`${API_BASE}/graph/entity/${encodeURIComponent(uid)}`)
  if (!res.ok) throw new Error(`Graph API unavailable: HTTP ${res.status}`)
  return res.json()
}

export async function temporalAnalyze(payload) {
  const res = await fetch(`${API_BASE}/temporal/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function temporalWatchlist(limit = 50) {
  const res = await fetch(`${API_BASE}/temporal/watchlist?limit=${limit}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
