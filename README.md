# Neck Stretch

Guided neck-stretch coach for Even G2. The IMU tracks head pose: a dot on
the glasses display mirrors your head — steer it into the target ring and
hold. 7 exercises: look up/down, tilt L/R, turn L/R, and a chin-tuck
finisher (the highest-evidence drill for forward-head posture).

English & Japanese UI — Japanese is rasterized through the image
pipeline because the firmware font has no CJK glyphs.

| EN intro | EN exercise | JA exercise |
|---|---|---|
| ![intro](docs/screenshot-intro.png) | ![exercise](docs/screenshot-exercise.png) | ![exercise-ja](docs/screenshot-exercise-ja.png) |

Rendered on the Even Hub simulator (no hardware required for layout/logic).

## Stretch parameters (evidence-based)

- **15 s holds** — the PT/ACSM consensus for static stretching is 15–30 s
- **Gentle targets** — ~60–70% of comfortable ROM, not end range
- **Chin tuck finisher** — hold still at center; the most-cited corrective
  drill for tech neck (verified as "no rotation" since the IMU can't
  see translation)

## Run

```bash
npm install
npm run dev
```

Then either:
- **Simulator:** `evenhub-simulator "http://localhost:5173?sim=1"`
  - `?sim=1` — pointer position in the webview drives the head dot
    (the simulator does not emulate the IMU)
  - `?lang=ja` / `?lang=en` — force UI language (default: browser locale)
  - `?debug=1` — shows raw/delta IMU values on the glasses screen
- **Real glasses:** `npx evenhub qr --url http://<your-ip>:5173?debug=1`
  and scan with the Even Hub companion app.

## Controls

| Input | Action |
|---|---|
| tap | start / skip exercise / restart |
| long press | recalibrate neutral pose |
| double tap | exit (system dialog) |

## Tuning the IMU mapping (on hardware)

`imuData.x/y/z` units and axes are not documented — open the app with
`?debug=1` on the glasses, do each motion, and watch which component
swings. Then adjust in `src/tracker.ts`:

- `AXES` — which raw component is pitch / yaw / roll, and its sign
- `MODE` — `'attitude'` if values hold while you hold a pose,
  `'gyro'` if they snap back to ~0 when you stop
- `RANGE` — how much motion counts as "at target" (aim for ~30–40°
  deflection at the ring edge)

## Pack for distribution

```bash
npm run pack   # build + .ehpk
```

## Files

| File | Purpose |
|---|---|
| `src/main.ts` | State machine, page layout, event routing, EN/JA switching |
| `src/tracker.ts` | IMU smoothing + baseline + axis mapping |
| `src/routine.ts` | Exercise list, targets, hold parameters |
| `src/render.ts` | Gauge + Japanese panels → PNG for `updateImageRawData` |
| `app.json` | Manifest (`com.yukik.neckstretch`) |
| `PITCH.md` | ERDN pitch notes |
