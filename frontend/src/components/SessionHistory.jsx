import { Clock, Edit3 } from 'lucide-react'

const VERDICT_STYLE = {
  MATCH:    'bg-red-500/15 text-red-400 border-red-500/25',
  REVIEW:   'bg-amber-500/15 text-amber-400 border-amber-500/25',
  NO_MATCH: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ago`
}

export default function SessionHistory({ items, activeId, onSelect, amendments }) {
  if (!items?.length) {
    return (
      <div className="p-4 flex-1">
        <div className="text-xs font-semibold text-slate-600 uppercase tracking-widest mb-3">
          Recent Screenings
        </div>
        <p className="text-xs text-slate-700 italic">No screenings yet this session.</p>
      </div>
    )
  }

  return (
    <div className="p-4 flex-1">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Recent Screenings
        <span className="ml-2 font-normal text-slate-700 normal-case tracking-normal">
          ({items.length})
        </span>
      </div>

      <div className="space-y-1.5">
        {items.map(item => {
          const verdict = amendments[item.id]?.overrideVerdict || item.result.verdict
          const isActive = item.id === activeId
          const hasAmendment = !!amendments[item.id]

          return (
            <button
              key={item.id}
              onClick={() => onSelect(item)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-all ${
                isActive
                  ? 'bg-blue-500/8 border border-blue-500/25 ring-1 ring-blue-500/15'
                  : 'border border-transparent hover:border-slate-800 hover:bg-bg-2'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${VERDICT_STYLE[verdict] || VERDICT_STYLE.NO_MATCH}`}>
                    {verdict === 'NO_MATCH' ? 'CLEAR' : verdict}
                  </span>
                  {hasAmendment && (
                    <Edit3 size={10} className="text-blue-400" title="Amended" />
                  )}
                </div>
                <span className="text-xs text-slate-700 flex-shrink-0 flex items-center gap-1">
                  <Clock size={9} />
                  {timeAgo(item.timestamp)}
                </span>
              </div>
              <div className="text-xs text-slate-400 truncate font-medium">
                {item.query}
              </div>
              {item.result.matched_entity && (
                <div className="text-xs text-slate-600 truncate mt-0.5">
                  → {item.result.matched_entity}
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
