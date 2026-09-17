import assert from 'node:assert/strict';
import test from 'node:test';
import {
  describeHandCandidate,
  HandTargetTracker,
  type LandmarkLike,
} from './handTargetTracker.ts';
import {
  advanceRotationContinuity,
  applyRateDeadzone,
  clampRate,
  createRotationContinuityState,
  decayRate,
  hysteresisBelow,
  isWithinGracePeriod,
  normalizeRatePerSecond,
  smoothRateTowardsTarget,
} from './handGestureMath.ts';

// A compact, deterministic hand-like landmark shape. The absolute geometry is
// not important here; using the same normalized shape lets the tests focus on
// tracker timing, matching, and loss handling.
const RELATIVE_POINTS: Array<[number, number]> = [
  [0, 0], [0.05, -0.08], [0.02, -0.15], [-0.02, -0.21], [-0.04, -0.27],
  [0.08, -0.06], [0.12, -0.13], [0.14, -0.2], [0.15, -0.27],
  [0.02, -0.08], [0.03, -0.17], [0.04, -0.26], [0.04, -0.34],
  [-0.05, -0.06], [-0.08, -0.14], [-0.1, -0.22], [-0.1, -0.29],
  [-0.12, -0.03], [-0.17, -0.1], [-0.19, -0.18], [-0.19, -0.25],
];

const landmarksAt = (x: number, y = 0.5, scale = 1): LandmarkLike[] => (
  RELATIVE_POINTS.map(([dx, dy]) => ({ x: x + dx * scale, y: y + dy * scale, z: 0 }))
);

const candidateAt = (side: 'Left' | 'Right', x: number, y = 0.5, scale = 1) => {
  const candidate = describeHandCandidate(landmarksAt(x, y, scale), side, 0.95);
  assert.ok(candidate, 'fixture must produce a valid hand candidate');
  return candidate;
};

test('rejects incomplete landmarks before tracker state is created', () => {
  assert.equal(describeHandCandidate(landmarksAt(0.3).slice(0, 20), 'Left'), null);
});

test('locks a stable dual-hand pair after the configured confirmation interval', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 100 });
  const pair = [candidateAt('Left', 0.3), candidateAt('Right', 0.7)];

  let result = tracker.update(pair, 0, 'dual');
  assert.equal(result.phase, 'confirming');
  assert.equal(result.controlEnabled, false);

  result = tracker.update(pair, 99, 'dual');
  assert.equal(result.phase, 'confirming');
  assert.equal(result.controlEnabled, false);

  result = tracker.update(pair, 100, 'dual');
  assert.equal(result.phase, 'locked');
  assert.equal(result.controlEnabled, true);
  assert.equal(result.active.left?.side, 'Left');
  assert.equal(result.active.right?.side, 'Right');
});

test('supports single-hand lock and ignores a second hand for control selection', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 80 });
  const primary = candidateAt('Right', 0.55);
  const distractor = candidateAt('Left', 0.2, 0.8);

  assert.equal(tracker.update([primary, distractor], 0, 'single').phase, 'confirming');
  const result = tracker.update([primary, distractor], 80, 'single');
  assert.equal(result.phase, 'locked');
  assert.equal(result.controlEnabled, true);
  assert.equal(result.active.right?.side, 'Right');
  assert.equal(result.active.left, null);
});

test('keeps a matching hand through a long sample gap using velocity prediction', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 0 });
  const first = candidateAt('Left', 0.25);
  const second = candidateAt('Left', 0.30);
  const predictedAt170 = candidateAt('Left', 0.42); // 0.05 / 50ms * 120ms

  // The first update enters confirmation; the next update observes the zero
  // interval and locks. A subsequent 50ms movement establishes track velocity.
  assert.equal(tracker.update([first], 0, 'single').phase, 'confirming');
  assert.equal(tracker.update([first], 0, 'single').phase, 'locked');
  assert.equal(tracker.update([second], 50, 'single').phase, 'locked');

  const result = tracker.update([predictedAt170], 170, 'single');
  assert.equal(result.phase, 'locked');
  assert.equal(result.controlEnabled, true);
  assert.ok(result.active.left);
});

