# Neck Stretch

Guided neck-stretch coach for Even G2. The IMU tracks head pose: a dot on
the glasses display mirrors your head — steer it into the target ring and
hold 5 s per exercise. 6 exercises (up, down, tilt L/R, turn L/R).

| Intro | Exercise |
|---|---|
| ![intro](docs/screenshot-intro.png) | ![exercise](docs/screenshot-exercise.png) |

Rendered on the Even Hub simulator (no hardware required for layout/logic).

## Run

```bash
npm install
npm run dev
```

Then either:
- **Simulator:** `evenhub-simulator "http://localhost:5173?sim=1&debug=1"`
  - `?sim=1` — pointer position in the webview drives the head dot
    (the simulator does not emulate the IMU)
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
- `RANGE` — how much motion counts as "at target"

## Pack for distribution

```bash
npm run pack   # build + .ehpk
```

## Files

| File | Purpose |
|---|---|
| `src/main.ts` | State machine, page layout, event routing |
| `src/tracker.ts` | IMU smoothing + baseline + axis mapping |
| `src/routine.ts` | Exercise list and gauge targets |
| `src/render.ts` | Gauge canvas → PNG for `updateImageRawData` |
| `app.json` | Manifest (`com.yukik.neckstretch`) |
