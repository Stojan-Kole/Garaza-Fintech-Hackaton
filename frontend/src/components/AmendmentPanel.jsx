import { useState } from 'react'
import { Edit3, CheckCircle, AlertTriangle, XOctagon, RotateCcw, User, FileText } from 'lucide-react'

const VERDICTS = [
  { value: 'MATCH',    label: 'MATCH — Block transaction',          icon: XOctagon,      color: 'text-red-400',     border: 'border-red-500/30',   bg: 'bg-red-500/8' },
  { value: 'REVIEW',   label: 'REVIEW — Escalate for review',       icon: AlertTriangle,  color: 'text-amber-400',   border: 'border-amber-500/30', bg: 'bg-amber-500/8' },
  { value: 'NO_MATCH', label: 'NO_MATCH — Release transaction',      icon: CheckCircle,    color: 'text-emerald-400', border: 'border-emerald-500/30',bg:'bg-emerald-500/8' },
]

const REASONS = [
  'False positive — confirmed different entity',
  'Customer due diligence completed — transaction cleared',
  'Insufficient name similarity — common name coincidence',
  'Country conflict — different jurisdiction confirmed',
  'Internal watchlist cross-reference completed',
  'PEP screening completed — no adverse findings',
  'Other (specify in notes below)',
]

export default function AmendmentPanel({ result, amendment, onAmend }) {
  const [editing, setEditing] = useState(!amendment)
  const [overrideVerdict, setOverrideVerdict] = useState(amendment?.overrideVerdict || result.verdict)
  const [reason, setReason] = useState(amendment?.reason || '')
  const [analystId, setAnalystId] = useState(amendment?.analystId || '')
  const [notes, setNotes] = useState(amendment?.notes || '')

  const canSubmit = reason.trim().length > 0 && analystId.trim().length > 0

  const handleSubmit = (e) => {
    e.preventDefault()
    onAmend({
      overrideVerdict,
      reason: reason.trim(),
      analystId: analystId.trim(),
      notes: notes.trim(),
      timestamp: new Date().toISOString(),
      originalVerdict: result.verdict,
      originalScore: result.score,
    })
    setEditing(false)
  }

  return (
    <div className="border-t border-slate-800">
      <div className="p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Edit3 size={13} className="text-slate-500" />
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Analyst Override
          </span>
        </div>
        {amendment && (
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        )}
      </div>

      {/* Existing amendment summary */}
      {amendment && !editing && (
        <div className="px-4 pb-4 space-y-2 animate-fade-in">
          <div className={`rounded-lg border p-3 ${
            amendment.overrideVerdict === 'MATCH' ? 'bg-red-500/8 border-red-500/25'
            : amendment.overrideVerdict === 'REVIEW' ? 'bg-amber-500/8 border-amber-500/25'
            : 'bg-emerald-500/8 border-emerald-500/25'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <span className={`text-sm font-bold ${
                amendment.overrideVerdict === 'MATCH' ? 'text-red-400'
                : amendment.overrideVerdict === 'REVIEW' ? 'text-amber-400'
                : 'text-emerald-400'
              }`}>
                {amendment.overrideVerdict}
              </span>
              {amendment.overrideVerdict !== amendment.originalVerdict && (
                <span className="text-xs text-slate-500">
                  was {amendment.originalVerdict}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-300">{amendment.reason}</p>
          </div>
          <div className="text-xs text-slate-500 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <User size={11} />
              <span className="font-medium text-slate-400">{amendment.analystId}</span>
            </div>
            <span>{new Date(amendment.timestamp).toLocaleString()}</span>
          </div>
          {amendment.notes && (
            <div className="text-xs text-slate-500 bg-bg-2 rounded-lg p-2 border border-slate-800">
              <FileText size={10} className="inline mr-1" />
              {amendment.notes}
            </div>
          )}
        </div>
      )}

      {/* Override form */}
      {editing && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 animate-fade-in">
          {/* Override verdict */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Override Verdict
            </label>
            <div className="space-y-1.5">
              {VERDICTS.map(v => {
                const Icon = v.icon
                const isSelected = overrideVerdict === v.value
                return (
                  <button
                    key={v.value}
                    type="button"
                    onClick={() => setOverrideVerdict(v.value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all text-xs ${
                      isSelected
                        ? `${v.bg} ${v.border} ${v.color}`
                        : 'bg-bg-2 border-slate-700 text-slate-400 hover:border-slate-600'
                    }`}
                  >
                    <Icon size={12} className="flex-shrink-0" />
                    <span>{v.label}</span>
                    {isSelected && <span className="ml-auto text-xs">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Reason <span className="text-red-400">*</span>
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            >
              <option value="">Select reason…</option>
              {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Analyst ID */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Analyst ID <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={analystId}
                onChange={e => setAnalystId(e.target.value)}
                placeholder="e.g. AML-004"
                className="w-full bg-bg-2 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">
              Notes <span className="text-slate-600">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional context for audit trail…"
              className="w-full bg-bg-2 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-colors"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all
                bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Record Override
            </button>
            {amendment && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-3 py-2 rounded-lg text-xs text-slate-400 border border-slate-700 hover:border-slate-600 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>

          <p className="text-xs text-slate-600 text-center">
            Override is recorded in session audit log
          </p>
        </form>
      )}
    </div>
  )
}