test('reports partial loss, keeps a short stale prediction, then enters cooldown', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 0, releaseMs: 1200, cooldownMs: 300 });
  const pair = [candidateAt('Left', 0.3), candidateAt('Right', 0.7)];
  assert.equal(tracker.update(pair, 0, 'dual').phase, 'confirming');
  assert.equal(tracker.update(pair, 0, 'dual').phase, 'locked');

  let result = tracker.update([pair[0]], 100, 'dual');
  assert.equal(result.phase, 'partial_lost');
  assert.equal(result.controlEnabled, true);
  assert.equal(result.active.left?.side, 'Left');
  assert.equal(result.active.right?.stale, true);

  result = tracker.update([], 200, 'dual');
  assert.equal(result.phase, 'lost');
  assert.equal(result.controlEnabled, true);
  assert.equal(result.active.left?.stale, true);
  assert.equal(result.active.right, null);

  // Once the 120ms prediction horizon expires, no stale pose can drive the
  // model and the tracker transitions to cooldown immediately.
  result = tracker.update([], 221, 'dual');
  assert.equal(result.phase, 'cooldown');
  assert.equal(result.controlEnabled, false);

  result = tracker.update([], 520, 'dual');
  assert.equal(result.phase, 'cooldown');
  result = tracker.update([], 521, 'dual');
  assert.equal(result.phase, 'searching');
});

test('normalizes equivalent motion to the same units-per-second rate at 15/20/30Hz', () => {
  const expectedRate = 0.42;
  for (const hz of [15, 20, 30]) {
    const elapsedMs = 1000 / hz;
    const sampleDelta = expectedRate * elapsedMs / 1000;
    const actualRate = normalizeRatePerSecond(sampleDelta, elapsedMs);
    assert.ok(Math.abs(actualRate - expectedRate) < 1e-12, `${hz}Hz produced ${actualRate}`);
  }
});

test('keeps two-finger rotation active through one noisy pose sample', () => {
  let continuity = advanceRotationContinuity(
    createRotationContinuityState(),
    true,
    1000,
    120,
    2,
  );
  assert.equal(continuity.phase, 'active');

  continuity = advanceRotationContinuity(continuity.state, false, 1033, 120, 2);
  assert.equal(continuity.phase, 'grace');
  assert.equal(continuity.state.active, true);
  assert.equal(continuity.state.lastValidAtMs, 1000);
  assert.equal(continuity.state.consecutiveMisses, 1);

  continuity = advanceRotationContinuity(continuity.state, true, 1066, 120, 2);
  assert.equal(continuity.phase, 'active');
  assert.equal(continuity.state.active, true);
  assert.equal(continuity.state.lastValidAtMs, 1066);
  assert.equal(continuity.state.consecutiveMisses, 0);
});

test('releases two-finger rotation after two misses or the 120ms grace timeout', () => {
  const active = advanceRotationContinuity(
    createRotationContinuityState(),
    true,
    1000,
    120,
    2,
  );
  const firstMiss = advanceRotationContinuity(active.state, false, 1033, 120, 2);
  assert.equal(firstMiss.phase, 'grace');
  const secondMiss = advanceRotationContinuity(firstMiss.state, false, 1066, 120, 2);
  assert.equal(secondMiss.phase, 'released');
  assert.equal(secondMiss.state.active, false);

  const timedOut = advanceRotationContinuity(active.state, false, 1120.1, 120, 2);
  assert.equal(timedOut.phase, 'released');
  assert.equal(timedOut.state.active, false);
});

test('rotation grace velocity decays smoothly and never reverses direction', () => {
  const initialRate = -4;
  const samples = [0, 33, 66, 120].map((elapsedMs) => (
    decayRate(initialRate, elapsedMs, 90)
  ));

  assert.equal(samples[0], initialRate);
  for (let index = 1; index < samples.length; index += 1) {
    assert.ok(Math.abs(samples[index]) < Math.abs(samples[index - 1]));
    assert.ok(samples[index] < 0);
  }
});

test('clamps a fast rotation sample before it can create a speed spike', () => {
  assert.equal(clampRate(12, 3.8), 3.8);
  assert.equal(clampRate(-12, 3.8), -3.8);
  assert.equal(clampRate(Number.NaN, 3.8), 0);
});

test('limits rotation acceleration by elapsed time across different sample gaps', () => {
  const options = [15, 30, 60].map((hz) => {
    const elapsedMs = 1000 / hz;
    let rate = 0;
    for (let sample = 0; sample < hz; sample += 1) {
      const next = smoothRateTowardsTarget(rate, 3.8, elapsedMs, 3.8, 30, 42);
      assert.ok(Math.abs(next - rate) <= 30 * elapsedMs / 1000 + 1e-9);
      rate = next;
    }
    return rate;
  });
  for (const value of options) {
    assert.ok(value > 0);
    assert.ok(value <= 3.8 + 1e-9);
  }
  assert.ok(Math.max(...options) - Math.min(...options) < 0.08);
});

test('passes through zero before a fast direction reversal', () => {
  const first = smoothRateTowardsTarget(2, -3.8, 33, 3.8, 30, 42);
  assert.ok(first >= 0);
  const second = smoothRateTowardsTarget(first, -3.8, 33, 3.8, 30, 42);
  assert.ok(second >= 0);
  const settled = smoothRateTowardsTarget(0, -3.8, 33, 3.8, 30, 42);
  assert.ok(settled < 0);
});

