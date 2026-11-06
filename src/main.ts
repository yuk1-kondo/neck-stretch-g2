import {
  waitForEvenAppBridge,
  TextContainerProperty,
  ImageContainerProperty,
  ImageRawDataUpdate,
  CreateStartUpPageContainer,
  RebuildPageContainer,
  TextContainerUpgrade,
  OsEventTypeList,
  ImuReportPace,
} from '@evenrealities/even_hub_sdk'
import { HeadTracker } from './tracker'
import { ROUTINE, HOLD_MS, TARGET_RADIUS, targetOf, type Exercise } from './routine'
import { renderGauge } from './render'

const SIM = new URLSearchParams(location.search).has('sim')
const DEBUG = new URLSearchParams(location.search).has('debug')

const bridge = await waitForEvenAppBridge()
const tracker = new HeadTracker()

// ── Page layout ──────────────────────────────────────────────────────
// zOrder omitted on purpose: declaration order stacks, event layer first.
const eventLayer = new TextContainerProperty({
  xPosition: 0, yPosition: 0, width: 576, height: 288,
  borderWidth: 0, borderColor: 0, paddingLength: 0,
  containerID: 1, containerName: 'eventLayer',
  content: ' ', isEventCapture: 1,
})
const header = new TextContainerProperty({
  xPosition: 0, yPosition: 0, width: 576, height: 30,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 2, containerName: 'header', content: '', isEventCapture: 0,
})
const gauge = new ImageContainerProperty({
  xPosition: 20, yPosition: 60, width: 220, height: 140,
  containerID: 3, containerName: 'gauge',
})
const side = new TextContainerProperty({
  xPosition: 262, yPosition: 52, width: 300, height: 160,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 4, containerName: 'side', content: '', isEventCapture: 0,
})
const footer = new TextContainerProperty({
  xPosition: 0, yPosition: 258, width: 576, height: 30,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 5, containerName: 'footer', content: '', isEventCapture: 0,
  textColor: 1, // dim: hints shouldn't compete with the exercise text
})
const dbg = new TextContainerProperty({
  xPosition: 262, yPosition: 196, width: 300, height: 60,
  borderWidth: 0, borderColor: 5, paddingLength: 2,
  containerID: 6, containerName: 'dbg', content: '', isEventCapture: 0,
  textColor: 1,
})

const texts = [eventLayer, header, side, footer, ...(DEBUG ? [dbg] : [])]
const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: texts.length + 1,
    textObject: texts,
    imageObject: [gauge],
  }),
)
if (created !== 0) {
  // HMR reload leaves a live page behind; take it over with a rebuild.
  const rebuilt = await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: texts.length + 1,
      textObject: texts,
      imageObject: [gauge],
    }),
  )
  if (!rebuilt) {
    console.error('page create/rebuild failed:', created, rebuilt)
    document.querySelector('#app')!.textContent = `page create failed: ${created}`
    throw new Error(`createStartUpPageContainer: ${created}`)
  }
  console.log('page recovered via rebuildPageContainer')
}

// ── Display helpers ──────────────────────────────────────────────────
const textCache = new Map<string, string>()
async function setText(name: 'header' | 'side' | 'footer' | 'dbg', content: string) {
  if (textCache.get(name) === content) return
  textCache.set(name, content)
  const id = { header: 2, side: 4, footer: 5, dbg: 6 }[name]
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({ containerID: id, containerName: name, content }),
  )
}

// Image sends are serialized; the SDK paces them at ~100ms internally.
let rendering: Promise<unknown> = Promise.resolve()
function pushGauge(u: number, v: number, target: { u: number; v: number } | undefined, progress: number) {
  rendering = rendering.then(async () => {
    const bytes = await renderGauge({
      u, v,
      target: target ? { ...target, r: TARGET_RADIUS } : undefined,
      progress,
      calibrated: tracker.calibrated,
    })
    const res = await bridge.updateImageRawData(
      new ImageRawDataUpdate({ containerID: 3, containerName: 'gauge', imageData: bytes }),
    )
    if (res !== 'success') console.error('updateImageRawData:', res)
  })
}

// ── State machine ────────────────────────────────────────────────────
type State = 'intro' | 'calibrating' | 'exercise' | 'finished'
let state: State = 'intro'
let step = 0
let heldMs = 0
let calibrateUntil = 0

function bar(frac: number): string {
  const n = Math.round(Math.max(0, Math.min(1, frac)) * 10)
  return `[${'#'.repeat(n)}${'-'.repeat(10 - n)}]`
}

function exercise(): Exercise {
  return ROUTINE[step]
}

function refreshStaticText() {
  if (state === 'intro') {
    setText('header', 'Neck Stretch')
    setText('side', '6 guided neck stretches.\nFollow the dot into the ring\nand hold.\n\nTap to start')
    setText('footer', 'tap start · hold temple recalibrate · 2tap exit')
  } else if (state === 'calibrating') {
    setText('header', `Neck Stretch · ${step + 1}/${ROUTINE.length}`)
    setText('side', 'Sit straight, look ahead.\nCalibrating…')
  } else if (state === 'exercise') {
    const ex = exercise()
    setText('header', `Neck Stretch · ${step + 1}/${ROUTINE.length}`)
    setText('side', `${ex.label}\n${ex.hint}`)
    setText('footer', 'tap skip · hold temple recalibrate · 2tap exit')
  } else {
    setText('header', 'Neck Stretch')
    setText('side', 'All done!\nNeck reset complete.\n\nTap to run again')
    setText('footer', 'tap restart · 2tap exit')
  }
}

