import { useState } from 'react'
import {
  User, Building, Anchor, Plane, Hash, MapPin, Tag, List,
  Wallet, ExternalLink, Copy, ChevronDown, ChevronUp, CheckCheck, Network,
} from 'lucide-react'

const TYPE_ICONS = {
  Individual: User,
  Entity: Building,
  Vessel: Anchor,
  Aircraft: Plane,
}

const TYPE_COLORS = {
  Individual: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  Entity: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Vessel: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Aircraft: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button
      onClick={copy}
      className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
      title="Copy to clipboard"
    >
      {copied ? <CheckCheck size={12} className="text-emerald-400" /> : <Copy size={12} />}
    </button>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-t border-slate-800 py-3 px-4">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        <Icon size={11} />
        {title}
      </div>
      {children}
    </div>
  )
}

export default function EntityDetails({ entity, result, onOpenGraph }) {
  const [showAllAliases, setShowAllAliases] = useState(false)

  if (!entity) return null

  const TypeIcon = TYPE_ICONS[entity.entity_type] || Building
  const typeColor = TYPE_COLORS[entity.entity_type] || TYPE_COLORS.Entity

  const aliases = entity.all_names || []
  const visibleAliases = showAllAliases ? aliases : aliases.slice(0, 5)
  const cryptoEntries = Object.entries(entity.crypto_addresses || {})

  const ofacSearchUrl = `https://sanctionssearch.ofac.treas.gov/Details.aspx?id=${entity.uid}`

  return (
    <div className="animate-fade-in">
      {/* Entity header */}
      <div className="p-4 border-b border-slate-800">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
          Entity Details
        </div>

        {/* Name + type */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-slate-100 leading-tight break-words">
              {entity.name}
            </h3>
            {entity.matched_alias && entity.matched_alias !== entity.name && (
              <div className="text-xs text-slate-500 mt-0.5">
                Matched via: <span className="italic text-slate-400">"{entity.matched_alias}"</span>
              </div>
            )}
          </div>
          {entity.entity_type && (
            <span className={`flex-shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${typeColor}`}>
              <TypeIcon size={10} />
              {entity.entity_type}
            </span>
          )}
        </div>

        {/* Graph intelligence button */}
        <button
          onClick={() => onOpenGraph?.(entity)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 bg-purple-500/8 hover:bg-purple-500/15 border border-purple-500/20 hover:border-purple-500/35 px-3 py-2 rounded-lg transition-all"
        >
          <Network size={12} />
          View Entity Graph
        </button>

        {/* Score + country signal inline */}
        <div className="flex items-center gap-3 text-xs mt-3">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-16 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  entity.score >= 0.92 ? 'bg-red-500'
                  : entity.score >= 0.78 ? 'bg-amber-500'
                  : 'bg-slate-500'
                }`}
                style={{ width: `${Math.round((entity.score || 0) * 100)}%` }}
              />
            </div>
            <span className="font-mono font-bold text-slate-300">
              {Math.round((entity.score || 0) * 100)}%
            </span>
          </div>
          <span className={`px-2 py-0.5 rounded-full border text-xs ${
            entity.country_signal === 'confirmed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
            : entity.country_signal === 'conflict' ? 'bg-red-500/10 text-red-400 border-red-500/20'
            : 'bg-slate-500/10 text-slate-400 border-slate-600/20'
          }`}>
            {entity.country_signal}
          </span>
        </div>
      </div>

      {/* OFAC Source */}
      <Section icon={Hash} title="OFAC Source">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">SDN Entry UID</span>
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs text-slate-300">{entity.uid}</span>
              <CopyButton text={entity.uid} />
            </div>
          </div>
          <a
            href={ofacSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ExternalLink size={11} />
            View on OFAC Search
          </a>
          <a
            href="https://ofac.treasury.gov/downloads/sdn.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-400 transition-colors"
          >
            <ExternalLink size={11} />
            Source: OFAC SDN XML
          </a>
        </div>
      </Section>

      {/* Sanctions Programs */}
      {entity.programs?.length > 0 && (
        <Section icon={Tag} title="Sanctions Programs">
          <div className="flex flex-wrap gap-1.5">
            {entity.programs.map(p => (
              <a
                key={p}
                href={`https://ofac.treasury.gov/sanctions-programs-and-country-information`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/8 text-red-400 border border-red-500/20 hover:bg-red-500/15 transition-colors"
                title="View OFAC program info"
              >
                {p}
              </a>
            ))}
          </div>
        </Section>
      )}

      {/* Countries */}
      {entity.countries?.length > 0 && (
        <Section icon={MapPin} title="Associated Countries">
          <div className="flex flex-wrap gap-1.5">
            {entity.countries.map(c => (
              <span key={c} className="text-xs px-2 py-0.5 rounded bg-bg-3 text-slate-300 border border-slate-700">
                {c}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* All Aliases */}
      {aliases.length > 0 && (
        <Section icon={List} title={`Known Aliases (${aliases.length})`}>
          <div className="space-y-1">
            {visibleAliases.map((alias, i) => (
              <div key={i} className="flex items-center justify-between group">
                <span className={`text-xs leading-relaxed ${i === 0 ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                  {alias}
                </span>
                <CopyButton text={alias} />
              </div>
            ))}
          </div>
          {aliases.length > 5 && (
            <button
              onClick={() => setShowAllAliases(!showAllAliases)}
              className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              {showAllAliases
                ? <><ChevronUp size={12} /> Show fewer</>
                : <><ChevronDown size={12} /> Show {aliases.length - 5} more aliases</>
              }
            </button>
          )}
        </Section>
      )}

      {/* Crypto Addresses */}
      {cryptoEntries.length > 0 && (
        <Section icon={Wallet} title="Crypto Addresses">
          <div className="space-y-3">
            {cryptoEntries.map(([currency, addrs]) => (
              <div key={currency}>
                <div className="text-xs font-medium text-orange-400 mb-1">{currency}</div>
                {addrs.map((addr, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 group">
                    <span className="font-mono text-xs text-slate-400 break-all leading-relaxed">{addr}</span>
                    <CopyButton text={addr} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
