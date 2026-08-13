export type SnipTool = 'arrow' | 'rect' | 'ellipse' | 'pen' | 'highlight'

export type Point = { x: number; y: number }

export type Shape =
  | { type: 'arrow'; a: Point; b: Point; color: string; width: number }
  | { type: 'rect'; a: Point; b: Point; color: string; width: number }
  | { type: 'ellipse'; a: Point; b: Point; color: string; width: number }
  | { type: 'pen'; points: Point[]; color: string; width: number }
  | { type: 'highlight'; a: Point; b: Point; color: string }

export const SNIP_COLORS = ['#ff3b30', '#ffd60a', '#0a84ff', '#30d158', '#f5f5f5'] as const
export const STROKE = 3.25

function box(a: Point, b: Point): { x: number; y: number; w: number; h: number } {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
}

function drawArrow(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number): void {
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  const head = 11 + width * 1.8
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(a.x, a.y)
  ctx.lineTo(b.x, b.y)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(b.x, b.y)
  ctx.lineTo(b.x - head * Math.cos(angle - Math.PI / 7), b.y - head * Math.sin(angle - Math.PI / 7))
  ctx.lineTo(b.x - head * Math.cos(angle + Math.PI / 7), b.y - head * Math.sin(angle + Math.PI / 7))
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function strokeBox(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number): void {
  const r = box(a, b)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'round'
  ctx.strokeRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}

function strokeEllipse(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width: number): void {
  const r = box(a, b)
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.ellipse(r.x + r.w / 2, r.y + r.h / 2, r.w / 2, r.h / 2, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawPen(ctx: CanvasRenderingContext2D, points: Point[], color: string, width: number): void {
  if (points.length < 2) return
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y)
  ctx.stroke()
  ctx.restore()
}

function fillHighlight(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string): void {
  const r = box(a, b)
  ctx.save()
  ctx.globalAlpha = 0.38
  ctx.fillStyle = color
  ctx.fillRect(r.x, r.y, r.w, r.h)
  ctx.restore()
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape): void {
  switch (shape.type) {
    case 'arrow':
      drawArrow(ctx, shape.a, shape.b, shape.color, shape.width)
      break
    case 'rect':
      strokeBox(ctx, shape.a, shape.b, shape.color, shape.width)
      break
    case 'ellipse':
      strokeEllipse(ctx, shape.a, shape.b, shape.color, shape.width)
      break
    case 'pen':
      drawPen(ctx, shape.points, shape.color, shape.width)
      break
    case 'highlight':
      fillHighlight(ctx, shape.a, shape.b, shape.color)
      break
  }
}

export function paintShapes(
  ctx: CanvasRenderingContext2D,
  shapes: Shape[],
  draft: Shape | null,
  cssWidth: number,
  cssHeight: number
): void {
  const { canvas } = ctx
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const sx = cssWidth > 0 ? canvas.width / cssWidth : 1
  const sy = cssHeight > 0 ? canvas.height / cssHeight : 1
  ctx.setTransform(sx, 0, 0, sy, 0, 0)
  for (const shape of shapes) drawShape(ctx, shape)
  if (draft) drawShape(ctx, draft)
}
