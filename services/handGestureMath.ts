/**
 * Small, dependency-free helpers shared by the hand-input pipeline and its
 * deterministic tests.  Keeping these formulas outside React components
 * makes the sampling-rate and gesture timing contracts explicit.
 */

/** Exponential filter coefficient for a time constant in milliseconds. */
export const exponentialSmoothingAlpha = (
  elapsedMs: number,
  timeConstantMs: number,
): number => (
  1 - Math.exp(-Math.max(0, elapsedMs) / Math.max(0.001, timeConstantMs))
);

/** Convert a displacement measured over a sample interval to units/second. */
export const normalizeRatePerSecond = (delta: number, elapsedMs: number): number => (
  delta * 1000 / Math.max(1, elapsedMs)
);

/** Remove low-rate sensor noise without making the threshold sample-rate dependent. */
export const applyRateDeadzone = (rate: number, thresholdPerSecond: number): number => (
  Math.abs(rate) > Math.max(0, thresholdPerSecond) ? rate : 0
);

/** Exponentially decay a previously valid rate while a gesture is briefly uncertain. */
export const decayRate = (
  rate: number,
  elapsedMs: number,
  timeConstantMs: number,
): number => (
  rate * Math.exp(-Math.max(0, elapsedMs) / Math.max(0.001, timeConstantMs))
);

export interface RotationContinuityState {
  active: boolean;
  lastValidAtMs: number;
  consecutiveMisses: number;
}

export type RotationContinuityPhase = 'inactive' | 'active' | 'grace' | 'released';

export interface RotationContinuityUpdate {
  state: RotationContinuityState;
  phase: RotationContinuityPhase;
}

export const createRotationContinuityState = (): RotationContinuityState => ({
  active: false,
  lastValidAtMs: 0,
  consecutiveMisses: 0,
});

/**
 * Keep a recognized rotation alive through one noisy pose sample. A second
 * consecutive miss, an expired grace window, or a backwards clock releases it.
 */
export const advanceRotationContinuity = (
  state: RotationContinuityState,
  detected: boolean,
  nowMs: number,
  graceMs: number,
  releaseAfterMisses: number,
): RotationContinuityUpdate => {
  if (detected) {
    return {
      state: {
        active: true,
        lastValidAtMs: nowMs,
        consecutiveMisses: 0,
      },
      phase: 'active',
    };
  }

  if (!state.active) {
    return { state: createRotationContinuityState(), phase: 'inactive' };
  }

  const consecutiveMisses = state.consecutiveMisses + 1;
  const elapsedMs = nowMs - state.lastValidAtMs;
  const withinGrace = Number.isFinite(elapsedMs)
    && elapsedMs >= 0
    && elapsedMs <= Math.max(0, graceMs);
  if (withinGrace && consecutiveMisses < Math.max(1, releaseAfterMisses)) {
    return {
      state: {
        active: true,
        lastValidAtMs: state.lastValidAtMs,
        consecutiveMisses,
      },
      phase: 'grace',
    };
  }

  return { state: createRotationContinuityState(), phase: 'released' };
};

/**
 * Schmitt trigger for distance-like gestures: enter below `enterThreshold`,
 * then remain active until the looser `exitThreshold` is crossed.
 */
export const hysteresisBelow = (
  value: number,
  active: boolean,
  enterThreshold: number,
  exitThreshold: number,
): boolean => value < (active ? exitThreshold : enterThreshold);

/** Return whether a recently active pinch may remain alive during a gap. */
export const isWithinGracePeriod = (
  nowMs: number,
  lastActiveAtMs: number,
  graceMs: number,
): boolean => (
  Number.isFinite(lastActiveAtMs)
  && Number.isFinite(nowMs)
  && nowMs >= lastActiveAtMs
  && nowMs - lastActiveAtMs <= Math.max(0, graceMs)
);
