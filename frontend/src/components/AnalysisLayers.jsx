import { useState } from 'react'
import {
  Type, Sliders, Ear, Calculator, Globe, Gavel, Bitcoin,
  ChevronDown, ChevronUp, CheckCircle2, ArrowRight, Info
} from 'lucide-react'

const STAGE_META = {
  normalization:       { icon: Type,        color: 'text-blue-400',    bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  string_similarity:   { icon: Sliders,     color: 'text-violet-400',  bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  phonetic_similarity: { icon: Ear,         color: 'text-cyan-400',    bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20' },
  score_combination:   { icon: Calculator,  color: 'text-indigo-400',  bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  country_adjustment:  { icon: Globe,       color: 'text-amber-400',   bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  verdict:             { icon: Gavel,       color: 'text-slate-300',   bg: 'bg-slate-500/10',  border: 'border-slate-500/20' },
  crypto_lookup:       { icon: Bitcoin,     color: 'text-orange-400',  bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
}

function ScorePill({ score, weight }) {
  const pct = Math.round((score ?? 0) * 100)
  const color = pct >= 92 ? 'text-red-400' : pct >= 78 ? 'text-amber-400' : pct >= 60 ? 'text-yellow-400' : 'text-slate-400'
  return (
    <div className="flex items-center gap-1.5 text-xs">
      {weight !== undefined && (
        <span className="text-slate-600">×{weight}</span>
      )}
      <span className={`font-bold font-mono ${color}`}>{pct}%</span>
    </div>
  )
}

function SignalBadge({ signal }) {
  const cfg = {
    confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    conflict:  'bg-red-500/15 text-red-400 border-red-500/30',
    unknown:   'bg-slate-500/15 text-slate-400 border-slate-500/30',
    'n/a':     'bg-slate-500/15 text-slate-500 border-slate-600/30',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg[signal] || cfg.unknown}`}>
      {signal}
    </span>
  )
}

function TokenRow({ label, tokens, className = '' }) {
  return (
    <div className={`flex items-start gap-2 text-xs ${className}`}>
      <span className="text-slate-600 w-20 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {tokens?.length > 0
          ? tokens.map((t, i) => (
              <span key={i} className="font-mono px-1.5 py-0.5 rounded bg-bg-3 text-slate-300 border border-slate-700">
                {t}
              </span>
            ))
          : <span className="text-slate-600 italic">—</span>
        }
      </div>
    </div>
  )
}

function MetaphoneRow({ label, codes, highlight = [] }) {
  const hlSet = new Set(highlight)
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="text-slate-600 w-28 flex-shrink-0 pt-0.5">{label}</span>
      <div className="flex flex-wrap gap-1">
        {codes?.length > 0
          ? codes.map((c, i) => (
              <span
                key={i}
                className={`font-mono px-1.5 py-0.5 rounded border text-xs ${
                  hlSet.has(c)
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
                    : 'bg-bg-3 text-slate-400 border-slate-700'
                }`}
              >
                {c}
              </span>
            ))
          : <span className="text-slate-600 italic">—</span>
        }
      </div>
    </div>
  )
}

// ─── Individual layer detail renderers ────────────────────────────────────────

function NormalizationDetail({ layer }) {
  if (layer.original === layer.normalized) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <CheckCircle2 size={12} className="text-emerald-400" />
        Input already in normalized form — no transformations needed.
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {/* Transformation tags */}
      {layer.transformations_applied?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {layer.transformations_applied.map(t => (
            <span key={t} className="text-xs px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
              {t}
            </span>
          ))}
        </div>
      )}
      {/* Step chain */}
      <div className="space-y-1.5">
        {layer.steps?.map((step, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <span className="text-slate-600 w-44 flex-shrink-0 pt-0.5 truncate">{step.name}</span>
            <ArrowRight size={10} className="text-slate-700 flex-shrink-0 mt-0.5" />
            <span className="font-mono text-slate-300 break-all">{step.value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function StringSimilarityDetail({ layer }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 italic">
        Tokens sorted alphabetically before comparison — eliminates name-order variants.
        {layer.used_collapsed && (
          <span className="ml-1 text-slate-600">(Space-collapse variant used — CJK input detected.)</span>
        )}
      </p>
      <TokenRow label="Query sorted" tokens={layer.query_tokens_sorted} />
      <TokenRow label="Alias sorted" tokens={layer.candidate_tokens_sorted} />
      <div className="flex items-center gap-3 pt-1">
        <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-violet-500 rounded-full"
            style={{ width: `${Math.round((layer.score ?? 0) * 100)}%` }}
          />
        </div>
        <span className="text-xs font-mono text-violet-400 font-bold">
          {Math.round((layer.score ?? 0) * 100)}%
        </span>
        <span className="text-xs text-slate-600">× 0.7 = {Math.round((layer.contribution ?? 0) * 100)}%</span>
      </div>
    </div>
  )
}

function PhoneticDetail({ layer }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 italic">
        Each token converted to its Metaphone phonetic code. Overlap (Jaccard) measures how
        phonetically similar the names sound — handles spelling variants like Mohamed / Muhammad.
      </p>
      <MetaphoneRow label="Query codes" codes={layer.query_metaphones} highlight={layer.intersection} />
      <MetaphoneRow label="Alias codes" codes={layer.candidate_metaphones} highlight={layer.intersection} />
      {layer.intersection?.length > 0 && (
        <div className="flex items-start gap-2 text-xs">
          <span className="text-slate-600 w-28 flex-shrink-0">Matched codes</span>
          <div className="flex flex-wrap gap-1">
            {layer.intersection.map((c, i) => (
              <span key={i} className="font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="text-xs text-slate-600">
        Jaccard: {layer.intersection?.length || 0} / {layer.union?.length || 0} ={' '}
        <span className="text-cyan-400 font-mono font-bold">
          {Math.round((layer.score ?? 0) * 100)}%
        </span>
        {' '}× 0.3 ={' '}
        <span className="text-slate-400 font-mono">
          {Math.round((layer.contribution ?? 0) * 100)}%
        </span>
      </div>
    </div>
  )
}

function ScoreCombinationDetail({ layer }) {
  const strPct = Math.round((layer.string_contribution ?? 0) * 100)
  const phonPct = Math.round((layer.phonetic_contribution ?? 0) * 100)
  const rawPct = Math.round((layer.raw_score ?? 0) * 100)

  return (
    <div className="space-y-3">
      <div className="font-mono text-sm text-slate-300 bg-bg-3 rounded-lg px-3 py-2 border border-slate-700">
        0.7 × {Math.round((layer.string_sim ?? 0) * 100)}% + 0.3 × {Math.round((layer.phonetic_sim ?? 0) * 100)}% ={' '}
        <span className="text-indigo-300 font-bold">{rawPct}%</span>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-28">String (70%)</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-violet-500 rounded-full" style={{ width: `${strPct}%` }} />
          </div>
          <span className="font-mono text-violet-400 w-10 text-right">{strPct}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 w-28">Phonetic (30%)</span>
          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-500 rounded-full" style={{ width: `${phonPct}%` }} />
          </div>
          <span className="font-mono text-cyan-400 w-10 text-right">{phonPct}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="text-slate-400 w-28">Raw Score</span>
          <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${rawPct}%` }} />
          </div>
          <span className="font-mono text-indigo-300 w-10 text-right">{rawPct}%</span>
        </div>
      </div>
    </div>
  )
}

function CountryAdjustmentDetail({ layer }) {
  const adjustmentLabel = layer.adjustment > 0
    ? `+${Math.round(layer.adjustment * 100)}pp boost`
    : layer.adjustment < 0
    ? `${Math.round(layer.adjustment * 100)}pp penalty`
    : 'No adjustment'

  const rawPct = Math.round((layer.raw_score ?? 0) * 100)
  const finalPct = Math.round((layer.final_score ?? 0) * 100)

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-bg-3 rounded-lg px-3 py-2 border border-slate-700 text-xs">
          <div className="text-slate-500 mb-1">Query Country</div>
          <div className="font-medium text-slate-200">
            {layer.query_country || <span className="text-slate-500 italic">not provided</span>}
          </div>
        </div>
        <div className="bg-bg-3 rounded-lg px-3 py-2 border border-slate-700 text-xs">
          <div className="text-slate-500 mb-1">Entity Countries</div>
          <div className="font-medium text-slate-200">
            {layer.entity_countries?.length > 0
              ? layer.entity_countries.join(', ')
              : <span className="text-slate-500 italic">unknown</span>
            }
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Signal:</span>
          <SignalBadge signal={layer.signal} />
        </div>
        <span className={`text-xs font-mono font-bold ${
          layer.adjustment > 0 ? 'text-emerald-400'
          : layer.adjustment < 0 ? 'text-red-400'
          : 'text-slate-400'
        }`}>
          {adjustmentLabel}
        </span>
      </div>
      <div className="flex items-center gap-2 text-xs">
        <span className="font-mono text-slate-400">{rawPct}%</span>
        <ArrowRight size={12} className="text-slate-600" />
        <span className="font-mono font-bold text-slate-200">{finalPct}%</span>
        {layer.adjustment !== 0 && (
          <span className={`${layer.adjustment > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ({layer.adjustment > 0 ? '+' : ''}{Math.round(layer.adjustment * 100)}pp)
          </span>
        )}
      </div>
    </div>
  )
}

function VerdictDetail({ layer }) {
  const matchPct = Math.round(layer.match_threshold * 100)
  const reviewPct = Math.round(layer.review_threshold * 100)
  const scorePct = Math.round(layer.score * 100)
  const verdictColor = {
    MATCH: 'text-red-400', REVIEW: 'text-amber-400', NO_MATCH: 'text-emerald-400',
  }

  return (
    <div className="space-y-3">
      {/* Threshold gauge */}
      <div className="relative pt-1">
        <div className="flex h-3 rounded-full overflow-hidden text-xs">
          <div className="bg-emerald-500/30 border-r border-emerald-500/40" style={{ width: `${reviewPct}%` }} />
          <div className="bg-amber-500/30 border-r border-amber-500/40" style={{ width: `${matchPct - reviewPct}%` }} />
          <div className="bg-red-500/30" style={{ width: `${100 - matchPct}%` }} />
        </div>
        {/* Score marker */}
        <div
          className="absolute top-0 h-3 w-0.5 bg-white/80"
          style={{ left: `${scorePct}%`, transform: 'translateX(-50%)' }}
        />
        <div className="flex justify-between text-xs text-slate-600 mt-1">
          <span>0%</span>
          <span className="text-amber-600/70">REVIEW {reviewPct}%</span>
          <span className="text-red-600/70">MATCH {matchPct}%</span>
          <span>100%</span>
        </div>
      </div>
      <div className="text-sm">
        Score <span className="font-mono font-bold text-slate-200">{scorePct}%</span>
        {' '}→{' '}
        <span className={`font-bold ${verdictColor[layer.verdict]}`}>{layer.verdict}</span>
      </div>
    </div>
  )
}

function CryptoLookupDetail({ layer }) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-start gap-2">
        <span className="text-slate-600 w-20 flex-shrink-0">Original</span>
        <span className="font-mono text-slate-300 break-all">{layer.original}</span>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-slate-600 w-20 flex-shrink-0">Normalized</span>
        <span className="font-mono text-slate-300 break-all">{layer.normalized}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-slate-600 w-20 flex-shrink-0">Method</span>
        <span className="font-mono text-slate-400">O(1) dictionary lookup</span>
      </div>
      {layer.result === 'found' && (
        <div className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 size={12} />
          <span>Match: <span className="font-semibold">{layer.matched_entity}</span></span>
        </div>
      )}
    </div>
  )
}

function LayerDetail({ layer }) {
  switch (layer.stage) {
    case 'normalization':       return <NormalizationDetail layer={layer} />
    case 'string_similarity':   return <StringSimilarityDetail layer={layer} />
    case 'phonetic_similarity': return <PhoneticDetail layer={layer} />
    case 'score_combination':   return <ScoreCombinationDetail layer={layer} />
    case 'country_adjustment':  return <CountryAdjustmentDetail layer={layer} />
    case 'verdict':             return <VerdictDetail layer={layer} />
    case 'crypto_lookup':       return <CryptoLookupDetail layer={layer} />
    default:                    return <pre className="text-xs text-slate-500 font-mono">{JSON.stringify(layer, null, 2)}</pre>
  }
}

function LayerSummary({ layer }) {
  switch (layer.stage) {
    case 'normalization':
      return layer.changed
        ? <span className="font-mono text-xs text-slate-300">"{layer.original}" → "{layer.normalized}"</span>
        : <span className="text-xs text-slate-500">No change needed</span>
    case 'string_similarity':
      return <ScorePill score={layer.score} weight={0.7} />
    case 'phonetic_similarity':
      return <ScorePill score={layer.score} weight={0.3} />
    case 'score_combination':
      return <ScorePill score={layer.raw_score} />
    case 'country_adjustment':
      return <SignalBadge signal={layer.signal} />
    case 'verdict':
      return (
        <span className={`text-sm font-bold ${
          layer.verdict === 'MATCH' ? 'text-red-400'
          : layer.verdict === 'REVIEW' ? 'text-amber-400'
          : 'text-emerald-400'
        }`}>
          {layer.verdict}
        </span>
      )
    case 'crypto_lookup':
      return (
        <span className={`text-xs font-medium ${layer.result === 'found' ? 'text-red-400' : 'text-emerald-400'}`}>
          {layer.result === 'found' ? 'Found' : 'Not found'}
        </span>
      )
    default:
      return null
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalysisLayers({ layers }) {
  const [expanded, setExpanded] = useState(new Set(['normalization', 'verdict']))

  const toggle = (stage) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(stage) ? next.delete(stage) : next.add(stage)
      return next
    })
  }

  if (!layers?.length) return null

  return (
    <div className="animate-fade-in">
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Analysis Pipeline
        </span>
        <span className="text-xs text-slate-700">({layers.length} stages)</span>
        <button
          onClick={() => setExpanded(layers.length === expanded.size ? new Set() : new Set(layers.map(l => l.stage)))}
          className="ml-auto text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          {layers.length === expanded.size ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      <div className="space-y-2">
        {layers.map((layer, i) => {
          const meta = STAGE_META[layer.stage] || STAGE_META.normalization
          const Icon = meta.icon
          const isOpen = expanded.has(layer.stage)

          return (
            <div
              key={layer.stage}
              className={`rounded-xl border bg-bg-1 transition-all ${meta.border} ${isOpen ? '' : 'hover:border-slate-600'}`}
            >
              {/* Layer header — always visible */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => toggle(layer.stage)}
              >
                {/* Stage number + icon */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg ${meta.bg} ${meta.border} border flex items-center justify-center`}>
                  <Icon size={14} className={meta.color} />
                </div>

                {/* Title + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-300">{layer.title}</span>
                    <span className="text-xs text-slate-700">{i + 1}/{layers.length}</span>
                  </div>
                  <div className="text-xs text-slate-600 truncate mt-0.5">{layer.description}</div>
                </div>

                {/* Summary result */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  <LayerSummary layer={layer} />
                  {isOpen
                    ? <ChevronUp size={14} className="text-slate-600" />
                    : <ChevronDown size={14} className="text-slate-600" />
                  }
                </div>
              </button>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 pt-0 border-t border-slate-800/60 mt-0 animate-fade-in">
                  <div className="pt-3">
                    <LayerDetail layer={layer} />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
