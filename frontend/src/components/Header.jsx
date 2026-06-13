import { Shield, Database, Wifi, WifiOff, Clock } from 'lucide-react'

export default function Header({ health }) {
  const online = health?.status === 'ok'

  return (
    <header className="h-14 border-b border-slate-800 bg-bg-1 flex items-center px-4 gap-4 flex-shrink-0 z-20">
      {/* Brand */}
      <div className="flex items-center gap-2.5 select-none">
        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
          <Shield size={15} className="text-white" strokeWidth={2.5} />
        </div>
        <span className="font-semibold text-slate-100 tracking-tight">SanctionScreen</span>
        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-bg-3 text-slate-400 border border-slate-700">
          v0.2
        </span>
      </div>

      <div className="w-px h-6 bg-slate-800 mx-1" />

      {/* OFAC source indicator */}
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Database size={13} />
        <span>OFAC SDN List</span>
        <a
          href="https://ofac.treasury.gov/downloads/sdn.xml"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          sdn.xml
        </a>
      </div>

      <div className="flex-1" />

      {/* API status */}
      {health ? (
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
            <span className="text-emerald-400 font-medium">API Live</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <Database size={11} />
            <span>{health.entities?.toLocaleString()} entities</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="mono text-slate-500">₿</span>
            <span>{health.crypto_addresses?.toLocaleString()} crypto</span>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <WifiOff size={13} />
          <span>API Offline</span>
        </div>
      )}

      {/* Source info */}
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        <Clock size={11} />
        <span>Updated daily</span>
      </div>

      <a
        href="https://sanctionssearch.ofac.treas.gov/"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs px-2.5 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors"
      >
        OFAC Search ↗
      </a>
    </header>
  )
}
