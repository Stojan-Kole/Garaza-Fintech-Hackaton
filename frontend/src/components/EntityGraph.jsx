import { useRef, useEffect, useCallback } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

const NODE_COLOR = {
  individual: '#3B82F6',
  company:    '#8B5CF6',
  address:    '#6B7280',
  wallet:     '#F59E0B',
}
const SANCTIONED_COLOR = '#EF4444'

const LINK_COLOR = {
  owns:                '#F97316',
  directs:             '#60A5FA',
  registered_at:       '#6B7280',
  controls_wallet:     '#FBBF24',
  beneficial_owner_of: '#A78BFA',
}

// Manual rounded rect — avoids ctx.roundRect browser compat concerns
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function hexPath(ctx, cx, cy, r) {
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6
    const px = cx + r * Math.cos(angle)
    const py = cy + r * Math.sin(angle)
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
  }
  ctx.closePath()
}

function paintNode(node, ctx, globalScale, selectedId) {
  const isSelected  = node.id === selectedId
  const isSanctioned = node.sanctioned
  const r = isSanctioned ? 13 : 9
  const fill = isSanctioned ? SANCTIONED_COLOR : (NODE_COLOR[node.type] || '#94A3B8')

  ctx.save()

  if (isSanctioned || isSelected) {
    ctx.shadowColor = isSanctioned ? '#EF4444' : '#60A5FA'
    ctx.shadowBlur  = isSelected ? 22 : 16
  }

  ctx.fillStyle   = fill
  ctx.strokeStyle = isSelected ? '#93C5FD' : (isSanctioned ? '#FCA5A5' : 'transparent')
  ctx.lineWidth   = isSelected ? 2.5 : (isSanctioned ? 1.5 : 0)

  if (node.type === 'company') {
    const w = r * 2.8, h = r * 1.8
    roundRect(ctx, node.x - w / 2, node.y - h / 2, w, h, 4)
  } else if (node.type === 'address') {
    ctx.beginPath()
    ctx.moveTo(node.x,          node.y - r)
    ctx.lineTo(node.x + r * 0.9, node.y)
    ctx.lineTo(node.x,          node.y + r)
    ctx.lineTo(node.x - r * 0.9, node.y)
    ctx.closePath()
  } else if (node.type === 'wallet') {
    hexPath(ctx, node.x, node.y, r)
  } else {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI)
  }

  ctx.fill()
  if (isSelected || isSanctioned) ctx.stroke()

  ctx.shadowBlur = 0
  ctx.restore()

  // Label below node
  const fontSize = Math.max(8, 11 / Math.sqrt(globalScale))
  ctx.font = `500 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.textAlign     = 'center'
  ctx.textBaseline  = 'middle'
  ctx.fillStyle     = isSanctioned ? '#FCA5A5' : '#94A3B8'
  ctx.fillText(node.shortLabel || node.label || node.id, node.x, node.y + r + fontSize * 1.1)
}

function paintNodePointerArea(node, color, ctx) {
  const r = node.sanctioned ? 14 : 10
  ctx.fillStyle = color
  if (node.type === 'company') {
    const w = r * 2.8, h = r * 1.8
    ctx.fillRect(node.x - w / 2, node.y - h / 2, w, h)
  } else if (node.type === 'address') {
    ctx.beginPath()
    ctx.moveTo(node.x,          node.y - r)
    ctx.lineTo(node.x + r * 0.9, node.y)
    ctx.lineTo(node.x,          node.y + r)
    ctx.lineTo(node.x - r * 0.9, node.y)
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI)
    ctx.fill()
  }
}

export default function EntityGraph({ data, width, height, focusNodeId, onNodeClick, selectedId }) {
  const graphRef = useRef(null)

  // Zoom to fit once data is ready
  useEffect(() => {
    const t = setTimeout(() => graphRef.current?.zoomToFit(500, 80), 350)
    return () => clearTimeout(t)
  }, [data])

  const nodeCanvasObject = useCallback(
    (node, ctx, gs) => paintNode(node, ctx, gs, selectedId),
    [selectedId],
  )

  const nodePointerAreaPaint = useCallback(paintNodePointerArea, [])

  const linkColorFn  = useCallback((link) => LINK_COLOR[link.type] || '#475569', [])
  const linkParticleColor = useCallback((link) => LINK_COLOR[link.type] || '#475569', [])

  return (
    <ForceGraph2D
      ref={graphRef}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="#070B14"
      nodeId="id"
      nodeLabel={(n) =>
        [n.label, n.sanctioned ? '[SANCTIONED]' : '', n.detail].filter(Boolean).join('\n')
      }
      nodeCanvasObject={nodeCanvasObject}
      nodeCanvasObjectMode={() => 'replace'}
      nodePointerAreaPaint={nodePointerAreaPaint}
      linkColor={linkColorFn}
      linkLabel={(l) => l.label || ''}
      linkWidth={1.5}
      linkDirectionalArrowLength={6}
      linkDirectionalArrowRelPos={0.85}
      linkDirectionalParticles={2}
      linkDirectionalParticleWidth={2}
      linkDirectionalParticleColor={linkParticleColor}
      onNodeClick={onNodeClick}
      cooldownTime={4000}
      d3AlphaDecay={0.025}
      d3VelocityDecay={0.35}
      warmupTicks={40}
    />
  )
}
