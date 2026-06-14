import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

import { screenPayment, analyzeTransaction, getHealth, temporalAnalyze, temporalWatchlist } from './api'
import Header from './components/Header'
import ScreeningForm from './components/ScreeningForm'
import VerdictBanner from './components/VerdictBanner'
import AnalysisLayers from './components/AnalysisLayers'
import CandidatesPanel from './components/CandidatesPanel'
import EntityDetails from './components/EntityDetails'
import AmendmentPanel from './components/AmendmentPanel'
import SessionHistory from './components/SessionHistory'
import WelcomeScreen from './components/WelcomeScreen'
import GraphIntelligencePanel from './components/GraphIntelligencePanel'
import AMLFlagsPanel from './components/AMLFlagsPanel'
import TemporalForm from './components/TemporalForm'
import TemporalRiskPanel from './components/TemporalRiskPanel'
import WatchlistPanel from './components/WatchlistPanel'

function LoadingOverlay({ isAnalysis }) {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-3">
        <div className="relative mx-auto w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
        </div>
        {isAnalysis ? (
          <>
            <p className="text-sm text-slate-500">Running AML rules engine…</p>
            <p className="text-xs text-slate-700">Checking 10 risk indicators</p>
          </>
        ) : (
          <>
            <p className="text-sm text-slate-500">Screening against OFAC SDN list…</p>
            <p className="text-xs text-slate-700">Comparing ~12,000 entities</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [appMode, setAppMode]               = useState('sanctions')  // 'sanctions' | 'temporal'
  const [result, setResult]                 = useState(null)
  const [resultType, setResultType]         = useState(null)   // 'screen' | 'analyze'
  const [activeCaseId, setActiveCaseId]     = useState(null)
  const [loading, setLoading]               = useState(false)
  const [isAnalysisLoading, setIsAnalysisLoading] = useState(false)
  const [error, setError]                   = useState(null)
  const [health, setHealth]                 = useState(null)
  const [sessionHistory, setSessionHistory] = useState([])
  const [amendments, setAmendments]         = useState({})
  const [activeCandidateIdx, setActiveCandidateIdx] = useState(0)
  const [graphEntity, setGraphEntity]       = useState(null)
  // Temporal state
  const [temporalResult, setTemporalResult] = useState(null)
  const [temporalLoading, setTemporalLoading] = useState(false)
  const [temporalError, setTemporalError]   = useState(null)
  const [watchlist, setWatchlist]           = useState(null)
  const idCounter = useRef(0)

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const handleSubmit = useCallback(async (formData) => {
    setLoading(true)
    setIsAnalysisLoading(false)
    setError(null)
    setActiveCandidateIdx(0)

    try {
      const data = await screenPayment(formData)
      const id = `case-${++idCounter.current}`
      const query = formData.name || formData.wallet_address || ''

      setResult(data)
      setResultType('screen')
      setActiveCaseId(id)
      setSessionHistory(prev => [
        { id, result: data, resultType: 'screen', timestamp: new Date().toISOString(), query },
        ...prev,
      ].slice(0, 30))
    } catch (err) {
      setError(err.message || 'Screening failed. Check the API is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAnalyze = useCallback(async (formData) => {
    setLoading(true)
    setIsAnalysisLoading(true)
    setError(null)
    setActiveCandidateIdx(0)

    try {
      const data = await analyzeTransaction(formData)
      const id = `case-${++idCounter.current}`
      const query = formData.sender_name || formData.receiver_name || `$${formData.amount ?? '?'}`

      setResult(data)
      setResultType('analyze')
      setActiveCaseId(id)
      setSessionHistory(prev => [
        { id, result: data, resultType: 'analyze', timestamp: new Date().toISOString(), query },
        ...prev,
      ].slice(0, 30))
    } catch (err) {
      setError(err.message || 'Analysis failed. Check the API is running.')
    } finally {
      setLoading(false)
      setIsAnalysisLoading(false)
    }
  }, [])

  const handleSelectHistory = useCallback((item) => {
    setResult(item.result)
    setResultType(item.resultType || 'screen')
    setActiveCaseId(item.id)
    setActiveCandidateIdx(0)
  }, [])

  const handleAmend = useCallback((amendment) => {
    setAmendments(prev => ({ ...prev, [activeCaseId]: amendment }))
    setSessionHistory(prev =>
      prev.map(item => item.id === activeCaseId ? { ...item, amendment } : item)
    )
  }, [activeCaseId])

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

  const handleTemporalWatchlist = useCallback(async () => {
    setTemporalLoading(true)
    setTemporalError(null)
    setTemporalResult(null)
    try {
      const data = await temporalWatchlist(50)
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

  const isAML = resultType === 'analyze'
  const activeCandidate = result?.top_candidates?.[activeCandidateIdx] ?? null
  const activeAmendment = activeCaseId ? (amendments[activeCaseId] ?? null) : null

  const sidebar = (
    <>
      <ScreeningForm
        onSubmit={handleSubmit}
        onAnalyze={handleAnalyze}
        loading={loading}
        error={error}
      />
      <SessionHistory
        items={sessionHistory}
        activeId={activeCaseId}
        onSelect={handleSelectHistory}
        amendments={amendments}
      />
    </>
  )

  return (
    <div className="h-screen flex flex-col bg-bg-base text-slate-300 overflow-hidden font-sans">
      <Header health={health} appMode={appMode} onModeChange={setAppMode} />

      {/* ── Temporal Risk View ── */}
      {appMode === 'temporal' && (
        <div
          className="flex-1 grid overflow-hidden"
          style={{ gridTemplateColumns: '288px 1fr 352px' }}
        >
          <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1">
            <TemporalForm
              onAnalyze={handleTemporalAnalyze}
              onWatchlist={handleTemporalWatchlist}
              loading={temporalLoading}
            />
          </aside>
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
              <WatchlistPanel entities={watchlist} onSelect={handleWatchlistSelect} />
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
                    and ownership graph exposure across years.
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
          <aside className="flex flex-col border-l border-slate-800/80 overflow-y-auto bg-bg-1">
            {temporalResult && (
              <div className="p-4 space-y-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                  Score Methodology
                </div>
                {[
                  { label: 'Graph proximity to blacklisted entities', color: 'bg-red-400' },
                  { label: 'Ownership structure changes over time', color: 'bg-amber-400' },
                  { label: 'Network centrality & degree', color: 'bg-blue-400' },
                  { label: 'Name similarity to sanctions list', color: 'bg-purple-400' },
                  { label: 'High-risk jurisdiction association', color: 'bg-orange-400' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${color}`} />
                    <span className="text-xs text-slate-500">{label}</span>
                  </div>
                ))}
                <div className="border-t border-slate-800 pt-3 text-[10px] text-slate-700 leading-relaxed">
                  Model: Random Forest trained on synthetic temporal data.
                  Score = probability of pre-blacklist pattern × 100.
                  Not a legal prediction or sanctions determination.
                </div>
              </div>
            )}
            {!temporalResult && (
              <div className="p-4 text-xs text-slate-700 italic">
                Entity risk breakdown appears after analysis.
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ── Sanctions / AML View ── */}
      {appMode === 'sanctions' && (graphEntity ? (
        <div className="flex-1 flex overflow-hidden">
          <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1 flex-shrink-0" style={{ width: 288 }}>
            {sidebar}
          </aside>
          <GraphIntelligencePanel
            entity={graphEntity}
            onClose={() => setGraphEntity(null)}
          />
        </div>
      ) : (

      /* ── Three-panel layout ── */
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: '288px 1fr 352px' }}
      >
        {/* Left */}
        <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1">
          {sidebar}
        </aside>

        {/* Main */}
        <main className="flex flex-col overflow-y-auto bg-bg-base">
          {loading && <LoadingOverlay isAnalysis={isAnalysisLoading} />}

          {!loading && !result && <WelcomeScreen />}

          {!loading && result && !isAML && (
            <div className="pb-8">
              <VerdictBanner result={result} amendment={activeAmendment} />
              <div className="px-4 pt-4 space-y-4">
                <AnalysisLayers layers={result.analysis_layers} />
                {result.top_candidates?.length > 0 && (
                  <CandidatesPanel
                    candidates={result.top_candidates}
                    activeIdx={activeCandidateIdx}
                    onSelectIdx={setActiveCandidateIdx}
                    verdict={result.verdict}
                  />
                )}
              </div>
            </div>
          )}

          {!loading && result && isAML && (
            <AMLFlagsPanel result={result} />
          )}
        </main>

        {/* Right */}
        <aside className="flex flex-col border-l border-slate-800/80 overflow-y-auto bg-bg-1">
          {result && !isAML && (
            <>
              {activeCandidate ? (
                <EntityDetails
                  entity={activeCandidate}
                  result={result}
                  onOpenGraph={setGraphEntity}
                />
              ) : (
                <div className="p-4 text-xs text-slate-600 italic">
                  No entity details available for this screening.
                </div>
              )}
              <AmendmentPanel
                result={result}
                amendment={activeAmendment}
                onAmend={handleAmend}
              />
            </>
          )}

          {result && isAML && (
            <div className="p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
                Rule Weights
              </div>
              {[
                { label: 'HIGH severity', points: 30, color: 'bg-red-400' },
                { label: 'MEDIUM severity', points: 15, color: 'bg-amber-400' },
                { label: 'LOW severity', points: 5, color: 'bg-blue-400' },
              ].map(({ label, points, color }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                  <span className="text-xs text-slate-400 flex-1">{label}</span>
                  <span className="text-xs font-mono text-slate-500">+{points} pts</span>
                </div>
              ))}
              <div className="border-t border-slate-800 pt-3 text-xs text-slate-600 leading-relaxed">
                Score = sum of triggered rule weights, capped at 100.
                Thresholds: ≤20 LOW · ≤50 MEDIUM · ≤75 HIGH · &gt;75 CRITICAL.
              </div>
            </div>
          )}

          {!result && !loading && (
            <div className="p-4 text-xs text-slate-700 italic">
              Entity details and amendment tools appear after screening.
            </div>
          )}
        </aside>
      </div>
      ))}
    </div>
  )
}
