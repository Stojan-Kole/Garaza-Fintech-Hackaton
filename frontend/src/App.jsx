import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

import { screenPayment, getHealth } from './api'
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

function LoadingOverlay() {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center space-y-3">
        <div className="relative mx-auto w-10 h-10">
          <div className="absolute inset-0 rounded-full border-2 border-blue-500/20" />
          <div className="absolute inset-0 rounded-full border-2 border-t-blue-500 animate-spin" />
        </div>
        <p className="text-sm text-slate-500">Screening against OFAC SDN list…</p>
        <p className="text-xs text-slate-700">Comparing ~12,000 entities</p>
      </div>
    </div>
  )
}

export default function App() {
  const [result, setResult]                 = useState(null)
  const [activeCaseId, setActiveCaseId]     = useState(null)
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState(null)
  const [health, setHealth]                 = useState(null)
  const [sessionHistory, setSessionHistory] = useState([])
  const [amendments, setAmendments]         = useState({})
  const [activeCandidateIdx, setActiveCandidateIdx] = useState(0)
  const [graphEntity, setGraphEntity]       = useState(null)
  const idCounter = useRef(0)

  // Health check on mount
  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null))
  }, [])

  const handleSubmit = useCallback(async (formData) => {
    setLoading(true)
    setError(null)
    setActiveCandidateIdx(0)

    try {
      const data = await screenPayment(formData)
      const id = `case-${++idCounter.current}`
      const query = formData.name || formData.wallet_address || ''

      setResult(data)
      setActiveCaseId(id)
      setSessionHistory(prev => [
        { id, result: data, timestamp: new Date().toISOString(), query },
        ...prev,
      ].slice(0, 30))
    } catch (err) {
      setError(err.message || 'Screening failed. Check the API is running.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSelectHistory = useCallback((item) => {
    setResult(item.result)
    setActiveCaseId(item.id)
    setActiveCandidateIdx(0)
  }, [])

  const handleAmend = useCallback((amendment) => {
    setAmendments(prev => ({ ...prev, [activeCaseId]: amendment }))
    setSessionHistory(prev =>
      prev.map(item => item.id === activeCaseId ? { ...item, amendment } : item)
    )
  }, [activeCaseId])

  const activeCandidate  = result?.top_candidates?.[activeCandidateIdx] ?? null
  const activeAmendment  = activeCaseId ? (amendments[activeCaseId] ?? null) : null

  return (
    <div className="h-screen flex flex-col bg-bg-base text-slate-300 overflow-hidden font-sans">
      <Header health={health} />

      {/* ── Graph Intelligence View (replaces main+right panels) ── */}
      {graphEntity ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left sidebar remains visible for context */}
          <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1 flex-shrink-0" style={{ width: 288 }}>
            <ScreeningForm
              onSubmit={handleSubmit}
              loading={loading}
              error={error}
            />
            <SessionHistory
              items={sessionHistory}
              activeId={activeCaseId}
              onSelect={handleSelectHistory}
              amendments={amendments}
            />
          </aside>
          <GraphIntelligencePanel
            entity={graphEntity}
            onClose={() => setGraphEntity(null)}
          />
        </div>
      ) : (

      /* ── Three-panel layout ──────────────────────────────────── */
      <div
        className="flex-1 grid overflow-hidden"
        style={{ gridTemplateColumns: '288px 1fr 352px' }}
      >
        {/* ── Left sidebar ─────────────────────────────────────── */}
        <aside className="flex flex-col border-r border-slate-800/80 overflow-y-auto bg-bg-1">
          <ScreeningForm
            onSubmit={handleSubmit}
            loading={loading}
            error={error}
          />
          <SessionHistory
            items={sessionHistory}
            activeId={activeCaseId}
            onSelect={handleSelectHistory}
            amendments={amendments}
          />
        </aside>

        {/* ── Main content ─────────────────────────────────────── */}
        <main className="flex flex-col overflow-y-auto bg-bg-base">
          {loading && <LoadingOverlay />}

          {!loading && !result && <WelcomeScreen />}

          {!loading && result && (
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
        </main>

        {/* ── Right panel ──────────────────────────────────────── */}
        <aside className="flex flex-col border-l border-slate-800/80 overflow-y-auto bg-bg-1">
          {result && (
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

          {!result && !loading && (
            <div className="p-4 text-xs text-slate-700 italic">
              Entity details and amendment tools appear after screening.
            </div>
          )}
        </aside>
      </div>
      )}
    </div>
  )
}
