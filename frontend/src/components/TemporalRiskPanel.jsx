import { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle, Shield, Clock, ChevronDown, ChevronUp, Users, Activity } from 'lucide-react'
import { temporalWatchlist } from '../api'

const RISK_STYLE = {
  LOW:       { bar: 'bg-green-500',   badge: 'bg-green-500/15 text-green-400 border-green-500/30',   label: 'Low' },
  ELEVATED:  { bar: 'bg-blue-500',    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/30',      label: 'Elevated' },
  HIGH:      { bar: 'bg-amber-500',   badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   label: 'High' },
  VERY_HIGH: { bar: 'bg-orange-500',  badge: 'bg-orange-500/15 text-orange-400 border-orange-500/30', label: 'Very High' },
  CRITICAL:  { bar: 'bg-red-500',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',         label: 'Critical' },
}

function ScoreBar({ score, level, label }) {
  const style = RISK_STYLE[level] || RISK_STYLE.LOW
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">{label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.badge}`}>
            {style.label}
          </span>
        </div>
      )}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-mono font-bold text-slate-200 w-10 text-right">
          {score.toFixed(0)}<span className="text-slate-600 text-[10px]">/100</span>
        </span>
      </div>
    </div>
  )
}

function HistoryChart({ history }) {
  const years = Object.keys(history).sort()
  const scores = years.map(y => history[y])
  const max = Math.max(...scores, 1)

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Risk Evolution
      </div>
      <div className="flex items-end gap-1 h-16">
        {years.map((year, i) => {
          const score = scores[i]
          const pct = (score / 100) * 100
          const style = RISK_STYLE[
            score < 15 ? 'LOW' : score < 35 ? 'ELEVATED' : score < 60 ? 'HIGH' : score < 80 ? 'VERY_HIGH' : 'CRITICAL'
          ]
          return (
            <div key={year} className="flex-1 flex flex-col items-center gap-1 group">
              <div className="relative w-full flex justify-center">
                <div
                  className={`w-full max-w-[18px] rounded-t transition-all ${style.bar} opacity-80 group-hover:opacity-100`}
                  style={{ height: `${Math.max(2, (score / 100) * 56)}px` }}
                />
                <div className="absolute -top-5 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] font-mono bg-slate-800 text-slate-200 px-1 py-0.5 rounded whitespace-nowrap z-10">
                  {score.toFixed(0)}
                </div>
              </div>
              <span className="text-[9px] text-slate-600 font-mono">{year.slice(2)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function FeatureBreakdown({ breakdown }) {
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? breakdown : breakdown.slice(0, 4)

  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
        Feature Contributions
      </div>
      <div className="space-y-2">
        {shown.map(f => (
          <div key={f.name} className="space-y-0.5">
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-500 truncate flex-1 mr-2" title={f.explanation}>
                {f.name.replace(/_/g, ' ')}
              </span>
              <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                {f.value.toFixed(2)}
              </span>
            </div>
            <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500/60 rounded-full"
                style={{ width: `${Math.min(100, f.contribution * 500)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {breakdown.length > 4 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-2 text-[10px] text-slate-600 hover:text-slate-400 flex items-center gap-1"
        >
          {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {expanded ? 'Show less' : `Show ${breakdown.length - 4} more`}
        </button>
      )}
    </div>
  )
}

function SearchCandidates({ candidates, selectedId, onSelect }) {
  if (!candidates || candidates.length <= 1) return null
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
        Other Matches
      </div>
      <div className="space-y-1">
        {candidates.slice(1).map(c => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className="w-full text-left px-2 py-1.5 rounded bg-slate-800/40 hover:bg-slate-800 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-300 truncate">{c.name}</span>
              <span className="text-[10px] font-mono text-slate-600 ml-2">
                {(c.match_score * 100).toFixed(0)}%
              </span>
            </div>
            <div className="text-[10px] text-slate-600">{c.type} · {c.blacklisted ? '⛔ blacklisted' : 'clear'}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function TemporalRiskPanel({ result, onSelectAlternate }) {
  if (!result) return null

  const {
    entity_name, entity_id, entity_type, current_year,
    blacklisted, direct_blacklist_match, blacklisted_neighbors,
    risk_score, risk_level, reasons, history, feature_breakdown,
    search_candidates,
  } = result

  const style = RISK_STYLE[risk_level] || RISK_STYLE.LOW

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header score */}
      <div className="px-4 py-4 border-b border-slate-800">
        <div className="flex items-start justify-between mb-1">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-0.5">
              Emerging Risk Score
            </div>
            <div className="text-base font-semibold text-slate-200 truncate max-w-[200px]" title={entity_name}>
              {entity_name}
            </div>
            <div className="text-[10px] text-slate-600">{entity_type} · synthetic data · {current_year}</div>
          </div>
          {blacklisted && (
            <span className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded border bg-red-500/15 text-red-400 border-red-500/30">
              BLACKLISTED
            </span>
          )}
        </div>
        <div className="mt-3">
          <ScoreBar score={risk_score} level={risk_level} />
        </div>
      </div>

      {/* Blacklist exposure */}
      {(blacklisted || blacklisted_neighbors?.length > 0) && (
        <div className="px-4 py-3 border-b border-slate-800 bg-red-500/5">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={11} className="text-red-400" />
            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">
              Blacklist Exposure
            </span>
          </div>
          {blacklisted && (
            <div className="text-xs text-red-300 mb-1">
              Direct: <span className="font-medium">{direct_blacklist_match}</span>
            </div>
          )}
          {blacklisted_neighbors?.length > 0 && (
            <div className="space-y-1">
              {blacklisted_neighbors.map((n, i) => (
                <div key={i} className="text-xs text-slate-400">
                  Connected to: <span className="text-amber-400">{n.name}</span>
                  <span className="text-slate-600 ml-1">({n.type})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="px-4 py-3 space-y-4 border-b border-slate-800">
        {/* Risk reasons */}
        {reasons?.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
              Risk Factors
            </div>
            <ul className="space-y-1.5">
              {reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <div className={`mt-1 w-1 h-1 rounded-full flex-shrink-0 ${style.bar}`} />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* History chart */}
        {history && Object.keys(history).length > 1 && (
          <HistoryChart history={history} />
        )}
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Feature breakdown */}
        {feature_breakdown?.length > 0 && (
          <FeatureBreakdown breakdown={feature_breakdown} />
        )}

        {/* Other candidates */}
        <SearchCandidates
          candidates={search_candidates}
          selectedId={entity_id}
          onSelect={onSelectAlternate}
        />
      </div>
    </div>
  )
}
