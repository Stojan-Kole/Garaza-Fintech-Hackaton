import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  X, Network, AlertTriangle, ChevronRight, Info,
  Share2, User, Building, MapPin, Wallet,
} from 'lucide-react'
import EntityGraph from './EntityGraph'
import { getEntityGraph } from '../api'
import { generateMockGraph } from '../mockGraphData'

// ── Configuration ───────────────────────────────────────────────────────────

const NODE_TYPE_CFG = {
  individual: { label: 'Individual', color: '#3B82F6', Icon: User    },
  company:    { label: 'Company',    color: '#8B5CF6', Icon: Building },
  address:    { label: 'Address',    color: '#6B7280', Icon: MapPin   },
  wallet:     { label: 'Wallet',     color: '#F59E0B', Icon: Wallet   },
}

const LINK_TYPE_CFG = {
  owns:                { label: 'Ownership',       color: '#F97316' },
  directs:             { label: 'Directorship',    color: '#60A5FA' },
  registered_at:       { label: 'Shared Address',  color: '#6B7280' },
  controls_wallet:     { label: 'Wallet Control',  color: '#FBBF24' },
  beneficial_owner_of: { label: 'Beneficial Owner',color: '#A78BFA' },
}

const ALL_FILTER_KEYS = Object.keys(LINK_TYPE_CFG)

// ── Sub-components ──────────────────────────────────────────────────────────

