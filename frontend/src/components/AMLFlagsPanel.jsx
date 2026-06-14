import { Shield, Globe, DollarSign, User, Activity, Repeat, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

const RULE_ICONS = {
  1: Shield,
  2: Globe,
  3: DollarSign,
  4: DollarSign,
  5: User,
  6: Activity,
  7: AlertTriangle,
  8: Repeat,
  9: Clock,
  10: AlertTriangle,
}

const SEVERITY_STYLE = {
  HIGH:   { dot: 'bg-red-400',    text: 'text-red-400',    badge: 'bg-red-400/15 text-red-400 border-red-400/30' },
  MEDIUM: { dot: 'bg-amber-400',  text: 'text-amber-400',  badge: 'bg-amber-400/15 text-amber-400 border-amber-400/30' },
  LOW:    { dot: 'bg-blue-400',   text: 'text-blue-400',   badge: 'bg-blue-400/15 text-blue-400 border-blue-400/30' },
}

const RISK_LEVEL_STYLE = {
  NO_RISK:  { bar: 'bg-green-500',  badge: 'bg-green-500/20 text-green-400 border-green-500/30',  label: 'No Risk' },
  LOW:      { bar: 'bg-blue-500',   badge: 'bg-blue-500/20 text-blue-400 border-blue-500/30',    label: 'Low Risk' },
  MEDIUM:   { bar: 'bg-amber-500',  badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30', label: 'Medium Risk' },
  HIGH:     { bar: 'bg-orange-500', badge: 'bg-orange-500/20 text-orange-400 border-orange-500/30', label: 'High Risk' },
  CRITICAL: { bar: 'bg-red-500',    badge: 'bg-red-500/20 text-red-400 border-red-500/30',       label: 'Critical Risk' },
}

function RiskScoreBar({ score, level }) {
  const style = RISK_LEVEL_STYLE[level] || RISK_LEVEL_STYLE.NO_RISK

  return (
    <div className="px-4 py-4 border-b border-slate-800">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">AML Risk Score</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${style.bar}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-sm font-mono font-bold text-slate-200 w-12 text-right">
          {score.toFixed(0)}<span className="text-slate-600 text-xs font-normal">/100</span>
        </span>
      </div>
    </div>
  )
}

function FlagRow({ flag }) {
  const Icon = RULE_ICONS[flag.rule_id] || Shield
  const sev = SEVERITY_STYLE[flag.severity] || SEVERITY_STYLE.LOW

  if (!flag.triggered) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 opacity-40">
        <Icon size={13} className="text-slate-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs text-slate-600">
            Rule {flag.rule_id} — {flag.rule_name}
          </span>
        </div>
        <CheckCircle size={12} className="text-slate-700 flex-shrink-0" />
      </div>
    )
  }

  return (
    <div className={`mx-3 mb-2 rounded-lg border p-3 ${
      flag.severity === 'HIGH'
        ? 'bg-red-400/5 border-red-400/20'
        : flag.severity === 'MEDIUM'
        ? 'bg-amber-400/5 border-amber-400/20'
        : 'bg-blue-400/5 border-blue-400/20'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${sev.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon size={12} className={`flex-shrink-0 ${sev.text}`} />
            <span className={`text-xs font-semibold ${sev.text}`}>{flag.rule_name}</span>
            <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded border ${sev.badge}`}>
              {flag.severity}
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{flag.description}</p>

          {/* Sanctions hits detail */}
          {flag.rule_id === 1 && flag.details?.hits?.length > 0 && (
            <div className="mt-2 space-y-1">
              {flag.details.hits.map((h, i) => (
                <div key={i} className="text-xs bg-slate-800/60 rounded px-2 py-1">
                  <span className="text-slate-500">{h.party}: </span>
                  <span className="text-slate-300">{h.name}</span>
                  <span className="text-slate-500"> → </span>
                  <span className={h.verdict === 'MATCH' ? 'text-red-400' : 'text-amber-400'}>
                    {h.verdict}
                  </span>
                  <span className="text-slate-600"> ({(h.score * 100).toFixed(0)}%)</span>
                  {h.matched_entity && (
                    <span className="text-slate-500"> · {h.matched_entity}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Circular path */}
          {flag.rule_id === 8 && flag.details?.cycle_path?.length > 0 && (
            <div className="mt-1.5 text-xs font-mono text-slate-400 bg-slate-800/60 rounded px-2 py-1">
              {flag.details.cycle_path.join(' → ')}
            </div>
          )}

          {/* PEP hits */}
          {flag.rule_id === 5 && flag.details?.pep_hits?.length > 0 && (
            <div className="mt-1.5 space-y-1">
              {flag.details.pep_hits.map((h, i) => (
                <div key={i} className="text-xs bg-slate-800/60 rounded px-2 py-1">
                  <span className="text-slate-500">{h.party}: </span>
                  <span className="text-slate-300">{h.name}</span>
                  {h.matched_title && <span className="text-amber-400 ml-1">· "{h.matched_title}"</span>}
                  {h.matched_known_pep && <span className="text-red-400 ml-1">· known PEP</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AMLFlagsPanel({ result }) {
  if (!result) return null

  const { aml_flags, triggered_count, total_rules, risk_score, risk_level } = result

  const triggered = aml_flags.filter(f => f.triggered)
  const clear = aml_flags.filter(f => !f.triggered)

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <RiskScoreBar score={risk_score} level={risk_level} />

      {/* Summary */}
      <div className="flex gap-3 px-4 py-3 border-b border-slate-800">
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-slate-200">{triggered_count}</div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Triggered</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-slate-500">{total_rules - triggered_count}</div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Clear</div>
        </div>
        <div className="w-px bg-slate-800" />
        <div className="flex-1 text-center">
          <div className="text-lg font-bold text-slate-200">{total_rules}</div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wide">Total Rules</div>
        </div>
      </div>

      {/* Triggered rules */}
      {triggered.length > 0 && (
        <div className="pt-3">
          <div className="px-4 mb-2 flex items-center gap-1.5">
            <XCircle size={11} className="text-red-400" />
            <span className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider">
              Triggered ({triggered.length})
            </span>
          </div>
          {triggered.map(flag => <FlagRow key={flag.rule_id} flag={flag} />)}
        </div>
      )}

      {/* Clear rules */}
      {clear.length > 0 && (
        <div className="pt-2">
          <div className="px-4 mb-1 flex items-center gap-1.5">
            <CheckCircle size={11} className="text-slate-600" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider">
              Clear ({clear.length})
            </span>
          </div>
          <div className="divide-y divide-slate-800/60">
            {clear.map(flag => <FlagRow key={flag.rule_id} flag={flag} />)}
          </div>
        </div>
      )}

      {triggered.length === 0 && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <CheckCircle size={32} className="text-green-500/40 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No AML flags triggered</p>
            <p className="text-xs text-slate-700 mt-1">All {total_rules} rules passed</p>
          </div>
        </div>
      )}
    </div>
  )
}
