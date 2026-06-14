import { useState, useEffect, useRef } from 'react'
import { Search, Loader2, Globe, CreditCard, Wallet, AlertCircle, Zap } from 'lucide-react'

const COUNTRY_SUGGESTIONS = [
  'Russia', 'Iran', 'North Korea', 'Syria', 'Cuba', 'Belarus', 'Venezuela',
  'China', 'Ukraine', 'Myanmar', 'Zimbabwe', 'Libya', 'Sudan', 'Yemen',
  'United States', 'Germany', 'France', 'United Kingdom', 'UAE',
]

const BUSINESS_TYPES = [
  'Hair Salon', 'Beauty Salon', 'Nail Salon', 'Barber', 'Laundromat',
  'Car Wash', 'Restaurant', 'Food Truck', 'Retail', 'Florist',
  'Bakery', 'Convenience Store', 'Gas Station', 'Tattoo',
]

const DEMO_SCENARIOS = [
  {
    label: 'Iran + Round Amount',
    data: {
      sender_name: 'Reza Ahmadi',
      receiver_name: 'Dubai Trade LLC',
      sender_country: 'Iran',
      receiver_country: 'UAE',
      amount: 50000,
      transaction_timestamp: new Date().toISOString().slice(0, 16) + ':00',
      account_age_days: '',
      business_type: '',
      sender_tx_count_24h: '',
    },
  },
  {
    label: 'Smurfing + New Account',
    data: {
      sender_name: 'John Smith',
      receiver_name: 'Jane Doe',
      sender_country: 'United States',
      receiver_country: 'United States',
      amount: 9500,
      transaction_timestamp: new Date().toISOString().slice(0, 16) + ':00',
      account_age_days: 8,
      business_type: '',
      sender_tx_count_24h: '',
    },
  },
  {
    label: 'Business Mismatch',
    data: {
      sender_name: 'Sunny Hair Salon',
      receiver_name: 'Offshore Holdings Inc',
      sender_country: 'United States',
      receiver_country: 'Cayman Islands',
      amount: 250000,
      transaction_timestamp: (() => {
        const d = new Date(); d.setHours(3, 15); return d.toISOString().slice(0, 16) + ':00'
      })(),
      account_age_days: '',
      business_type: 'Hair Salon',
      sender_tx_count_24h: 7,
    },
  },
]