test('smoothly settles rotation to zero without residual inertia', () => {
  let rate = 3.8;
  let previousMagnitude = Math.abs(rate);
  for (let elapsed = 0; elapsed < 250; elapsed += 1000 / 30) {
    rate = smoothRateTowardsTarget(rate, 0, 1000 / 30, 3.8, 30, 42);
    const magnitude = Math.abs(rate);
    assert.ok(magnitude <= previousMagnitude + 1e-9);
    previousMagnitude = magnitude;
  }
  assert.ok(Math.abs(rate) < 0.05, `rotation did not settle: ${rate}`);
});

test('rate deadzone and integrated rotation are invariant at 15/20/30Hz', () => {
  const deadzonePerSecond = 0.0015 * 1000 / 33;
  const trajectoryRate = 0.18;
  const finalRotations = [15, 20, 30].map((hz) => {
    const elapsedMs = 1000 / hz;
    let rotation = 0;
    for (let sample = 0; sample < hz; sample += 1) {
      const displacement = trajectoryRate * elapsedMs / 1000;
      const rate = applyRateDeadzone(
        normalizeRatePerSecond(displacement, elapsedMs),
        deadzonePerSecond,
      );
      rotation += rate * elapsedMs / 1000;
    }
    return rotation;
  });

  const minRotation = Math.min(...finalRotations);
  const maxRotation = Math.max(...finalRotations);
  assert.ok((maxRotation - minRotation) / maxRotation < 0.05);

  for (const hz of [15, 20, 30]) {
    const elapsedMs = 1000 / hz;
    const belowThresholdDisplacement = 0.04 * elapsedMs / 1000;
    assert.equal(
      applyRateDeadzone(
        normalizeRatePerSecond(belowThresholdDisplacement, elapsedMs),
        deadzonePerSecond,
      ),
      0,
    );
  }
});

test('keeps a locked hand active across one to three missed inference frames', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 0 });
  const first = candidateAt('Left', 0.25);
  const moved = candidateAt('Left', 0.28);
  assert.equal(tracker.update([first], 0, 'single').phase, 'confirming');
  assert.equal(tracker.update([first], 0, 'single').phase, 'locked');
  assert.equal(tracker.update([moved], 33, 'single').phase, 'locked');

  for (const now of [66, 99, 132]) {
    const result = tracker.update([], now, 'single');
    assert.equal(result.phase, 'lost');
    assert.equal(result.controlEnabled, true);
    assert.equal(result.active.left?.stale, true);
    assert.ok((result.active.left?.ageMs ?? 0) <= 120);
  }

  const expired = tracker.update([], 154, 'single');
  assert.equal(expired.phase, 'cooldown');
  assert.equal(expired.controlEnabled, false);
});

test('keeps pinch active through the enter/exit hysteresis band', () => {
  let active = false;
  active = hysteresisBelow(0.41, active, 0.42, 0.62);
  assert.equal(active, true, 'ratio below enter threshold should activate');
  active = hysteresisBelow(0.50, active, 0.42, 0.62);
  assert.equal(active, true, 'ratio in the hysteresis band should remain active');
  active = hysteresisBelow(0.63, active, 0.42, 0.62);
  assert.equal(active, false, 'ratio above exit threshold should release');
  active = hysteresisBelow(0.50, active, 0.42, 0.62);
  assert.equal(active, false, 'band value should not re-enter without crossing enter threshold');
});

test('allows a 150ms pinch release grace but not a longer gap or backwards clock', () => {
  assert.equal(isWithinGracePeriod(1000, 850, 150), true);
  assert.equal(isWithinGracePeriod(1000, 849.9, 150), false);
  assert.equal(isWithinGracePeriod(999, 1000, 150), false);
});

test('a single handedness flip stays in the locked slot and recovers on the next frame', () => {
  const tracker = new HandTargetTracker({ confirmationMs: 0 });
  const left = candidateAt('Left', 0.34);
  assert.equal(tracker.update([left], 0, 'single').phase, 'confirming');
  assert.equal(tracker.update([left], 0, 'single').phase, 'locked');

  const flipped = candidateAt('Right', 0.345);
  let result = tracker.update([flipped], 33, 'single');
  assert.equal(result.phase, 'locked');
  assert.equal(result.active.left?.side, 'Left');
  assert.equal(result.active.right, null);

  result = tracker.update([candidateAt('Left', 0.35)], 66, 'single');
  assert.equal(result.active.left?.side, 'Left');
  assert.equal(result.active.right, null);
});
