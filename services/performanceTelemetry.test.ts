import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PerformanceTelemetry,
  type RendererInfoSnapshot,
} from './performanceTelemetry.ts';

const makeClock = () => {
  let value = 0;
  return {
    now: () => value,
    set: (next: number) => { value = next; },
  };
};

test('is safe to construct in a Node environment and supports a disabled no-op mode', () => {
  const clock = makeClock();
  const telemetry = new PerformanceTelemetry({ enabled: false, now: clock.now, observeLongTasks: false });

  telemetry.mark('capture', { frameId: 'ignored' });
  telemetry.recordFrame(42);
  telemetry.recordLongTask({ at: 1, duration: 60 });
  telemetry.recordRendererInfo({ render: { calls: 4 } });

  const snapshot = telemetry.snapshot(1000);
  assert.equal(snapshot.enabled, false);
  assert.deepEqual(snapshot.events, []);
  assert.deepEqual(snapshot.longTasks, []);
  assert.equal(snapshot.rendererInfo, null);
});

test('retains only the newest events and long tasks in bounded rings', () => {
  const clock = makeClock();
  const telemetry = new PerformanceTelemetry({
    capacity: 3,
    longTaskCapacity: 2,
    now: clock.now,
    observeLongTasks: false,
  });

  for (let index = 1; index <= 5; index += 1) {
    telemetry.recordFrame(index, index * 10);
    telemetry.recordLongTask({ at: index * 10, duration: index, name: `task-${index}` });
  }

  const snapshot = telemetry.snapshot(1000);
  assert.deepEqual(snapshot.events.map((event) => event.at), [30, 40, 50]);
  assert.deepEqual(snapshot.events.map((event) => event.duration), [3, 4, 5]);
  assert.deepEqual(snapshot.longTasks.map((sample) => sample.name), ['task-4', 'task-5']);
});

test('records correlated pipeline stages and computes duration summaries', () => {
  const clock = makeClock();
  const telemetry = new PerformanceTelemetry({ now: clock.now, observeLongTasks: false });

  telemetry.recordCapture('frame-1', 10, { source: 'rVFC', width: 320 });
  telemetry.recordInference(10, 25, 'frame-1');
  telemetry.recordPublish('frame-1', 26, 7);
  telemetry.recordConsume('frame-1', 28, 7);
  telemetry.record({ stage: 'infer', at: 50, duration: 10, frameId: 'frame-2' });
  telemetry.record({ stage: 'infer', at: 80, duration: 30, frameId: 'frame-3' });
  telemetry.recordFrame(18, 90, { dpr: 1, renderer: 'webgl2' });

  const snapshot = telemetry.snapshot(1000);
  assert.equal(snapshot.events.length, 7);
  assert.equal(snapshot.events[0].stage, 'capture');
  assert.equal(snapshot.events[1].frameId, 'frame-1');
  assert.equal(snapshot.events[2].sequence, 7);
  assert.deepEqual(snapshot.events[0].details, { source: 'rVFC', width: 320 });

  assert.equal(snapshot.summaries.infer?.count, 3);
  assert.equal(snapshot.summaries.infer?.p50Ms, 15);
  assert.equal(snapshot.summaries.infer?.p95Ms, 30);
  assert.equal(snapshot.summaries.infer?.maxMs, 30);
  assert.equal(snapshot.summaries.infer?.ratePerSecond, 3);
  assert.equal(snapshot.summaries.frame?.p95Ms, 18);

  const parsed = JSON.parse(telemetry.snapshotJson(1000));
  assert.equal(parsed.version, 1);
  assert.equal(parsed.events.length, snapshot.events.length);
});

test('normalizes renderer.info counters without retaining renderer object references', () => {
  const clock = makeClock();
  const telemetry = new PerformanceTelemetry({ now: clock.now, observeLongTasks: false });
  const rendererInfo = {
    render: { calls: 121, triangles: 456789, points: 2, lines: 8 },
    memory: { geometries: 17, textures: 9 },
    programs: [{}, {}, {}],
    customCounter: 12,
    ignoredObject: { nested: true },
  };

  telemetry.recordRendererInfo(rendererInfo);
  rendererInfo.render.calls = 999;
  const snapshot = telemetry.snapshot(100);
  const expected: RendererInfoSnapshot = {
    calls: 121,
    triangles: 456789,
    points: 2,
    lines: 8,
    geometries: 17,
    textures: 9,
    programs: 3,
    customCounter: 12,
  };
  assert.deepEqual(snapshot.rendererInfo, expected);
});

test('accepts Long Task observer entries when the browser API is present', () => {
  const clock = makeClock();
  const globalObject = globalThis as { PerformanceObserver?: unknown };
  const previousObserver = globalObject.PerformanceObserver;
  let fakeObserver: FakePerformanceObserver | null = null;

  class TestPerformanceObserver implements FakePerformanceObserver {
    private readonly callback: (list: { getEntries: () => Array<{ entryType?: string; startTime?: number; duration?: number; name?: string }> }) => void;
    constructor(callback: (list: { getEntries: () => Array<{ entryType?: string; startTime?: number; duration?: number; name?: string }> }) => void) {
      this.callback = callback;
      fakeObserver = this;
    }
    observe(): void { /* the fake accepts all observer options */ }
    disconnect(): void { /* no-op */ }
    emit(entries: Array<{ entryType?: string; startTime?: number; duration?: number; name?: string }>): void {
      this.callback({ getEntries: () => entries });
    }
  }

  try {
    globalObject.PerformanceObserver = TestPerformanceObserver;
    const telemetry = new PerformanceTelemetry({ now: clock.now });
    assert.ok(fakeObserver);
    fakeObserver.emit([
      { entryType: 'longtask', startTime: 12, duration: 64, name: 'script' },
      { entryType: 'paint', startTime: 20, duration: 100, name: 'ignored' },
    ]);
    assert.deepEqual(telemetry.snapshot(100).longTasks, [{ at: 12, duration: 64, name: 'script' }]);
    telemetry.disconnect();
  } finally {
    if (previousObserver === undefined) delete globalObject.PerformanceObserver;
    else globalObject.PerformanceObserver = previousObserver;
  }
});

interface FakePerformanceObserver {
  observe: (...args: unknown[]) => void;
  disconnect: () => void;
  emit: (entries: Array<{ entryType?: string; startTime?: number; duration?: number; name?: string }>) => void;
}