export default function ScreeningForm({ onSubmit, onAnalyze, loading, error }) {
  const [mode, setMode] = useState('fiat')

  // Fiat / crypto fields
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [wallet, setWallet] = useState('')

  // Transaction fields
  const [senderName, setSenderName] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [senderCountry, setSenderCountry] = useState('')
  const [receiverCountry, setReceiverCountry] = useState('')
  const [amount, setAmount] = useState('')
  const [timestamp, setTimestamp] = useState('')
  const [accountAgeDays, setAccountAgeDays] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [txCount24h, setTxCount24h] = useState('')

  const nameRef = useRef(null)

  useEffect(() => {
    nameRef.current?.focus()
  }, [mode])

  const loadScenario = (scenario) => {
    const d = scenario.data
    setSenderName(d.sender_name || '')
    setReceiverName(d.receiver_name || '')
    setSenderCountry(d.sender_country || '')
    setReceiverCountry(d.receiver_country || '')
    setAmount(d.amount !== '' ? String(d.amount) : '')
    setTimestamp(d.transaction_timestamp || '')
    setAccountAgeDays(d.account_age_days !== '' ? String(d.account_age_days) : '')
    setBusinessType(d.business_type || '')
    setTxCount24h(d.sender_tx_count_24h !== '' ? String(d.sender_tx_count_24h) : '')
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (mode === 'fiat' && name.trim()) {
      onSubmit({ name: name.trim(), country: country.trim() || undefined })
    } else if (mode === 'crypto' && wallet.trim()) {
      onSubmit({ wallet_address: wallet.trim() })
    } else if (mode === 'transaction') {
      const payload = {}
      if (senderName.trim()) payload.sender_name = senderName.trim()
      if (receiverName.trim()) payload.receiver_name = receiverName.trim()
      if (senderCountry.trim()) payload.sender_country = senderCountry.trim()
      if (receiverCountry.trim()) payload.receiver_country = receiverCountry.trim()
      if (amount !== '') payload.amount = parseFloat(amount)
      if (timestamp) payload.transaction_timestamp = new Date(timestamp).toISOString()
      if (accountAgeDays !== '') payload.account_age_days = parseInt(accountAgeDays, 10)
      if (businessType.trim()) payload.business_type = businessType.trim()
      if (txCount24h !== '') payload.sender_tx_count_24h = parseInt(txCount24h, 10)
      onAnalyze(payload)
    }
  }

  const canSubmit =
    mode === 'fiat' ? name.trim().length > 0
    : mode === 'crypto' ? wallet.trim().length > 0
    : senderName.trim().length > 0 || receiverName.trim().length > 0 || amount !== ''

  const tabs = [
    { id: 'fiat', label: 'Fiat', icon: CreditCard },
    { id: 'crypto', label: 'Crypto', icon: Wallet },
    { id: 'transaction', label: 'Transaction', icon: Zap },
  ]

  return (
    <div className="p-4 border-b border-slate-800">
      <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
        Payment Screening
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-slate-700 p-0.5 mb-4 bg-bg-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setMode(id)}
            className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1.5 rounded-md transition-all ${
              mode === id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Icon size={11} />
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* ── Fiat ── */}
        {mode === 'fiat' && (
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
              <p className="mt-1 text-xs text-slate-600">Accepts Latin, Cyrillic, Arabic, CJK scripts</p>
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
              <p className="mt-1 text-xs text-slate-600">Boosts score if confirmed / penalises if conflicts</p>
            </div>
          </>
        )}

        {/* ── Crypto ── */}
        {mode === 'crypto' && (
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
            <p className="mt-1 text-xs text-slate-600">Exact match against ~850 OFAC-designated addresses</p>
          </div>
        )}

        {/* ── Transaction AML ── */}
        {mode === 'transaction' && (
          <>
            {/* Demo scenario picker */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                <Zap size={10} className="inline mr-1 text-amber-400" />
                Load Demo Scenario
              </label>
              <div className="grid grid-cols-1 gap-1">
                {DEMO_SCENARIOS.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => loadScenario(s)}
                    className="text-left text-xs px-2.5 py-1.5 rounded border border-slate-700 bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3">
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Sender</div>
              <div className="space-y-2">
                <input
                  ref={nameRef}
                  type="text"
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Sender name"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  autoComplete="off"
                />
                <input
                  type="text"
                  value={senderCountry}
                  onChange={e => setSenderCountry(e.target.value)}
                  placeholder="Sender country"
                  list="country-list-tx"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Receiver</div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={receiverName}
                  onChange={e => setReceiverName(e.target.value)}
                  placeholder="Receiver name"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  autoComplete="off"
                />
                <input
                  type="text"
                  value={receiverCountry}
                  onChange={e => setReceiverCountry(e.target.value)}
                  placeholder="Receiver country"
                  list="country-list-tx"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
                <datalist id="country-list-tx">
                  {COUNTRY_SUGGESTIONS.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Transaction</div>
              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="Amount (USD)"
                    min="0"
                    step="0.01"
                    className="w-full bg-bg-2 border border-slate-700 rounded-lg pl-6 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <input
                  type="datetime-local"
                  value={timestamp}
                  onChange={e => setTimestamp(e.target.value)}
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Entity Profile</div>
              <div className="space-y-2">
                <input
                  type="number"
                  value={accountAgeDays}
                  onChange={e => setAccountAgeDays(e.target.value)}
                  placeholder="Account age (days)"
                  min="0"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
                <input
                  type="text"
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  placeholder="Business type (e.g. Hair Salon)"
                  list="business-list"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
                <datalist id="business-list">
                  {BUSINESS_TYPES.map(b => <option key={b} value={b} />)}
                </datalist>
                <input
                  type="number"
                  value={txCount24h}
                  onChange={e => setTxCount24h(e.target.value)}
                  placeholder="Sender's transactions (last 24h)"
                  min="0"
                  className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
            </div>
          </>
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
              {mode === 'transaction' ? 'Analyzing…' : 'Screening…'}
            </>
          ) : (
            <>
              <Search size={14} />
              {mode === 'transaction' ? 'Analyze' : 'Screen'}
              <span className="text-blue-300 text-xs font-normal ml-1">⏎</span>
            </>
          )}
        </button>
      </form>
    </div>
  )
}
