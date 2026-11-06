# Neck Stretch — guided neck-stretch coach for Even G2

## The problem
"Tech neck" is the most on-brand problem smart glasses could solve —
and one of the least explored. Desk workers spend hours with their heads
tilted forward; the fix is short, regular neck stretches, but nobody
remembers to do them and phone apps demand you look down at a screen.

## The project
Neck Stretch guides the wearer through six neck exercises — look up,
look down, tilt left/right ear to shoulder, turn left/right — directly
on the G2 display. The built-in IMU tracks head pose in real time: a
dot on the display mirrors the user's head, and they steer it into a
target ring and hold. No phone screen, no hands — the stretch happens
in the glasses.

- Tap: start / skip an exercise
- Long press: recalibrate the neutral pose (SDK 0.0.14+ long-press pair)
- Double tap: system exit dialog (QA-compliant)

## Why it matters for Even Hub
IMU-based head tracking is almost untouched in the current catalogue —
the ecosystem is rich in readers, AI assistants and media apps, but
head-motion interaction is demonstrated by only a couple of projects.
Neck Stretch proves the IMU can drive a genuinely glanceable,
embodied interaction, and it fits Quiet Tech: health value with zero
screen-time cost. The same head-tracking core generalises to posture
reminders, hands-free UI, and motion games — patterns I intend to
document and share back with the community.

## Current status
A working prototype already exists. Built on the official SDK
(0.0.16): state machine, IMU tracker with EMA smoothing and
calibration, a canvas-rendered position gauge pushed via
updateImageRawData, and full input handling — all verified end-to-end
on the Even Hub simulator (intro → calibrate → 6 exercises →
completion → exit dialog). What remains is exactly what requires
hardware: validating the IMU axis mapping and tuning thresholds for
how stretches actually feel on the head.

## 120-day plan
- Weeks 1–2: on-device IMU validation, axis mapping, threshold tuning
- Weeks 3–6: UX polish (hold feedback, session pacing), EN/JA copy
- Weeks 7–10: private + beta testing, accessibility pass
- Weeks 11–16: store submission via Even Hub review

## Applicant
Independent developer based in Japan, building for the G2 in my spare
time. Already shipping-quality on the simulator; hardware is the last
gap between prototype and a store listing that showcases a new
interaction category for the platform.
