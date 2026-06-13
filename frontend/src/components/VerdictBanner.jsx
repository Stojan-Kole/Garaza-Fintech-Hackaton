import { XOctagon, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react'

const VERDICT_CONFIG = {
  MATCH: {
    icon: XOctagon,
    label: 'BLOCKED',
    sublabel: 'High-confidence sanctions match',
    color: 'text-red-400',
    bg: 'bg-red-500/6',
    border: 'border-red-500/20',
    badge: 'bg-red-500/15 text-red-300 border-red-500/30',
    bar: 'bg-red-500',
    glow: 'verdict-match',
  },
  REVIEW: {
    icon: AlertTriangle,
    label: 'PENDING REVIEW',
    sublabel: 'Plausible match — analyst action required',
    color: 'text-amber-400',
    bg: 'bg-amber-500/6',
    border: 'border-amber-500/20',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    bar: 'bg-amber-500',
    glow: 'verdict-review',
  },
  NO_MATCH: {
    icon: CheckCircle,
    label: 'CLEARED',
    sublabel: 'No sanctions exposure detected',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/6',
    border: 'border-emerald-500/20',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    bar: 'bg-emerald-500',
    glow: 'verdict-clear',
  },
}

function ScoreBar({ score, verdict }) {
  const pct = Math.round(score * 100)
  const cfg = VERDICT_CONFIG[verdict]

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
        {/* Threshold markers */}
        <div className="absolute top-0 h-full w-px bg-amber-500/40" style={{ left: '78%' }} />
        <div className="absolute top-0 h-full w-px bg-red-500/40" style={{ left: '92%' }} />
        {/* Fill */}
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-2xl font-bold tabular-nums ${cfg.color}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function VerdictBanner({ result, amendment }) {
  const v = amendment?.overrideVerdict || result.verdict
  const cfg = VERDICT_CONFIG[v] || VERDICT_CONFIG.NO_MATCH
  const Icon = cfg.icon

  const displayScore = result.score
  const isAmended = !!amendment

  return (
    <div className={`mx-4 mt-4 rounded-xl border ${cfg.bg} ${cfg.border} ${cfg.glow} p-5 animate-slide-up`}>
      <div className="flex items-start gap-4">
        {/* Verdict icon */}
        <div className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>
          <Icon size={28} strokeWidth={1.5} />
        </div>

        {/* Main verdict info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xl font-bold tracking-wide ${cfg.color}`}>
              {cfg.label}
            </span>
            {isAmended && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <Edit3 size={10} />
                Analyst Override
              </span>
            )}
            {result.screening_type === 'crypto' && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                Crypto
              </span>
            )}
          </div>

          <p className="text-sm text-slate-400 mb-3">{cfg.sublabel}</p>

          {/* Score bar */}
          <ScoreBar score={displayScore} verdict={result.verdict} />

          {/* Threshold labels */}
          <div className="flex justify-between mt-1 text-xs text-slate-600">
            <span>0%</span>
            <span className="text-amber-600/70">Review 78%</span>
            <span className="text-red-600/70">Match 92%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Matched entity info */}
        {result.matched_entity && (
          <div className="flex-shrink-0 text-right max-w-[200px]">
            <div className="text-xs text-slate-500 mb-1 uppercase tracking-wider">Matched Entity</div>
            <div className="text-sm font-semibold text-slate-200 leading-tight break-words">
              {result.matched_entity}
            </div>
            {result.matched_alias && result.matched_alias !== result.matched_entity && (
              <div className="text-xs text-slate-500 mt-1 break-words">
                via <span className="text-slate-400 italic">"{result.matched_alias}"</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Reason text */}
      <div className="mt-4 pt-4 border-t border-white/5">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-2">
          System Reasoning
        </div>
        <p className="text-sm text-slate-300 leading-relaxed">
          {isAmended ? amendment.reason : result.reason}
        </p>
      </div>

      {/* Programs */}
      {result.programs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.programs.map(p => (
            <span
              key={p}
              className={`text-xs font-mono px-2 py-0.5 rounded border ${cfg.badge}`}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
