import { TrendingUp, AlertTriangle } from 'lucide-react'

const RISK_STYLE = {
  LOW:       { bar: 'bg-green-500',   text: 'text-green-400' },
  ELEVATED:  { bar: 'bg-blue-500',    text: 'text-blue-400' },
  HIGH:      { bar: 'bg-amber-500',   text: 'text-amber-400' },
  VERY_HIGH: { bar: 'bg-orange-500',  text: 'text-orange-400' },
  CRITICAL:  { bar: 'bg-red-500',     text: 'text-red-400' },
}

export default function WatchlistPanel({ entities, onSelect }) {
  if (!entities?.length) return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center">
        <TrendingUp size={28} className="text-slate-700 mx-auto mb-2" />
        <p className="text-sm text-slate-600">No high-risk entities found</p>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <div className="flex items-center gap-1.5">
          <AlertTriangle size={12} className="text-amber-400" />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
            Emerging Risk Watchlist
          </span>
        </div>
        <p className="text-[10px] text-slate-700 mt-1">
          Non-blacklisted entities with elevated risk scores
        </p>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-slate-800/50">
        {entities.map((e, i) => {
          const style = RISK_STYLE[e.risk_level] || RISK_STYLE.LOW
          return (
            <button
              key={e.id}
              onClick={() => onSelect(e)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-800/40 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs text-slate-300 truncate leading-tight">{e.name}</span>
                <span className={`flex-shrink-0 text-xs font-mono font-bold ${style.text}`}>
                  {e.risk_score.toFixed(0)}
                </span>
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
            </button>
          )
        })}
      </div>
    </div>
  )
}