function ConnectionPathBar({ path, pathLabels, nodes }) {
  if (!path || path.length < 2) return null
  const byId = Object.fromEntries((nodes || []).map(n => [n.id, n]))

  return (
    <div className="px-5 py-2.5 border-b border-slate-800 bg-bg-1/60 flex items-center gap-1 overflow-x-auto flex-shrink-0 min-h-[38px]">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2 flex-shrink-0">
        Ownership chain
      </span>
      {path.map((nodeId, i) => {
        const node = byId[nodeId]
        if (!node) return null
        return (
          <div key={nodeId} className="flex items-center gap-1 flex-shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded border whitespace-nowrap ${
              node.sanctioned
                ? 'bg-red-500/15 text-red-300 border-red-500/30 font-semibold'
                : 'bg-bg-3 text-slate-300 border-slate-700'
            }`}>
              {node.shortLabel || node.label}
            </span>
            {i < path.length - 1 && (
              <div className="flex items-center gap-0.5 text-slate-600 text-xs flex-shrink-0">
                <ChevronRight size={11} />
                {pathLabels?.[i] && (
                  <span className="text-slate-600 italic">{pathLabels[i]}</span>
                )}
                <ChevronRight size={11} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SummaryPills({ summary, isMock }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-400 flex-shrink-0">
      <span className="flex items-center gap-1">
        <Share2 size={11} className="text-slate-500" />
        {summary.total_nodes} nodes
      </span>
      <span className="text-slate-700">·</span>
      <span>{summary.total_edges} relationships</span>
      <span className="text-slate-700">·</span>
      <span className="text-amber-400 font-medium">{summary.max_hops}-hop chain</span>
      {isMock && (
        <>
          <span className="text-slate-700">·</span>
          <span className="flex items-center gap-1 text-amber-600/80">
            <Info size={10} />
            illustrative — connect Neo4j for live data
          </span>
        </>
      )}
    </div>
  )
}

function NodeInfoSidebar({ node, onClose }) {
  const cfg = NODE_TYPE_CFG[node.type]
  const Icon = cfg?.Icon

  return (
    <div className="w-60 border-l border-slate-800 bg-bg-1 flex flex-col flex-shrink-0 animate-slide-up overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Node</span>
        <button
          onClick={onClose}
          className="text-slate-600 hover:text-slate-300 transition-colors p-0.5"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-4 space-y-3 text-xs">
        {node.sanctioned && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            <AlertTriangle size={12} />
            <span className="font-semibold">OFAC Sanctioned Entity</span>
          </div>
        )}

        <Row label="Name">
          <span className="text-slate-200 font-medium leading-snug">{node.label}</span>
        </Row>

        {cfg && (
          <Row label="Type">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: cfg.color }}>
              {Icon && <Icon size={11} />}
              {cfg.label}
            </span>
          </Row>
        )}

        {node.role && <Row label="Role"><span className="text-slate-300">{node.role}</span></Row>}

        {node.detail && (
          <Row label="Detail">
            <span className="text-slate-400 leading-relaxed">{node.detail}</span>
          </Row>
        )}

        {node.note && (
          <Row label="Note">
            <span className="text-slate-500 italic leading-relaxed">{node.note}</span>
          </Row>
        )}

        {node.uid && (
          <Row label="OFAC UID">
            <span className="font-mono text-slate-300">{node.uid}</span>
          </Row>
        )}

        {node.programs?.length > 0 && (
          <div>
            <div className="text-slate-600 uppercase tracking-wider mb-1.5">Programs</div>
            <div className="flex flex-wrap gap-1">
              {node.programs.map(p => (
                <span key={p} className="font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {node.jurisdiction && (
          <Row label="Jurisdiction"><span className="text-slate-300">{node.jurisdiction}</span></Row>
        )}

        {node.address && (
          <Row label="Address">
            <span className="font-mono text-slate-300 break-all">{node.address}</span>
          </Row>
        )}
      </div>
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div>
      <div className="text-slate-600 uppercase tracking-wider mb-1">{label}</div>
      {children}
    </div>
  )
}

function GraphLegend({ activeFilters, onToggleFilter }) {
  return (
    <div className="flex items-center gap-4 flex-wrap">
      {/* Node shape legend */}
      <div className="flex items-center gap-3">
        {Object.entries(NODE_TYPE_CFG).map(([type, { label, color, Icon }]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
            <Icon size={11} style={{ color }} />
            <span>{label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs">
          <AlertTriangle size={11} className="text-red-400" />
          <span className="text-red-400 font-medium">Sanctioned</span>
        </div>
      </div>

      <div className="w-px h-4 bg-slate-800" />

      {/* Relationship filter toggles */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-700">Show:</span>
        {Object.entries(LINK_TYPE_CFG).map(([type, { label, color }]) => {
          const on = activeFilters.includes(type)
          return (
            <button
              key={type}
              onClick={() => onToggleFilter(type)}
              style={on ? { borderColor: color + '55', color } : {}}
              className={`text-xs px-2 py-0.5 rounded border transition-all ${
                on ? 'bg-slate-800/60' : 'border-slate-800 text-slate-700'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Main panel ──────────────────────────────────────────────────────────────

export default function GraphIntelligencePanel({ entity, onClose }) {
  const [graphData, setGraphData]         = useState(null)
  const [loading, setLoading]             = useState(true)
  const [selectedNode, setSelectedNode]   = useState(null)
  const [activeFilters, setActiveFilters] = useState(ALL_FILTER_KEYS)
  const containerRef = useRef(null)
  const [dims, setDims] = useState({ width: 900, height: 500 })

  // Fetch real graph data; fall back to mock
  useEffect(() => {
    setLoading(true)
    setGraphData(null)
    setSelectedNode(null)
    let cancelled = false

    async function load() {
      let data
      try {
        data = await getEntityGraph(entity.uid)
      } catch {
        data = generateMockGraph(entity)
      }
      if (!cancelled) {
        setGraphData(data)
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [entity.uid, entity.name])

  // Track canvas container size for responsive graph
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setDims({ width: Math.floor(width), height: Math.floor(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Filter links by active relationship types
  const filteredData = useMemo(() => {
    if (!graphData) return null
    return {
      nodes: graphData.nodes,
      links: graphData.links.filter(l => activeFilters.includes(l.type)),
    }
  }, [graphData, activeFilters])

  const handleToggleFilter = useCallback((type) => {
    setActiveFilters(prev =>
      prev.includes(type) ? prev.filter(f => f !== type) : [...prev, type]
    )
  }, [])

  const handleNodeClick = useCallback((node) => {
    setSelectedNode(prev => (prev?.id === node.id ? null : node))
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in bg-bg-base">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-slate-800 bg-bg-1 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-purple-600/15 border border-purple-500/25 flex items-center justify-center flex-shrink-0">
            <Network size={14} className="text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-200">Entity Graph Intelligence</div>
            <div className="text-xs text-slate-500 truncate max-w-xs">{entity.name}</div>
          </div>
        </div>

        <div className="flex-1" />

        {graphData?.summary && (
          <SummaryPills summary={graphData.summary} isMock={graphData.is_mock} />
        )}

        <div className="flex-1" />

        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
        >
          <X size={12} />
          Close Graph
        </button>
      </div>

      {/* ── Ownership chain path ────────────────────────────────────────────── */}
      {graphData && (
        <ConnectionPathBar
          path={graphData.connection_path}
          pathLabels={graphData.connection_path_labels}
          nodes={graphData.nodes}
        />
      )}

      {/* ── Graph + node inspector ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas container */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="relative mx-auto w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-purple-500/20" />
                  <div className="absolute inset-0 rounded-full border-2 border-t-purple-500 animate-spin" />
                </div>
                <p className="text-sm text-slate-500">Building entity graph…</p>
                <p className="text-xs text-slate-700">Tracing ownership chains and directorships</p>
              </div>
            </div>
          )}

          {!loading && filteredData && (
            <EntityGraph
              data={filteredData}
              width={dims.width}
              height={dims.height}
              focusNodeId={graphData.focus_node_id}
              onNodeClick={handleNodeClick}
              selectedId={selectedNode?.id ?? null}
            />
          )}
        </div>

        {/* Node inspector sidebar */}
        {selectedNode && (
          <NodeInfoSidebar
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        )}
      </div>

      {/* ── Footer: legend + filter bar ─────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-slate-800 bg-bg-1 px-5 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
        {graphData ? (
          <GraphLegend activeFilters={activeFilters} onToggleFilter={handleToggleFilter} />
        ) : (
          <div />
        )}
        <span className="text-xs text-slate-700 flex-shrink-0">
          Click node to inspect · Scroll to zoom · Drag to pan
        </span>
      </div>
    </div>
  )
}
