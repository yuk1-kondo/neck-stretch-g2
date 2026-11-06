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
import { ROUTINE, HOLD_MS, TARGET_RADIUS, FLASH_MS, targetOf, arrowOf, type Exercise } from './routine'
import { renderGauge, renderSideJa, renderSideTextJa } from './render'

const params = new URLSearchParams(location.search)
const SIM = params.has('sim')
const DEBUG = params.has('debug')
// Firmware font has no CJK glyphs — Japanese goes through the image pipeline.
const JA = (params.get('lang') ?? navigator.language).startsWith('ja')

const bridge = await waitForEvenAppBridge()
const tracker = new HeadTracker()

const S = {
  title: 'Neck Stretch',
  introLines: JA
    ? ['首ストレッチ 7種目', 'ドットをリングに', '合わせてキープ', '痛みがあれば中止', '', 'タップで開始']
    : ['7 guided neck stretches.', 'Follow the dot into the ring', 'and hold. Stop if it hurts.', '', 'Tap to start'],
  calibrating: JA ? 'まっすぐ向いて静止\n補正中…' : 'Sit straight, look ahead.\nCalibrating…',
  doneLines: JA ? ['完了!', '首リセット終了', '', 'タップでもう一度'] : ['All done!', 'Neck reset complete.', '', 'Tap to run again'],
  tapStart: 'tap start · hold temple recalibrate · 2tap exit',
  tapSkip: 'tap skip · hold temple recalibrate · 2tap exit',
  tapRestart: 'tap restart · 2tap exit',
  noImu: 'no IMU data — check glasses connection',
}

// ── Page layout (declaration order stacks; event layer first) ─────────
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
  xPosition: 12, yPosition: 56, width: 288, height: 144,
  containerID: 3, containerName: 'gauge',
})
// EN: text container for the side panel. JA: image container (CJK-safe).
const sideText = new TextContainerProperty({
  xPosition: 316, yPosition: 52, width: 256, height: 180,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 4, containerName: 'side', content: '', isEventCapture: 0,
})
const sideImage = new ImageContainerProperty({
  xPosition: 296, yPosition: 52, width: 272, height: 144,
  containerID: 5, containerName: 'sideImg',
})
const footer = new TextContainerProperty({
  xPosition: 0, yPosition: 258, width: 576, height: 30,
  borderWidth: 0, borderColor: 5, paddingLength: 4,
  containerID: 6, containerName: 'footer', content: '', isEventCapture: 0,
  textColor: 1,
})
const dbg = new TextContainerProperty({
  xPosition: 316, yPosition: 214, width: 256, height: 44,
  borderWidth: 0, borderColor: 5, paddingLength: 2,
  containerID: 7, containerName: 'dbg', content: '', isEventCapture: 0,
  textColor: 1,
})

const textObjects = [
  eventLayer,
  header,
  ...(JA ? [] : [sideText]),
  ...(JA ? [] : [footer]),
  ...(DEBUG ? [dbg] : []),
]
const imageObjects = [gauge, ...(JA ? [sideImage] : [])]

