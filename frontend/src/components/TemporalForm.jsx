import { useState } from 'react'
import { TrendingUp, Loader2, Search, ListFilter } from 'lucide-react'

export default function TemporalForm({ onAnalyze, onWatchlist, loading }) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState('search')  // 'search' | 'watchlist'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    onAnalyze({ entity_name: name.trim(), top_k: 5 })
  }

  const handleWatchlist = () => {
    setMode('watchlist')
    onWatchlist()
  }

  return (
    <div className="p-3 border-b border-slate-800/80">
      <div className="flex items-center gap-1.5 mb-3">
        <TrendingUp size={13} className="text-blue-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest">
          Temporal Risk
        </span>
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode('search')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1 rounded transition-colors ${
            mode === 'search'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-400 border border-transparent'
          }`}
        >
          <Search size={9} /> Entity Search
        </button>
        <button
          onClick={handleWatchlist}
          className={`flex-1 flex items-center justify-center gap-1.5 text-[10px] font-medium py-1 rounded transition-colors ${
            mode === 'watchlist'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'text-slate-500 hover:text-slate-400 border border-transparent'
          }`}
        >
          <ListFilter size={9} /> Watchlist
        </button>
      </div>

      {mode === 'search' && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <div>
            <label className="block text-[10px] text-slate-600 uppercase tracking-widest mb-1">
              Entity Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Alexander Ivanov"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:border-blue-500/60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full flex items-center justify-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium py-1.5 rounded transition-colors"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
            {loading ? 'Analyzing…' : 'Predict Risk'}
          </button>
        </form>
      )}

      {mode === 'watchlist' && !loading && (
        <div className="text-xs text-slate-600 italic text-center py-1">
          Showing top emerging-risk entities
        </div>
      )}

      <div className="mt-3 text-[10px] text-slate-700 leading-relaxed">
        Scores reflect similarity to pre-blacklist patterns in synthetic data.
        Not a legal prediction.
      </div>
    </div>
  )
}
