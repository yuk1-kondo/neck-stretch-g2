// Stretch routine: each exercise points the gauge dot at a target zone.
// `measure` is which head axis the exercise works; `dir` is +1 / -1 along it.

import type { AXES } from './tracker'

export interface Exercise {
  id: string
  label: string
  hint: string
  measure: keyof typeof AXES
  /** +1 or -1: which way the head must travel. */
  dir: 1 | -1
}

export const HOLD_MS = 5000
export const TARGET_RADIUS = 0.45 // gauge units; dot within this of target counts

export const ROUTINE: Exercise[] = [
  { id: 'up', label: 'LOOK UP', hint: 'Chin to ceiling', measure: 'pitch', dir: 1 },
  { id: 'down', label: 'LOOK DOWN', hint: 'Chin to chest', measure: 'pitch', dir: -1 },
  { id: 'tilt_r', label: 'TILT RIGHT', hint: 'Right ear to shoulder', measure: 'roll', dir: 1 },
  { id: 'tilt_l', label: 'TILT LEFT', hint: 'Left ear to shoulder', measure: 'roll', dir: -1 },
  { id: 'turn_r', label: 'TURN RIGHT', hint: 'Chin over right shoulder', measure: 'yaw', dir: 1 },
  { id: 'turn_l', label: 'TURN LEFT', hint: 'Chin over left shoulder', measure: 'yaw', dir: -1 },
]

// Gauge target position per exercise: pitch drives vertical, everything
// else drives horizontal so the target always sits on an axis end.
export function targetOf(ex: Exercise): { u: number; v: number } {
  if (ex.measure === 'pitch') return { u: 0, v: ex.dir }
  return { u: ex.dir, v: 0 }
}
