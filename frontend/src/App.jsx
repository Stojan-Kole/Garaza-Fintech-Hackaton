import { useState, useEffect, useCallback } from 'react'

import { getHealth, temporalAnalyze, temporalWatchlist } from './api'
import Header from './components/Header'
import TemporalForm from './components/TemporalForm'
import TemporalRiskPanel from './components/TemporalRiskPanel'
import WatchlistPanel from './components/WatchlistPanel'

export default function App() {
  const [health, setHealth]                 = useState(null)
  const [temporalResult, setTemporalResult] = useState(null)
  const [temporalLoading, setTemporalLoading] = useState(false)
  const [temporalError, setTemporalError]   = useState(null)
  const [watchlist, setWatchlist]           = useState(null)
  const [watchlistView, setWatchlistView]   = useState('top')

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const handleTemporalAnalyze = useCallback(async (payload) => {
    setTemporalLoading(true)
    setTemporalError(null)
    setWatchlist(null)
    try {
      const data = await temporalAnalyze(payload)
      setTemporalResult(data)
    } catch (err) {
      setTemporalError(err.message || 'Temporal analysis failed.')
    } finally {
      setTemporalLoading(false)
    }
  }, [])

  const handleTemporalWatchlist = useCallback(async (view = 'top') => {
    setTemporalLoading(true)
    setTemporalError(null)
    setTemporalResult(null)
    setWatchlistView(view)
    try {
      const data = await temporalWatchlist(50, view)
      setWatchlist(data)
    } catch (err) {
      setTemporalError(err.message || 'Watchlist fetch failed.')
    } finally {
      setTemporalLoading(false)
    }
  }, [])

  const handleWatchlistSelect = useCallback(async (entity) => {
    setTemporalLoading(true)
    setTemporalError(null)
    setWatchlist(null)
    try {
      const data = await temporalAnalyze({ entity_name: entity.name, top_k: 5 })
      setTemporalResult(data)
    } catch (err) {
      setTemporalError(err.message || 'Temporal analysis failed.')
    } finally {
      setTemporalLoading(false)
    }
  }, [])

  return (
    <div className="h-screen flex flex-col bg-bg-base text-slate-300 overflow-hidden font-sans">
      <Header health={health} />

      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: '288px 1fr 352px' }}
      >
        {/* Left — search + watchlist toggle */}
        <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1">
          <TemporalForm
            onAnalyze={handleTemporalAnalyze}
            onWatchlist={handleTemporalWatchlist}
            loading={temporalLoading}
          />
        </aside>

        {/* Main — results */}
        <main className="flex flex-col overflow-y-auto bg-bg-base">
          {temporalLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="relative mx-auto w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
                </div>
                <p className="text-sm text-slate-500">Running temporal risk analysis…</p>
                <p className="text-xs text-slate-700">Evaluating ownership graph features</p>
              </div>
            </div>
          )}

          {!temporalLoading && temporalError && (
            <div className="p-6">
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-xs text-red-400">
                {temporalError}
              </div>
            </div>
          )}

          {!temporalLoading && !temporalError && watchlist && (
            <WatchlistPanel entities={watchlist} view={watchlistView} onSelect={handleWatchlistSelect} />
          )}

          {!temporalLoading && !temporalError && !watchlist && !temporalResult && (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-xs">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-blue-400" stroke="currentColor" strokeWidth="1.5">
                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500 mb-1">Temporal Risk Prediction</p>
                <p className="text-xs text-slate-700 leading-relaxed">
                  Search for an entity to see its emerging risk score, historical trend,
                  and ownership graph exposure across 2016–2026.
                </p>
              </div>
            </div>
          )}

          {!temporalLoading && temporalResult && (
            <TemporalRiskPanel
              result={temporalResult}
              onSelectAlternate={(id) => {
                const match = temporalResult.search_candidates?.find(c => c.id === id)
                if (match) handleTemporalAnalyze({ entity_name: match.name, top_k: 5 })
              }}
            />
          )}
        </main>

        {/* Right — risk levels & score drivers */}
        <aside className="flex flex-col border-l border-slate-800/80 overflow-y-auto bg-bg-1">
          <div className="p-4 space-y-5">
            <div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                Risk Levels &amp; Actions
              </div>
              {[
                { range: '0–14',   level: 'LOW',       bar: 'bg-green-500',  badge: 'text-green-400',  action: 'No action required. Standard monitoring.' },
                { range: '15–34',  level: 'ELEVATED',  bar: 'bg-blue-500',   badge: 'text-blue-400',   action: 'Flag for periodic review. Watch for upward trend.' },
                { range: '35–59',  level: 'HIGH',      bar: 'bg-amber-500',  badge: 'text-amber-400',  action: 'Escalate to compliance officer. Enhanced due diligence.' },
                { range: '60–79',  level: 'VERY HIGH', bar: 'bg-orange-500', badge: 'text-orange-400', action: 'Senior review required. Consider transaction restrictions.' },
                { range: '80–100', level: 'CRITICAL',  bar: 'bg-red-500',    badge: 'text-red-400',    action: 'Immediate escalation. Block until cleared.' },
              ].map(({ range, level, bar, badge, action }) => (
                <div key={level} className="flex gap-2.5 mb-3">
                  <div className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${bar}`} />
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-[11px] font-bold ${badge}`}>{level}</span>
                      <span className="text-[10px] font-mono text-slate-600">{range}</span>
                    </div>
                    <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">{action}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                What Drives the Score
              </div>
              {[
                { label: 'Proximity to blacklisted entities', desc: 'Distance and connections to already-sanctioned nodes in the ownership graph — the strongest signal.' },
                { label: 'Ownership structure changes', desc: 'Rapid restructuring of ownership links in the 1–2 years before designation is a known pre-sanction pattern.' },
                { label: 'Network centrality', desc: 'Entities that act as hubs between many other entities carry higher systemic risk.' },
                { label: 'Name similarity to SDN list', desc: 'Phonetic and string closeness to names already on OFAC sanctions lists.' },
                { label: 'High-risk jurisdiction', desc: 'Nationality or registration in FATF-blacklisted or OFAC-sanctioned countries.' },
              ].map(({ label, desc }) => (
                <div key={label} className="mb-3">
                  <span className="text-[11px] text-slate-400 font-medium">{label}</span>
                  <p className="text-[10px] text-slate-600 leading-relaxed mt-0.5">{desc}</p>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-700 leading-relaxed">
              Model: Random Forest classifier on 17 ownership graph features.
              Score = estimated probability of pre-designation behavioral pattern × 100.
              Requires compliance officer review before any action is taken.
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
