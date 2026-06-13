import { MapPin, Tag } from 'lucide-react'

const SIGNAL_CFG = {
  confirmed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25' },
  conflict:  { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25' },
  unknown:   { color: 'text-slate-400',   bg: 'bg-slate-500/10',   border: 'border-slate-600/25' },
  'n/a':     { color: 'text-slate-500',   bg: 'bg-slate-600/10',   border: 'border-slate-700/25' },
}

function ScoreBar({ score, raw }) {
  const pct = Math.round(score * 100)
  const rawPct = Math.round((raw ?? score) * 100)
  const color = pct >= 92 ? 'bg-red-500' : pct >= 78 ? 'bg-amber-500' : 'bg-slate-500'

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-600">Score</span>
        <div className="flex items-center gap-1.5">
          {raw !== undefined && raw !== score && (
            <span className="text-slate-600 font-mono">{rawPct}%→</span>
          )}
          <span className={`font-mono font-bold ${
            pct >= 92 ? 'text-red-400' : pct >= 78 ? 'text-amber-400' : 'text-slate-400'
          }`}>{pct}%</span>
        </div>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default function CandidatesPanel({ candidates, activeIdx, onSelectIdx, verdict }) {
  if (!candidates?.length) return null

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Top Candidates
        </span>
        <span className="text-xs text-slate-700">({candidates.length} above floor threshold)</span>
      </div>

      <div className="space-y-2">
        {candidates.map((c, i) => {
          const isActive = i === activeIdx
          const signal = SIGNAL_CFG[c.country_signal] || SIGNAL_CFG.unknown
          const pct = Math.round(c.score * 100)

          return (
            <button
              key={i}
              onClick={() => onSelectIdx(i)}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                isActive
                  ? 'bg-blue-500/5 border-blue-500/30 ring-1 ring-blue-500/20'
                  : 'bg-bg-1 border-slate-800 hover:border-slate-700 hover:bg-bg-2'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                {/* Rank + Name */}
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`flex-shrink-0 text-xs font-bold rounded px-1.5 py-0.5 mt-0.5 ${
                    isActive ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-800 text-slate-500'
                  }`}>
                    #{i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-200 leading-tight break-words">
                      {c.name}
                    </div>
                    {c.matched_alias && c.matched_alias !== c.name && (
                      <div className="text-xs text-slate-500 mt-0.5 break-words">
                        via <span className="italic text-slate-400">"{c.matched_alias}"</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Entity type badge */}
                {c.entity_type && (
                  <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-700">
                    {c.entity_type}
                  </span>
                )}
              </div>

              {/* Score bar */}
              <ScoreBar score={c.score} raw={c.raw_score} />

              {/* Countries + signal */}
              <div className="flex items-center justify-between mt-3 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin size={11} className="text-slate-600 flex-shrink-0" />
                  <span className="text-slate-500 truncate">
                    {c.countries?.length > 0 ? c.countries.join(', ') : 'Unknown'}
                  </span>
                </div>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full border ${signal.bg} ${signal.border} ${signal.color}`}>
                  {c.country_signal}
                </span>
              </div>

              {/* Programs */}
              {c.programs?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {c.programs.slice(0, 3).map(p => (
                    <span key={p} className="text-xs font-mono px-1.5 py-0.5 rounded bg-bg-3 text-slate-400 border border-slate-700">
                      {p}
                    </span>
                  ))}
                  {c.programs.length > 3 && (
                    <span className="text-xs text-slate-600">+{c.programs.length - 3} more</span>
                  )}
                </div>
              )}

              {isActive && (
                <div className="mt-2 text-xs text-blue-400">
                  ↑ Details shown in right panel
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
