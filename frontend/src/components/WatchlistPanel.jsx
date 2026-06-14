import { TrendingUp, TrendingDown, AlertTriangle, ArrowUpDown, AlignLeft } from 'lucide-react'

const RISK_STYLE = {
  LOW:       { bar: 'bg-green-500',   text: 'text-green-400' },
  ELEVATED:  { bar: 'bg-blue-500',    text: 'text-blue-400' },
  HIGH:      { bar: 'bg-amber-500',   text: 'text-amber-400' },
  VERY_HIGH: { bar: 'bg-orange-500',  text: 'text-orange-400' },
  CRITICAL:  { bar: 'bg-red-500',     text: 'text-red-400' },
}

const VIEW_META = {
  top:           { label: 'Highest Risk',   icon: AlertTriangle,  desc: 'Ranked by current risk score' },
  rising:        { label: 'Rising Risk',    icon: TrendingUp,     desc: 'Biggest year-over-year increase' },
  critical_edge: { label: 'Near-Critical',  icon: AlertTriangle,  desc: 'Score 60–79 — priority for escalation' },
  name:          { label: 'Alphabetical',   icon: AlignLeft,      desc: 'All elevated entities, A–Z' },
  declining:     { label: 'Declining Risk', icon: TrendingDown,   desc: 'Biggest year-over-year decrease' },
}

function DeltaBadge({ delta }) {
  if (delta === undefined || delta === null) return null
  const positive = delta > 0
  const zero = delta === 0
  if (zero) return <span className="text-[10px] font-mono text-slate-600">±0</span>
  return (
    <span className={`text-[10px] font-mono font-bold ${positive ? 'text-red-400' : 'text-green-400'}`}>
      {positive ? '+' : ''}{delta.toFixed(1)}
    </span>
  )
}

export default function WatchlistPanel({ entities, view = 'top', onSelect }) {
  const meta = VIEW_META[view] || VIEW_META.top
  const Icon = meta.icon
  const showDelta = view === 'rising' || view === 'declining'

  if (!entities?.length) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <Icon size={28} className="text-slate-700 mx-auto mb-2" />
        <p className="text-sm text-slate-600">No entities match this view</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col overflow-hidden h-full">
      <div className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-amber-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            {meta.label}
          </span>
        </div>
        <p className="text-[10px] text-slate-700 mt-0.5">{meta.desc} · {entities.length} entities</p>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-slate-800/50">
        {entities.map((e) => {
          const style = RISK_STYLE[e.risk_level] || RISK_STYLE.LOW
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs text-slate-300 truncate leading-tight">{e.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {showDelta && <DeltaBadge delta={e.score_delta} />}
                  <span className={`text-xs font-mono font-bold ${style.text}`}>
                    {e.risk_score.toFixed(0)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${style.bar}`}
                    style={{ width: `${e.risk_score}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-600 w-12 truncate">{e.type}</span>
              </div>
              {showDelta && e.prev_score !== undefined && (
                <div className="text-[9px] text-slate-700 mt-0.5">
                  prev: {e.prev_score.toFixed(0)} → {e.risk_score.toFixed(0)}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
