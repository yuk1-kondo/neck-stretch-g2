// Gauge renderer: draws the head-position field to an offscreen canvas
// and encodes PNG bytes for `bridge.updateImageRawData`. The SDK handles
// the PNG decode + 4-bit greyscale conversion on the host side.

export const GAUGE_W = 220
export const GAUGE_H = 140

const canvas = document.createElement('canvas')
canvas.width = GAUGE_W
canvas.height = GAUGE_H
const ctx = canvas.getContext('2d')!

/** u, v in roughly [-1.3, 1.3]; (0,0) is field center, +v is up. */
export async function renderGauge(opts: {
  u: number
  v: number
  target?: { u: number; v: number; r: number }
  progress?: number // 0..1 hold progress, drawn as a ring around the target
  calibrated: boolean
}): Promise<Uint8Array> {
  const { u, v, target, progress = 0, calibrated } = opts
  const cx = GAUGE_W / 2
  const cy = GAUGE_H / 2
  const scale = Math.min(GAUGE_W, GAUGE_H) / 2.9 // px per gauge unit

  ctx.clearRect(0, 0, GAUGE_W, GAUGE_H)

  // frame + crosshair
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 1
  ctx.strokeRect(0.5, 0.5, GAUGE_W - 1, GAUGE_H - 1)
  ctx.beginPath()
  ctx.moveTo(cx, 6)
  ctx.lineTo(cx, GAUGE_H - 6)
  ctx.moveTo(6, cy)
  ctx.lineTo(GAUGE_W - 6, cy)
  ctx.stroke()

  // center reference
  ctx.fillStyle = '#555555'
  ctx.beginPath()
  ctx.arc(cx, cy, 2, 0, Math.PI * 2)
  ctx.fill()

  if (target) {
    const tx = cx + target.u * scale
    const ty = cy - target.v * scale
    const tr = target.r * scale

    ctx.strokeStyle = '#aaaaaa'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(tx, ty, tr, 0, Math.PI * 2)
    ctx.stroke()

    if (progress > 0) {
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 4
      ctx.beginPath()
      ctx.arc(tx, ty, tr + 4, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
      ctx.stroke()
    }
  }

  // head dot (clamped just inside the frame)
  const dx = Math.max(6, Math.min(GAUGE_W - 6, cx + u * scale))
  const dy = Math.max(6, Math.min(GAUGE_H - 6, cy - v * scale))
  ctx.fillStyle = calibrated ? '#ffffff' : '#777777'
  ctx.beginPath()
  ctx.arc(dx, dy, 5, 0, Math.PI * 2)
  ctx.fill()

  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('gauge toBlob failed')
  return new Uint8Array(await blob.arrayBuffer())
}
