// Stretch routine: each exercise points the gauge dot at a target zone.
// `measure` is which head axis the exercise works; `dir` is +1 / -1 along it.
//
// Parameters follow standard static-stretch guidance:
// - 15 s holds (PT consensus is 15–30 s; 5 s is too short to matter)
// - targets sit at a gentle 60–70% of comfortable ROM, not end range
// - a chin-tuck finisher (hold still at center): the highest-evidence
//   drill for forward-head posture. The IMU can't see translation, so
//   it's verified as "no rotation, stay centered".

import type { AXES } from './tracker'

export interface Exercise {
  id: string
  label: string
  hint: string
  labelJa: string
  hintJa: string
  measure: keyof typeof AXES
  /** +1 or -1: which way the head must travel. */
  dir: 1 | -1
}

export const HOLD_MS = 15000
export const TARGET_RADIUS = 0.45 // gauge units; dot within this of target counts
export const FLASH_MS = 900 // "cleared" flash before advancing

export const ROUTINE: Exercise[] = [
  { id: 'up', label: 'LOOK UP', hint: 'Chin to ceiling', labelJa: '上を向く', hintJa: 'あごを天井へ', measure: 'pitch', dir: 1 },
  { id: 'down', label: 'LOOK DOWN', hint: 'Chin to chest', labelJa: '下を向く', hintJa: 'あごを胸へ', measure: 'pitch', dir: -1 },
  { id: 'tilt_r', label: 'TILT RIGHT', hint: 'Right ear to shoulder', labelJa: '右に傾ける', hintJa: '右耳を右肩へ', measure: 'roll', dir: 1 },
  { id: 'tilt_l', label: 'TILT LEFT', hint: 'Left ear to shoulder', labelJa: '左に傾ける', hintJa: '左耳を左肩へ', measure: 'roll', dir: -1 },
  { id: 'turn_r', label: 'TURN RIGHT', hint: 'Chin over right shoulder', labelJa: '右を向く', hintJa: '顎を右肩の上へ', measure: 'yaw', dir: 1 },
  { id: 'turn_l', label: 'TURN LEFT', hint: 'Chin over left shoulder', labelJa: '左を向く', hintJa: '顎を左肩の上へ', measure: 'yaw', dir: -1 },
  { id: 'tuck', label: 'CHIN TUCK', hint: 'Pull chin back, hold still', labelJa: 'あごを引く', hintJa: '顎を引いて静止', measure: 'yaw', dir: 1 },
]

// Gauge target per exercise: pitch drives vertical, other axes drive
// horizontal. The chin tuck's target is the center (hold still).
export function targetOf(ex: Exercise): { u: number; v: number } {
  if (ex.id === 'tuck') return { u: 0, v: 0 }
  if (ex.measure === 'pitch') return { u: 0, v: ex.dir }
  return { u: ex.dir, v: 0 }
}

// Direction arrow toward the target (officially supported glyphs).
export function arrowOf(ex: Exercise): string {
  if (ex.id === 'tuck') return '●'
  if (ex.measure === 'pitch') return ex.dir > 0 ? '▲' : '▼'
  return ex.dir > 0 ? '▶' : '◀'
}
