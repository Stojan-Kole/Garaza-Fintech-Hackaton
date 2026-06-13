import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Globe, CreditCard, Wallet, AlertCircle } from 'lucide-react'

const COUNTRY_SUGGESTIONS = [
  'Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Belarus', 'Venezuela',
  'China', 'Ukraine', 'Myanmar', 'Zimbabwe', 'Libya', 'Sudan', 'Yemen',
]

export default function ScreeningForm({ onSubmit, loading, error }) {
  const [mode, setMode] = useState('fiat')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [wallet, setWallet] = useState('')
  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [mode])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (mode === 'fiat' && name.trim()) {
      onSubmit({ name: name.trim(), country: country.trim() || undefined })
    } else if (mode === 'crypto' && wallet.trim()) {
      onSubmit({ wallet_address: wallet.trim() })
    }
  }

  const canSubmit = mode === 'fiat' ? name.trim().length > 0 : wallet.trim().length > 0

  return (
    <div className="p-4 border-b border-slate-800">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Payment Screening
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-700 p-0.5 mb-4 bg-bg-1">
        {[
          { id: 'fiat', label: 'Fiat Transfer', icon: CreditCard },
          { id: 'crypto', label: 'Crypto', icon: Wallet },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 rounded-md transition-all ${
              mode === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {mode === 'fiat' ? (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sergei Ivanov"
                className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                autoComplete="off"
                spellCheck={false}
              />
              <p className="mt-1 text-xs text-slate-600">
                Accepts Latin, Cyrillic, Arabic, CJK scripts
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Country <span className="text-slate-600">(optional)</span>
              </label>
              <div className="relative">
                <Globe size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  value={country}
                  onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. Russia"
                  list="country-list"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
                />
                <datalist id="country-list">
                  {COUNTRY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <p className="mt-1 text-xs text-slate-600">
                Boosts score if confirmed / penalises if conflicts
              </p>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Wallet Address <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameRef}
              type="text"
              value={wallet}
              onChange={e => setWallet(e.target.value)}
              placeholder="BTC / ETH / XMR address…"
              className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              autoComplete="off"
              spellCheck={false}
            />
            <p className="mt-1 text-xs text-slate-600">
              Exact match against ~850 OFAC-designated addresses
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 bg-red-400/8 border border-red-400/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit || loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-sm transition-all
            disabled:opacity-40 disabled:cursor-not-allowed
            bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Screening…
            </>
          ) : (
            <>
              <Search size={14} />
              Screen
              <span className="text-blue-300 text-xs font-normal ml-1">⏎</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