const created = await bridge.createStartUpPageContainer(
  new CreateStartUpPageContainer({
    containerTotalNum: textObjects.length + imageObjects.length,
    textObject: textObjects,
    imageObject: imageObjects,
  }),
)
if (created !== 0) {
  // HMR reload leaves a live page behind; take it over with a rebuild.
  const rebuilt = await bridge.rebuildPageContainer(
    new RebuildPageContainer({
      containerTotalNum: textObjects.length + imageObjects.length,
      textObject: textObjects,
      imageObject: imageObjects,
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
  const id = { header: 2, side: 4, footer: 6, dbg: 7 }[name]
  await bridge.textContainerUpgrade(
    new TextContainerUpgrade({ containerID: id, containerName: name, content }),
  )
}

// All image sends share one serialized queue (no concurrent sends).
let rendering: Promise<unknown> = Promise.resolve()
function pushImage(id: number, name: string, make: () => Promise<Uint8Array>) {
  rendering = rendering.then(async () => {
    const res = await bridge.updateImageRawData(
      new ImageRawDataUpdate({ containerID: id, containerName: name, imageData: await make() }),
    )
    if (res !== 'success') console.error('updateImageRawData:', name, res)
  })
}
function pushGauge(u: number, v: number, target: { u: number; v: number } | undefined, progress: number, flash: boolean) {
  pushImage(3, 'gauge', () =>
    renderGauge({ u, v, target: target ? { ...target, r: TARGET_RADIUS } : undefined, progress, calibrated: tracker.calibrated, flash }),
  )
}

// ── State machine ────────────────────────────────────────────────────
type State = 'intro' | 'calibrating' | 'exercise' | 'flash' | 'finished'
let state: State = 'intro'
let step = 0
let heldMs = 0
let calibrateUntil = 0
let flashUntil = 0

function bar(frac: number): string {
  const n = Math.round(Math.max(0, Math.min(1, frac)) * 10)
  return '█'.repeat(n) + '─'.repeat(10 - n)
}
function dots(): string {
  return '●'.repeat(state === 'finished' ? ROUTINE.length : step) + '○'.repeat(ROUTINE.length - (state === 'finished' ? ROUTINE.length : step))
}
function exercise(): Exercise {
  return ROUTINE[step]
}
function exLabel(ex: Exercise): string {
  return JA ? ex.labelJa : ex.label
}
function exHint(ex: Exercise): string {
  return JA ? ex.hintJa : ex.hint
}

function refreshStaticText() {
  setText('header', `${S.title}   ${dots()}`)
  if (JA) {
    // side image is rendered per-tick below; nothing else to push here
    return
  }
  if (state === 'intro') {
    setText('side', S.introLines.join('\n'))
    setText('footer', S.tapStart)
  } else if (state === 'calibrating') {
    setText('side', S.calibrating)
  } else if (state === 'exercise' || state === 'flash') {
    const ex = exercise()
    setText('side', `${arrowOf(ex)} ${ex.label}\n${ex.hint}`)
    setText('footer', S.tapSkip)
  } else {
    setText('side', S.doneLines.join('\n'))
    setText('footer', S.tapRestart)
  }
}

function gaugePosition(): { u: number; v: number } {
  const ex = state === 'exercise' || state === 'flash' ? exercise() : undefined
  const lateral = ex && ex.measure !== 'pitch' ? ex.measure : 'yaw'
  return { u: tracker.axisValue(lateral as 'yaw' | 'roll'), v: tracker.axisValue('pitch') }
}

// ── IMU input ────────────────────────────────────────────────────────
if (!SIM) {
  const ok = await bridge.imuControl(true, ImuReportPace.P200)
  console.log('imuControl:', ok)
}
if (SIM) {
  window.addEventListener('pointermove', e => {
    const u = (e.clientX / window.innerWidth) * 2.4 - 1.2
    const v = -((e.clientY / window.innerHeight) * 2.4 - 1.2)
    tracker.feedSimulated(u, v, u)
  })
}

// ── Event handling ───────────────────────────────────────────────────
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

function beginCalibration() {
  tracker.calibrate()
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

function onTap() {
  if (state === 'intro') beginCalibration()
  else if (state === 'exercise' || state === 'flash') nextExercise()
  else if (state === 'finished') {
    step = 0
    heldMs = 0
    state = 'intro'
    refreshStaticText()
  }
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
let lastSidePush = 0

setInterval(() => {
  const now = Date.now()
  const dt = now - lastTick
  lastTick = now

  if (state === 'calibrating' && now >= calibrateUntil) {
    tracker.calibrate()
    state = 'exercise'
    refreshStaticText()
  }
  if (state === 'flash' && now >= flashUntil) nextExercise()

  let progress = 0
  if (state === 'exercise') {
    const { u, v } = gaugePosition()
    const t = targetOf(exercise())
    const dist = Math.hypot(u - t.u, v - t.v)
    heldMs = dist <= TARGET_RADIUS ? heldMs + dt : Math.max(0, heldMs - dt * 2)
    progress = Math.min(1, heldMs / HOLD_MS)

    const secsLeft = Math.ceil((HOLD_MS - heldMs) / 1000)
    const ex = exercise()
    if (!JA) {
      setText('side', `${arrowOf(ex)} ${ex.label}\n${ex.hint}\n\n${bar(progress)} ${secsLeft}s`)
    }
    if (heldMs >= HOLD_MS) {
      state = 'flash'
      flashUntil = now + FLASH_MS
      refreshStaticText()
    }
  }

  if (!SIM && !DEBUG && tracker.samples === 0 && state !== 'intro') {
    setText('footer', S.noImu)
  }

  const { u, v } = gaugePosition()
  const target = state === 'exercise' || state === 'flash' ? targetOf(exercise()) : undefined
  pushGauge(u, v, target, progress, state === 'flash')

  // JA side image: throttle to ~3 fps; static states only on change.
  if (JA && now - lastSidePush > 350) {
    lastSidePush = now
    if (state === 'exercise' || state === 'flash') {
      const ex = exercise()
      const secsLeft = Math.ceil((HOLD_MS - heldMs) / 1000)
      pushImage(5, 'sideImg', () =>
        renderSideJa({
          title: exLabel(ex),
          hint: exHint(ex),
          arrow: arrowOf(ex),
          progress,
          secondsLeft: secsLeft,
          flash: state === 'flash',
        }),
      )
    } else {
      const lines =
        state === 'intro'
          ? S.introLines.map(t => ({ text: t }))
          : state === 'calibrating'
            ? S.calibrating.split('\n').map(t => ({ text: t }))
            : S.doneLines.map(t => ({ text: t }))
      pushImage(5, 'sideImg', () => renderSideTextJa(lines))
    }
  }

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
    <p style="color:#555;font-size:12px;">lang: ${JA ? 'ja' : 'en'} (override with ?lang=ja / ?lang=en)</p>
  </main>
`

console.log('[neck-stretch] ready', SIM ? '(sim)' : '', JA ? '(ja)' : '(en)')