function gaugePosition(): { u: number; v: number } {
  const ex = state === 'exercise' ? exercise() : undefined
  const lateral = ex && ex.measure !== 'pitch' ? ex.measure : 'yaw'
  return { u: tracker.axisValue(lateral as 'yaw' | 'roll'), v: tracker.axisValue('pitch') }
}

// ── IMU input ────────────────────────────────────────────────────────
if (!SIM) {
  const ok = await bridge.imuControl(true, ImuReportPace.P200)
  console.log('imuControl:', ok)
}

// Sim mode: pointer position over the webview is the head pose.
if (SIM) {
  window.addEventListener('pointermove', e => {
    const u = (e.clientX / window.innerWidth) * 2.4 - 1.2
    const v = -((e.clientY / window.innerHeight) * 2.4 - 1.2)
    tracker.feedSimulated(u, v, u)
  })
}

// ── Event handling (template pattern) ────────────────────────────────
function eventTypeOf(envelope?: { eventType?: OsEventTypeList }): OsEventTypeList | null {
  if (!envelope) return null
  return envelope.eventType ?? OsEventTypeList.CLICK_EVENT
}

let cleanedUp = false
function cleanup() {
  if (cleanedUp) return
  cleanedUp = true
  unsubscribe()
  if (!SIM) bridge.imuControl(false)
}

function onTap() {
  if (state === 'intro') {
    beginCalibration()
  } else if (state === 'exercise') {
    nextExercise()
  } else if (state === 'finished') {
    step = 0
    heldMs = 0
    state = 'intro'
    refreshStaticText()
  }
}

function beginCalibration() {
  tracker.calibrate() // instant in sim; on hardware re-sampled below
  calibrateUntil = Date.now() + (SIM ? 0 : 1200)
  state = 'calibrating'
  heldMs = 0
  refreshStaticText()
}

function nextExercise() {
  heldMs = 0
  if (step + 1 >= ROUTINE.length) {
    state = 'finished'
  } else {
    step++
    state = 'exercise'
  }
  refreshStaticText()
}

const unsubscribe = bridge.onEvenHubEvent(event => {
  const sys = event.sysEvent
  const sysType = eventTypeOf(sys)
  const textType = eventTypeOf(event.textEvent)

  if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT || textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    bridge.shutDownPageContainer(1)
    return
  }
  if (sysType === OsEventTypeList.SYSTEM_EXIT_EVENT || sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT) {
    cleanup()
    return
  }
  if (sysType === OsEventTypeList.LONG_PRESS_EVENT) {
    if (state === 'exercise') beginCalibration()
    return
  }
  if (sysType === OsEventTypeList.CLICK_EVENT || textType === OsEventTypeList.CLICK_EVENT) {
    onTap()
    return
  }
  if (sys?.eventType === OsEventTypeList.IMU_DATA_REPORT && sys.imuData) {
    tracker.feed(sys.imuData.x ?? 0, sys.imuData.y ?? 0, sys.imuData.z ?? 0)
  }
})

window.addEventListener('beforeunload', cleanup)

// ── Main loop ────────────────────────────────────────────────────────
refreshStaticText()
let lastTick = Date.now()

setInterval(() => {
  const now = Date.now()
  const dt = now - lastTick
  lastTick = now

  if (state === 'calibrating' && now >= calibrateUntil) {
    tracker.calibrate()
    state = 'exercise'
    refreshStaticText()
  }

  let progress = 0
  if (state === 'exercise') {
    const { u, v } = gaugePosition()
    const t = targetOf(exercise())
    const dist = Math.hypot(u - t.u, v - t.v)
    heldMs = dist <= TARGET_RADIUS ? heldMs + dt : Math.max(0, heldMs - dt * 2)
    progress = Math.min(1, heldMs / HOLD_MS)

    const ex = exercise()
    setText('side', `${ex.label}\n${ex.hint}\n\n${bar(progress)} ${Math.ceil((HOLD_MS - heldMs) / 1000)}s`)

    if (heldMs >= HOLD_MS) nextExercise()
  }

  if (!SIM && !DEBUG && tracker.samples === 0 && state !== 'intro') {
    setText('footer', 'no IMU data — check glasses connection')
  }

  const { u, v } = gaugePosition()
  const target = state === 'exercise' ? targetOf(exercise()) : undefined
  pushGauge(u, v, target, progress)

  if (DEBUG) setText('dbg', tracker.debugText())
}, 120)

// ── Companion webview ────────────────────────────────────────────────
document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main style="margin:auto;padding:24px;max-width:560px;text-align:center;">
    <h1 style="font-size:18px;font-weight:600;margin:0 0 8px;">Neck Stretch</h1>
    <p style="color:#919191;font-size:14px;margin:0 0 12px;">
      Wear the glasses and look at the display.${SIM
        ? ' <b style="color:#e5e5e5">SIM mode:</b> move your pointer here — it is the head dot.'
        : ''}
    </p>
    ${SIM ? '<p style="color:#6a6;font-size:13px;">Pointer X = turn/tilt · Pointer Y = look up/down</p>' : ''}
  </main>
`

console.log('[neck-stretch] ready', SIM ? '(sim)' : '')
