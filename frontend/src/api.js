const API_BASE = ''  // Vite proxies /temporal/* and /health to localhost:8000

export async function getHealth() {
  const res = await fetch(`${API_BASE}/health`)
  if (!res.ok) throw new Error('API unavailable')
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

export async function temporalWatchlist(limit = 50, view = 'top') {
  const res = await fetch(`${API_BASE}/temporal/watchlist?limit=${limit}&view=${view}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
