import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceDragGestureSession,
  createDragGestureSessionState,
  selectDragPickCandidate,
} from './dragInteraction.ts';

test('explicit release ends the old grab and a fresh pinch selects once', () => {
  let update = advanceDragGestureSession(createDragGestureSessionState(), {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, true);

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, false, 'a held pinch must not switch parts');

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: false,
    rotationActive: false,
  });
  assert.equal(update.shouldRelease, true);

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, true, 'a new pinch must pick a new target');
});

test('an already-held pinch must release once after model initialization', () => {
  let update = advanceDragGestureSession(createDragGestureSessionState(true), {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, false);

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: false,
    rotationActive: false,
  });
  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, true);
});

test('a tracking gap freezes the grab until the watchdog clears pinch state', () => {
  const active = advanceDragGestureSession(createDragGestureSessionState(), {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  const gap = advanceDragGestureSession(active.state, {
    handVisible: false,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(gap.shouldRelease, false);
  assert.deepEqual(gap.state, active.state);

  const watchdogRelease = advanceDragGestureSession(gap.state, {
    handVisible: false,
    pinchActive: false,
    rotationActive: false,
  });
  assert.equal(watchdogRelease.shouldRelease, true);
  assert.deepEqual(watchdogRelease.state, createDragGestureSessionState());
});

test('rotation interruption requires a complete release before rearming', () => {
  let update = advanceDragGestureSession(createDragGestureSessionState(), {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: false,
    rotationActive: true,
  });
  assert.equal(update.shouldRelease, true);

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, false);

  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: false,
    rotationActive: false,
  });
  update = advanceDragGestureSession(update.state, {
    handVisible: true,
    pinchActive: true,
    rotationActive: false,
  });
  assert.equal(update.shouldAttemptSelection, true);
});

test('precise mesh hits take priority over closer proxy boxes', () => {
  assert.equal(selectDragPickCandidate(
    [{ part: 'visible-mesh', distanceSq: 9 }],
    [{ part: 'proxy-box', distanceSq: 1 }],
  ), 'visible-mesh');
  assert.equal(selectDragPickCandidate([], [
    { part: 'far-proxy', distanceSq: 4 },
    { part: 'near-proxy', distanceSq: 2 },
  ]), 'near-proxy');
});
