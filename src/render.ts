// Renderers: draw to offscreen canvases and encode PNG bytes for
// `bridge.updateImageRawData`. The SDK handles the PNG decode +
// 4-bit greyscale conversion on the host side.
//
// The firmware font covers Latin + symbols only — no CJK. Japanese copy
// is therefore rasterized through the same image pipeline: the WebView
// canvas has full system fonts.

export const GAUGE_W = 288
export const GAUGE_H = 144

const gaugeCanvas = document.createElement('canvas')
gaugeCanvas.width = GAUGE_W
gaugeCanvas.height = GAUGE_H
const gctx = gaugeCanvas.getContext('2d')!

async function toPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('toBlob failed')
  return new Uint8Array(await blob.arrayBuffer())
}

/** u, v in roughly [-1.3, 1.3]; (0,0) is field center, +v is up. */
export async function renderGauge(opts: {
  u: number
  v: number
  target?: { u: number; v: number; r: number }
  progress?: number // 0..1 hold progress, drawn as a ring around the target
  calibrated: boolean
  flash?: boolean // success pulse on the target ring
}): Promise<Uint8Array> {
  const { u, v, target, progress = 0, calibrated, flash = false } = opts
  const cx = GAUGE_W / 2
  const cy = GAUGE_H / 2
  const scale = Math.min(GAUGE_W, GAUGE_H) / 2.9 // px per gauge unit

  gctx.clearRect(0, 0, GAUGE_W, GAUGE_H)

  // frame + crosshair
  gctx.strokeStyle = '#333333'
  gctx.lineWidth = 1
  gctx.strokeRect(0.5, 0.5, GAUGE_W - 1, GAUGE_H - 1)
  gctx.beginPath()
  gctx.moveTo(cx, 6)
  gctx.lineTo(cx, GAUGE_H - 6)
  gctx.moveTo(6, cy)
  gctx.lineTo(GAUGE_W - 6, cy)
  gctx.stroke()

  // center reference
  gctx.fillStyle = '#555555'
  gctx.beginPath()
  gctx.arc(cx, cy, 2, 0, Math.PI * 2)
  gctx.fill()

  if (target) {
    const tx = cx + target.u * scale
    const ty = cy - target.v * scale
    const tr = target.r * scale

    gctx.strokeStyle = flash ? '#ffffff' : '#aaaaaa'
    gctx.lineWidth = flash ? 4 : 2
    gctx.beginPath()
    gctx.arc(tx, ty, tr, 0, Math.PI * 2)
    gctx.stroke()

    if (progress > 0) {
      gctx.strokeStyle = '#ffffff'
      gctx.lineWidth = 4
      gctx.beginPath()
      gctx.arc(tx, ty, tr + 5, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2)
      gctx.stroke()
    }
  }

  // head dot (clamped just inside the frame)
  const dx = Math.max(6, Math.min(GAUGE_W - 6, cx + u * scale))
  const dy = Math.max(6, Math.min(GAUGE_H - 6, cy - v * scale))
  gctx.fillStyle = calibrated ? '#ffffff' : '#777777'
  gctx.beginPath()
  gctx.arc(dx, dy, 5, 0, Math.PI * 2)
  gctx.fill()

  return toPng(gaugeCanvas)
}

// ── Japanese side panel ──────────────────────────────────────────────
export const SIDE_W = 272
export const SIDE_H = 144

const sideCanvas = document.createElement('canvas')
sideCanvas.width = SIDE_W
sideCanvas.height = SIDE_H
const sctx = sideCanvas.getContext('2d')!

const JP_FONT = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif'

/** Right-side info panel rasterized as an image (CJK-safe). */
export async function renderSideJa(opts: {
  title: string
  hint: string
  arrow: string
  progress: number // 0..1
  secondsLeft: number
  flash: boolean
}): Promise<Uint8Array> {
  const { title, hint, arrow, progress, secondsLeft, flash } = opts
  sctx.clearRect(0, 0, SIDE_W, SIDE_H)

  sctx.textBaseline = 'top'
  sctx.textAlign = 'left'
  sctx.fillStyle = '#ffffff'
  sctx.font = `bold 30px ${JP_FONT}`
  sctx.fillText(title, 0, 0)

  sctx.fillStyle = '#bbbbbb'
  sctx.font = `17px ${JP_FONT}`
  sctx.fillText(hint, 0, 40)

  // direction cue + hold progress
  sctx.fillStyle = '#888888'
  sctx.font = `16px ${JP_FONT}`
  sctx.fillText(flash ? '★ クリア!' : `${arrow} の方向へ`, 0, 72)

  // progress bar + countdown
  const bw = SIDE_W - 70
  sctx.strokeStyle = '#555555'
  sctx.lineWidth = 1
  sctx.strokeRect(0.5, 100.5, bw, 14)
  sctx.fillStyle = '#ffffff'
  sctx.fillRect(2, 102, Math.max(0, (bw - 4) * progress), 10)
  sctx.fillStyle = '#cccccc'
  sctx.font = `15px ${JP_FONT}`
  sctx.textAlign = 'right'
  sctx.fillText(`${secondsLeft}秒`, SIDE_W - 2, 99)

  // mini controls at the bottom of the panel
  sctx.fillStyle = '#777777'
  sctx.font = `13px ${JP_FONT}`
  sctx.textAlign = 'left'
  sctx.fillText('タップ:スキップ  長押し:補正  2連:終了', 0, SIDE_H - 18)

  return toPng(sideCanvas)
}

/** Static Japanese blocks (intro / calibrating / finished) as an image. */
export async function renderSideTextJa(lines: { text: string; dim?: boolean; big?: boolean }[]): Promise<Uint8Array> {
  sctx.clearRect(0, 0, SIDE_W, SIDE_H)
  sctx.textBaseline = 'top'
  sctx.textAlign = 'left'
  let y = 0
  for (const l of lines) {
    sctx.fillStyle = l.dim ? '#888888' : '#ffffff'
    sctx.font = `${l.big ? 'bold 28px' : '17px'} ${JP_FONT}`
    sctx.fillText(l.text, 0, y)
    y += l.big ? 38 : 24
  }
  return toPng(sideCanvas)
}
