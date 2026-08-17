import { PointerEvent, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import type { SnipInitPayload } from '../../../shared/types'
import {
  SNIP_COLORS,
  STROKE,
  drawShape,
  paintShapes,
  type Shape,
  type SnipTool
} from './draw'

type Rect = { x: number; y: number; w: number; h: number }
type Phase = 'select' | 'edit'

const MIN_SEL = 8

function shapeIsUseful(shape: Shape): boolean {
  if (shape.type === 'pen') return shape.points.length >= 2
  const dx = shape.b.x - shape.a.x
  const dy = shape.b.y - shape.a.y
  return dx * dx + dy * dy >= 16
}

function normRect(x0: number, y0: number, x1: number, y1: number, square: boolean): Rect {
  let w = x1 - x0
  let h = y1 - y0
  if (square) {
    const side = Math.max(Math.abs(w), Math.abs(h))
    w = Math.sign(w || 1) * side
    h = Math.sign(h || 1) * side
  }
  const x = w < 0 ? x0 + w : x0
  const y = h < 0 ? y0 + h : y0
  return { x, y, w: Math.abs(w), h: Math.abs(h) }
}

function pt(e: PointerEvent, origin?: { x: number; y: number }): { x: number; y: number } {
  return {
    x: e.clientX - (origin?.x ?? 0),
    y: e.clientY - (origin?.y ?? 0)
  }
}

function toBlobUrl(png: Uint8Array | ArrayBuffer): string {
  const bytes = png instanceof ArrayBuffer ? new Uint8Array(png) : png
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return URL.createObjectURL(new Blob([copy], { type: 'image/png' }))
}

export default function SnipApp() {
  const [src, setSrc] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('select')
  const [sel, setSel] = useState<Rect | null>(null)
  const [tool, setTool] = useState<SnipTool>('arrow')
  const [color, setColor] = useState<string>(SNIP_COLORS[0])
  const [shapes, setShapes] = useState<Shape[]>([])
  const [saving, setSaving] = useState(false)

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const marqueeRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<HTMLSpanElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const srcRef = useRef<string | null>(null)
  const dragRef = useRef<{
    kind: 'select' | 'shape'
    x0: number
    y0: number
    tool?: SnipTool
    color?: string
    points?: { x: number; y: number }[]
  } | null>(null)
  const draftRef = useRef<Shape | null>(null)
  const shapesRef = useRef(shapes)
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const selRef = useRef(sel)
  const phaseRef = useRef(phase)
  const savingRef = useRef(false)
  const rafRef = useRef(0)

  shapesRef.current = shapes
  toolRef.current = tool
  colorRef.current = color
  selRef.current = sel
  phaseRef.current = phase

  const paint = useCallback((draft: Shape | null) => {
    const canvas = canvasRef.current
    const box = selRef.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    paintShapes(ctx, shapesRef.current, draft, box.w, box.h)
  }, [])

  function applyMarquee(rect: Rect): void {
    const el = marqueeRef.current
    if (!el) return
    el.style.display = 'block'
    el.style.left = `${rect.x}px`
    el.style.top = `${rect.y}px`
    el.style.width = `${rect.w}px`
    el.style.height = `${rect.h}px`
    if (sizeRef.current) {
      sizeRef.current.textContent = `${Math.round(rect.w)} × ${Math.round(rect.h)}`
    }
  }

  function hideMarquee(): void {
    const el = marqueeRef.current
    if (el) el.style.display = 'none'
    if (veilRef.current) veilRef.current.style.display = 'block'
  }

  useEffect(() => {
    function apply(next: SnipInitPayload | null): void {
      if (!next?.png) return
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
      const url = toBlobUrl(next.png)
      srcRef.current = url
      setSrc(url)
      setPhase('select')
      setSel(null)
      setShapes([])
      draftRef.current = null
      dragRef.current = null
      // The overlay window is parked and reused between snips, so clear the
      // save latch that the previous snip left behind.
      savingRef.current = false
      setSaving(false)
      hideMarquee()
    }
    void window.tars.getSnipPayload().then(apply)
    return window.tars.onSnipInit(apply)
  }, [])

  useEffect(() => {
    return () => {
      if (srcRef.current) URL.revokeObjectURL(srcRef.current)
    }
  }, [])

  useEffect(() => {
    paint(null)
  }, [shapes, paint])

  useEffect(() => {
    if (phase !== 'edit' || !sel) return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    canvas.width = Math.max(1, Math.round(sel.w * dpr))
    canvas.height = Math.max(1, Math.round(sel.h * dpr))
    canvas.style.width = `${sel.w}px`
    canvas.style.height = `${sel.h}px`
    canvas.style.display = 'block'
    if (sizeRef.current) sizeRef.current.style.display = 'none'
    paint(null)
  }, [phase, sel, paint])

  const save = useCallback(async () => {
    const image = imgRef.current
    const box = selRef.current
    if (!image || !box || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    let saved = false
    try {
      const scaleX = image.naturalWidth / window.innerWidth
      const scaleY = image.naturalHeight / window.innerHeight
      const sx = box.x * scaleX
      const sy = box.y * scaleY
      const sw = Math.max(1, box.w * scaleX)
      const sh = Math.max(1, box.h * scaleY)
      const out = document.createElement('canvas')
      out.width = Math.max(1, Math.round(sw))
      out.height = Math.max(1, Math.round(sh))
      const ctx = out.getContext('2d')
      if (!ctx) return
      ctx.drawImage(image, sx, sy, sw, sh, 0, 0, out.width, out.height)
      ctx.setTransform(out.width / box.w, 0, 0, out.height / box.h, 0, 0)
      for (const shape of shapesRef.current) drawShape(ctx, shape)
      const blob = await new Promise<Blob | null>((resolve) =>
        out.toBlob((next) => resolve(next), 'image/png')
      )
      if (!blob) return
      const bytes = await blob.arrayBuffer()
      saved = Boolean(await window.tars.completeSnip({ bytes }))
    } catch (error) {
      console.error('Failed to save snip:', error)
    } finally {
      if (!saved) {
        savingRef.current = false
        setSaving(false)
      }
    }
  }, [])

  const cancel = useCallback(() => {
    void window.tars.cancelSnip()
  }, [])

  const retake = useCallback(() => {
    setPhase('select')
    setSel(null)
    setShapes([])
    draftRef.current = null
    dragRef.current = null
    hideMarquee()
    if (canvasRef.current) canvasRef.current.style.display = 'none'
    if (sizeRef.current) sizeRef.current.style.display = 'block'
  }, [])

  const undo = useCallback(() => {
    setShapes((prev) => prev.slice(0, -1))
  }, [])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (phaseRef.current === 'edit') retake()
        else cancel()
        return
      }
      const mod = event.metaKey || event.ctrlKey
      if (mod && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if (event.key === 'Enter' && phaseRef.current === 'edit') {
        event.preventDefault()
        void save()
        return
      }
      if (mod || phaseRef.current !== 'edit') return
      const key = event.key.toLowerCase()
      if (key === 'a') setTool('arrow')
      if (key === 'b' || key === 'r') setTool('rect')
      if (key === 'o' || key === 'e') setTool('ellipse')
      if (key === 'p') setTool('pen')
      if (key === 'h') setTool('highlight')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel, retake, undo, save])

  function onPointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) return
    const target = event.target as HTMLElement
    if (target.closest('.toolbar') || target.closest('.hint')) return

    if (phase === 'select') {
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = { kind: 'select', x0: event.clientX, y0: event.clientY }
      if (veilRef.current) veilRef.current.style.display = 'none'
      if (sizeRef.current) sizeRef.current.style.display = 'block'
      if (canvasRef.current) canvasRef.current.style.display = 'none'
      applyMarquee({ x: event.clientX, y: event.clientY, w: 0, h: 0 })
      return
    }

    const box = sel
    if (!box) return
    const inside =
      event.clientX >= box.x &&
      event.clientX <= box.x + box.w &&
      event.clientY >= box.y &&
      event.clientY <= box.y + box.h
    if (!inside) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const origin = { x: box.x, y: box.y }
    const start = pt(event, origin)
    const current = toolRef.current
    const ink = colorRef.current
    dragRef.current = {
      kind: 'shape',
      x0: start.x,
      y0: start.y,
      points: [start],
      tool: current,
      color: ink
    }
    const draft: Shape =
      current === 'pen'
        ? { type: 'pen', points: [start], color: ink, width: STROKE }
        : current === 'highlight'
          ? { type: 'highlight', a: start, b: start, color: ink }
          : { type: current, a: start, b: start, color: ink, width: STROKE }
    draftRef.current = draft
    paint(draft)
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag) return

    if (drag.kind === 'select') {
      const next = normRect(drag.x0, drag.y0, event.clientX, event.clientY, event.shiftKey)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => applyMarquee(next))
      return
    }

    const box = selRef.current
    if (!box) return
    const p = pt(event, { x: box.x, y: box.y })
    const current = drag.tool || toolRef.current
    const ink = drag.color || colorRef.current
    let draft: Shape
    if (current === 'pen') {
      const points = drag.points || []
      points.push(p)
      drag.points = points
      draft = { type: 'pen', points, color: ink, width: STROKE }
    } else if (current === 'highlight') {
      draft = { type: 'highlight', a: { x: drag.x0, y: drag.y0 }, b: p, color: ink }
    } else {
      draft = { type: current, a: { x: drag.x0, y: drag.y0 }, b: p, color: ink, width: STROKE }
    }
    draftRef.current = draft
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => paint(draft))
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    dragRef.current = null
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = 0
    }
    if (!drag) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // ignore
    }

    if (drag.kind === 'select') {
      const next = normRect(drag.x0, drag.y0, event.clientX, event.clientY, event.shiftKey)
      if (next.w < MIN_SEL || next.h < MIN_SEL) {
        setSel(null)
        hideMarquee()
        return
      }
      applyMarquee(next)
      selRef.current = next
      setSel(next)
      setPhase('edit')
      return
    }

    const current = draftRef.current
    draftRef.current = null
    if (current && shapeIsUseful(current)) {
      setShapes((prev) => [...prev, current])
    } else {
      paint(null)
    }
  }

  const toolbarPos = (() => {
    if (phase !== 'edit' || !sel) return null
    const barH = 54
    const gap = 12
    const below = sel.y + sel.h + gap
    const above = sel.y - barH - gap
    const top =
      below + barH < window.innerHeight - 16
        ? below
        : above > 16
          ? above
          : Math.max(16, Math.min(sel.y + 10, window.innerHeight - barH - 16))
    const left = Math.min(window.innerWidth - 16, Math.max(16, sel.x + sel.w / 2))
    return { top, left }
  })()

  return (
    <div
      className="snip"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      {src ? (
        <img
          ref={imgRef}
          className="screen"
          src={src}
          alt=""
          draggable={false}
          onLoad={() => void window.tars.snipReady()}
        />
      ) : (
        <div className="loading">Capturing…</div>
      )}

      <div ref={veilRef} className="veil" />

      <div ref={marqueeRef} className="marquee">
        <span ref={sizeRef} className="size" />
        <canvas ref={canvasRef} className="annot" />
      </div>

      <div className="hint">
        {phase === 'select'
          ? 'Drag to snip  ·  Esc to cancel'
          : 'Mark it up  ·  Enter to save  ·  Esc to retake'}
      </div>

      {toolbarPos ? (
        <div
          className="toolbar"
          style={{ top: toolbarPos.top, left: toolbarPos.left }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <ToolButton label="Arrow" active={tool === 'arrow'} onClick={() => setTool('arrow')}>
            <svg viewBox="0 0 24 24">
              <path d="M5 19L19 5M19 5h-7M19 5v7" />
            </svg>
          </ToolButton>
          <ToolButton label="Box" active={tool === 'rect'} onClick={() => setTool('rect')}>
            <svg viewBox="0 0 24 24">
              <rect x="5" y="6" width="14" height="12" rx="1.5" />
            </svg>
          </ToolButton>
          <ToolButton label="Oval" active={tool === 'ellipse'} onClick={() => setTool('ellipse')}>
            <svg viewBox="0 0 24 24">
              <ellipse cx="12" cy="12" rx="8" ry="6" />
            </svg>
          </ToolButton>
          <ToolButton label="Pen" active={tool === 'pen'} onClick={() => setTool('pen')}>
            <svg viewBox="0 0 24 24">
              <path d="M5 19l4.2-1.1L18 9.1a2 2 0 0 0-2.8-2.8L6.4 15.1 5 19z" />
            </svg>
          </ToolButton>
          <ToolButton
            label="Highlight"
            active={tool === 'highlight'}
            onClick={() => setTool('highlight')}
          >
            <svg viewBox="0 0 24 24">
              <path d="M5 16h14M8 16l2-8h4l2 8" />
            </svg>
          </ToolButton>
          <span className="rule" />
          {SNIP_COLORS.map((value) => (
            <button
              key={value}
              type="button"
              className={`swatch${color === value ? ' on' : ''}`}
              style={{ background: value }}
              aria-label={`Color ${value}`}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
            />
          ))}
          <span className="rule" />
          <ToolButton label="Undo" onClick={undo} disabled={shapes.length === 0}>
            <svg viewBox="0 0 24 24">
              <path d="M8 8H5l4-4M5 8c2.8-3 9-4 12.5 1.5S18 18 12 19" />
            </svg>
          </ToolButton>
          <button type="button" className="ghost" onClick={retake}>
            Retake
          </button>
          <button type="button" className="save" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving' : 'Save'}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className={`tool${active ? ' on' : ''}`}
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
