import { useState } from 'react'
import { TrendingUp, AlertTriangle } from 'lucide-react'

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

function contributionColor(contribution) {
  if (contribution >= 0.08) return { bar: 'bg-red-500',   text: 'text-red-400' }
  if (contribution >= 0.03) return { bar: 'bg-amber-500', text: 'text-amber-400' }
  return { bar: 'bg-slate-600', text: 'text-slate-500' }
}

function formatValue(name, value) {
  if (name === 'high_risk_country' || name === 'direct_blacklist_exposure' || name === 'indirect_blacklist_exposure')
    return value === 1 ? 'Yes' : 'No'
  if (name === 'shortest_path_to_blacklisted')
    return value >= 10 ? 'No path' : `${value.toFixed(0)} hop${value !== 1 ? 's' : ''}`
  if (name === 'name_sim_to_blacklist')
    return `${(value * 100).toFixed(0)}%`
  if (name === 'propagated_graph_risk')
    return value.toFixed(2)
  if (Number.isInteger(value) || value % 1 === 0)
    return value.toFixed(0)
  return value.toFixed(2)
}

function FeatureBreakdown({ breakdown }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Factor Analysis
      </div>
      <div className="space-y-3">
        {breakdown.map(f => {
          const col = contributionColor(f.contribution)
          const barWidth = Math.min(100, f.contribution * 500)
          return (
            <div key={f.name} className="space-y-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium text-slate-300 leading-tight">
                  {f.label || f.name.replace(/_/g, ' ')}
                </span>
                <span className={`text-[10px] font-mono font-bold flex-shrink-0 ${col.text}`}>
                  {formatValue(f.name, f.value)}
                </span>
              </div>
              <div className="h-0.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${col.bar}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                {f.explanation}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const RISK_TEXT = {
  LOW: 'text-green-400', ELEVATED: 'text-blue-400',
  HIGH: 'text-amber-400', VERY_HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
}
const RISK_BORDER_BG = {
  LOW:       'border-slate-700/50 bg-slate-800/20',
  ELEVATED:  'border-blue-500/25 bg-blue-500/5',
  HIGH:      'border-amber-500/25 bg-amber-500/5',
  VERY_HIGH: 'border-orange-500/25 bg-orange-500/5',
  CRITICAL:  'border-red-500/30 bg-red-500/7',
}
const RISK_DIVIDER = {
  LOW: 'border-slate-700/50', ELEVATED: 'border-blue-500/20',
  HIGH: 'border-amber-500/20', VERY_HIGH: 'border-orange-500/20', CRITICAL: 'border-red-500/20',
}
const ACTIONS = {
  LOW:       'No immediate action required. Include in standard periodic review cycle.',
  ELEVATED:  'Flag for quarterly compliance review. Monitor for continued risk escalation.',
  HIGH:      'Escalate to compliance officer for enhanced due diligence. Document risk assessment.',
  VERY_HIGH: 'Senior compliance review required. Consider placing transaction restrictions pending investigation.',
  CRITICAL:  'Block all transactions immediately. Escalate to senior compliance officer. Regulatory notification may be required.',
}

function Conclusion({ entity_name, entity_type, risk_score, risk_level, reasons,
                      history, blacklisted, blacklisted_neighbors, feature_breakdown }) {
  const textCol  = RISK_TEXT[risk_level]  || 'text-slate-400'
  const borderBg = RISK_BORDER_BG[risk_level] || RISK_BORDER_BG.LOW
  const divider  = RISK_DIVIDER[risk_level]   || RISK_DIVIDER.LOW
  const styleBar = (RISK_STYLE[risk_level] || RISK_STYLE.LOW).bar
  const action   = ACTIONS[risk_level] || ACTIONS.LOW

  // Build fast feature lookup
  const feat = {}
  feature_breakdown?.forEach(f => { feat[f.name] = f.value })

  // Trend: compare current vs 3 years prior
  const years   = Object.keys(history || {}).sort()
  const scores  = years.map(y => history[y])
  const current = scores.at(-1) ?? risk_score
  const prior   = scores.at(-4) ?? scores.at(0) ?? current
  const delta   = current - prior
  let trendText
  if      (delta >  20) trendText = `Risk has escalated sharply (+${delta.toFixed(0)} pts over 3 years) — accelerating exposure that warrants urgent review.`
  else if (delta >   7) trendText = `Risk shows a consistent upward trend (+${delta.toFixed(0)} pts over 3 years), indicating growing network entanglement.`
  else if (delta < -20) trendText = `Risk has decreased significantly (${delta.toFixed(0)} pts over 3 years), possibly reflecting ownership restructuring or reduced sanctions proximity.`
  else if (delta <  -7) trendText = `Risk shows a mild downward trend (${delta.toFixed(0)} pts over 3 years) — improvement but continued monitoring is warranted.`
  else                  trendText = `Risk profile has been relatively stable over the past 3 years (${delta >= 0 ? '+' : ''}${delta.toFixed(0)} pts).`

  // Specific flags from actual feature values
  const flags = []
  if (blacklisted)
    flags.push('Entity is directly listed on a sanctions list — all transactions must be blocked.')
  if (blacklisted_neighbors?.length > 0)
    flags.push(`${blacklisted_neighbors.length} direct business partner${blacklisted_neighbors.length > 1 ? 's are' : ' is'} already sanctioned.`)
  if (!blacklisted && feat.shortest_path_to_blacklisted != null && feat.shortest_path_to_blacklisted < 3)
    flags.push(`Only ${feat.shortest_path_to_blacklisted.toFixed(0)} ownership hop${feat.shortest_path_to_blacklisted !== 1 ? 's' : ''} from a sanctioned entity — within enhanced due diligence threshold.`)
  if (feat.high_risk_country === 1)
    flags.push('Registered in or associated with an OFAC-sanctioned or FATF high-risk country.')
  if (feat.ownership_changes_last_year >= 3)
    flags.push(`${feat.ownership_changes_last_year.toFixed(0)} ownership changes in the past year — pattern consistent with pre-designation restructuring.`)
  if (!blacklisted && feat.indirect_blacklist_exposure === 1 && !(blacklisted_neighbors?.length > 0))
    flags.push('A direct business partner is on a sanctions list, creating indirect exposure.')

  // How many features are materially elevated
  const elevatedCount = feature_breakdown?.filter(f => f.contribution >= 0.03).length ?? 0
  const topReason = reasons?.[0]
  const levelLabel = (RISK_STYLE[risk_level] || RISK_STYLE.LOW).label

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Compliance Assessment
      </div>
      <div className={`rounded-lg border p-4 space-y-3 ${borderBg}`}>

        {/* Summary sentence */}
        <p className="text-xs text-slate-300 leading-relaxed">
          <span className={`font-bold ${textCol}`}>{entity_name}</span>
          {' '}({entity_type}) carries a{' '}
          <span className={`font-bold ${textCol}`}>{levelLabel.toLowerCase()} risk profile</span>
          {' '}with an emerging risk score of{' '}
          <span className="font-mono font-bold text-slate-200">{risk_score.toFixed(0)}/100</span>
          {elevatedCount > 0 && <>, with <span className="font-semibold text-slate-200">{elevatedCount} of 17</span> indicators materially elevated</>}.
          {topReason && <> The primary driver is: <span className="italic text-slate-400">{topReason.charAt(0).toLowerCase() + topReason.slice(1)}</span>.</>}
        </p>

        {/* Trend */}
        <p className="text-xs text-slate-400 leading-relaxed">{trendText}</p>

        {/* Specific flags */}
        {flags.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {flags.map((flag, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                <span className={`mt-0.5 flex-shrink-0 font-bold ${textCol}`}>›</span>
                {flag}
              </li>
            ))}
          </ul>
        )}

        {/* Recommended action */}
        <div className={`pt-3 border-t ${divider}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex-shrink-0">
              Recommended action
            </span>
          </div>
          <p className={`mt-1 text-xs font-medium leading-relaxed ${textCol}`}>{action}</p>
        </div>

      </div>
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
            <div className="text-[10px] text-slate-600">{entity_type} · {current_year}</div>
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

      <div className="px-4 py-3 space-y-4 border-b border-slate-800">
        {/* Feature breakdown */}
        {feature_breakdown?.length > 0 && (
          <FeatureBreakdown breakdown={feature_breakdown} />
        )}
      </div>

      {/* Conclusion */}
      <Conclusion
        entity_name={entity_name}
        entity_type={entity_type}
        risk_score={risk_score}
        risk_level={risk_level}
        reasons={reasons}
        history={history}
        blacklisted={blacklisted}
        blacklisted_neighbors={blacklisted_neighbors}
        feature_breakdown={feature_breakdown}
      />

      {/* Other candidates */}
      {search_candidates?.length > 1 && (
        <div className="px-4 pb-6">
          <SearchCandidates
            candidates={search_candidates}
            selectedId={entity_id}
            onSelect={onSelectAlternate}
          />
        </div>
      )}
    </div>
  )
}
