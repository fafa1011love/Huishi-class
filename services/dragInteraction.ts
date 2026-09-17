export interface DragGestureSessionState {
  pinchActive: boolean;
  selectionAttempted: boolean;
  rearmRequired: boolean;
}

export interface DragGestureSessionInput {
  handVisible: boolean;
  pinchActive: boolean;
  rotationActive: boolean;
}

export interface DragGestureSessionUpdate {
  state: DragGestureSessionState;
  shouldAttemptSelection: boolean;
  shouldRelease: boolean;
}

export const createDragGestureSessionState = (pinchActive = false): DragGestureSessionState => ({
  pinchActive,
  selectionAttempted: pinchActive,
  rearmRequired: false,
});

/**
 * Give every explicit pinch exactly one selection attempt. Explicit release
 * ends the grab immediately; missing hand data is left to the caller's short
 * tracking grace. A rotation interruption requires a real release before the
 * next part can be selected.
 */
export const advanceDragGestureSession = (
  state: DragGestureSessionState,
  input: DragGestureSessionInput,
): DragGestureSessionUpdate => {
  if (!input.handVisible && input.pinchActive) {
    return { state, shouldAttemptSelection: false, shouldRelease: false };
  }

  if (input.rotationActive) {
    return {
      state: {
        pinchActive: false,
        selectionAttempted: true,
        rearmRequired: true,
      },
      shouldAttemptSelection: false,
      shouldRelease: true,
    };
  }

  if (!input.pinchActive) {
    return {
      state: createDragGestureSessionState(),
      shouldAttemptSelection: false,
      shouldRelease: true,
    };
  }

  if (state.rearmRequired) {
    return {
      state: { ...state, pinchActive: true },
      shouldAttemptSelection: false,
      shouldRelease: false,
    };
  }

  const shouldAttemptSelection = !state.pinchActive && !state.selectionAttempted;
  return {
    state: {
      pinchActive: true,
      selectionAttempted: state.selectionAttempted || shouldAttemptSelection,
      rearmRequired: false,
    },
    shouldAttemptSelection,
    shouldRelease: false,
  };
};

export interface DragPickCandidate<T> {
  part: T;
  distanceSq: number;
}

/** Prefer visible mesh hits; proxy boxes are only a fallback for thin parts. */
export const selectDragPickCandidate = <T>(
  preciseHits: Array<DragPickCandidate<T>>,
  proxyHits: Array<DragPickCandidate<T>>,
): T | null => {
  const nearest = (hits: Array<DragPickCandidate<T>>) => hits.reduce<DragPickCandidate<T> | null>(
    (best, hit) => (!best || hit.distanceSq < best.distanceSq ? hit : best),
    null,
  );
  return nearest(preciseHits)?.part ?? nearest(proxyHits)?.part ?? null;
};
