// Head orientation tracker.
//
// The G2 streams IMU samples as {x, y, z} doubles via
// `sysEvent.imuData` at `eventType === IMU_DATA_REPORT`. The docs don't
// pin down the units — on hardware this may be an attitude vector or a
// gyro rate — so the tracker keeps two position models:
//
//   'attitude'  -> orientation IS the (smoothed) vector minus baseline
//   'gyro'      -> orientation integrates the vector minus baseline
//
// Pick with MODE below after checking `debugText()` output on device:
// values that hold steady while you hold a pose => 'attitude';
// values that snap back to ~0 when you stop moving => 'gyro'.
//
// Axis roles are configurable for the same reason. Fill them in from
// the debug line: nod your head and watch which component swings.

export type Vec3 = { x: number; y: number; z: number }
export type Axis = 'x' | 'y' | 'z'

export const MODE: 'attitude' | 'gyro' = 'attitude'

// Which raw component drives each head motion, and the sign that makes
// "positive" mean "in the exercise direction". Tune on hardware.
export const AXES = {
  pitch: { axis: 'z' as Axis, sign: 1 }, // nod: look up/down
  yaw: { axis: 'x' as Axis, sign: 1 },   // turn: look left/right
  roll: { axis: 'y' as Axis, sign: 1 },  // tilt: ear to shoulder
}

// How far the head must move before the gauge counts it as "in target".
// In attitude mode this is a delta in whatever unit the IMU emits;
// in gyro mode it's integrated degrees-ish. Tune on hardware.
export const RANGE = 0.35

const EMA_ALPHA = 0.3
const GYRO_LEAK = 0.92 // per-sample decay so integrated gyro doesn't drift

export class HeadTracker {
  private smooth: Vec3 = { x: 0, y: 0, z: 0 }
  private baseline: Vec3 | null = null
  private pos: Vec3 = { x: 0, y: 0, z: 0 }
  private primed = false
  raw: Vec3 = { x: 0, y: 0, z: 0 }
  samples = 0

  feed(x: number, y: number, z: number) {
    this.raw = { x, y, z }
    this.samples++
    if (!this.primed) {
      this.smooth = { x, y, z }
      this.primed = true
    } else {
      this.smooth.x += (x - this.smooth.x) * EMA_ALPHA
      this.smooth.y += (y - this.smooth.y) * EMA_ALPHA
      this.smooth.z += (z - this.smooth.z) * EMA_ALPHA
    }
    if (MODE === 'gyro' && this.baseline) {
      this.pos.x = (this.pos.x + this.smooth.x - this.baseline.x) * GYRO_LEAK
      this.pos.y = (this.pos.y + this.smooth.y - this.baseline.y) * GYRO_LEAK
      this.pos.z = (this.pos.z + this.smooth.z - this.baseline.z) * GYRO_LEAK
    }
  }

  /** Snapshot the current smoothed vector as the neutral pose. */
  calibrate() {
    this.baseline = { ...this.smooth }
    this.pos = { x: 0, y: 0, z: 0 }
  }

  get calibrated() {
    return this.baseline !== null
  }

  /** Current offset from neutral, in raw units. */
  private delta(): Vec3 {
    const b = this.baseline ?? { x: 0, y: 0, z: 0 }
    if (MODE === 'gyro') return this.pos
    return {
      x: this.smooth.x - b.x,
      y: this.smooth.y - b.y,
      z: this.smooth.z - b.z,
    }
  }

  /** Signed amount of motion along one named axis, normalized to RANGE. */
  axisValue(kind: keyof typeof AXES): number {
    const { axis, sign } = AXES[kind]
    return (this.delta()[axis] * sign) / RANGE
  }

  /** Inject a synthetic pose (dev/sim mode). Values are already deltas. */
  feedSimulated(u: number, v: number, roll = 0) {
    const d: Vec3 = { x: 0, y: 0, z: 0 }
    d[AXES.yaw.axis] = u * RANGE * AXES.yaw.sign
    d[AXES.pitch.axis] = v * RANGE * AXES.pitch.sign
    d[AXES.roll.axis] = roll * RANGE * AXES.roll.sign
    const base = this.baseline ?? { x: 0, y: 0, z: 0 }
    this.feed(base.x + d.x, base.y + d.y, base.z + d.z)
  }

  debugText(): string {
    const r = this.raw
    const d = this.delta()
    return (
      `raw ${r.x.toFixed(2)} ${r.y.toFixed(2)} ${r.z.toFixed(2)}\n` +
      `dlt ${d.x.toFixed(2)} ${d.y.toFixed(2)} ${d.z.toFixed(2)}`
    )
  }
}
