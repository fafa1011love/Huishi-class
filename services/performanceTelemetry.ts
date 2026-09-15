/**
 * Small, dependency-free performance telemetry for the hand/3D pipeline.
 *
 * The module intentionally does not touch `window`, `document`, or
 * `PerformanceObserver` while it is being imported.  This keeps it safe to
 * use from the Node test runner and from SSR/build tooling.  Browser-only
 * observation is installed lazily by the constructor when requested.
 */

export type TelemetryStage = 'capture' | 'infer' | 'publish' | 'consume' | 'frame';

/** Metadata passed between the worker publisher and the first R3F consumer. */
export interface PublishedHandInput {
  sequence: number;
  capturedAt: number;
  processedAt: number;
  /** Inference duration measured inside the worker's own clock domain. */
  inferenceMs?: number;
  publishedAt: number;
}

export interface TelemetryEvent {
  stage: TelemetryStage;
  /** Monotonic timestamp in milliseconds when the event ended/was marked. */
  at: number;
  /** Duration in milliseconds. Marks and instantaneous samples use 0. */
  duration: number;
  frameId?: number | string;
  sequence?: number;
  details?: Record<string, string | number | boolean | null>;
}

export interface LongTaskSample {
  at: number;
  duration: number;
  name?: string;
}

/** The subset of THREE.WebGLRenderer.info that is useful in a JSON report. */
export interface RendererInfoSnapshot {
  calls?: number;
  triangles?: number;
  points?: number;
  lines?: number;
  geometries?: number;
  textures?: number;
  programs?: number;
  /** Preserve useful vendor-specific counters without retaining object refs. */
  [key: string]: number | undefined;
}

export interface TelemetryStageSummary {
  count: number;
  ratePerSecond: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  averageMs: number;
}

export interface PerformanceTelemetrySnapshot {
  version: 1;
  enabled: boolean;
  startedAt: number;
  generatedAt: number;
  capacity: number;
  events: TelemetryEvent[];
  longTasks: LongTaskSample[];
  rendererInfo: RendererInfoSnapshot | null;
  summaries: Partial<Record<TelemetryStage, TelemetryStageSummary>>;
}

export interface PerformanceTelemetryOptions {
  /** Maximum number of pipeline events retained in the ring. */
  capacity?: number;
  /** Maximum number of Long Task entries retained. */
  longTaskCapacity?: number;
  /** Disable all recording while retaining a no-op object for easy wiring. */
  enabled?: boolean;
  /** Injectable monotonic clock, primarily useful in deterministic tests. */
  now?: () => number;
  /** Install a browser Long Task observer when one is available. */
  observeLongTasks?: boolean;
}

export interface TelemetrySpan {
  readonly stage: TelemetryStage;
  readonly startedAt: number;
  readonly frameId?: number | string;
  readonly sequence?: number;
  readonly details?: Record<string, string | number | boolean | null>;
}

type LongTaskObserver = {
  observe: (options: Record<string, unknown>) => void;
  disconnect: () => void;
};

type LongTaskEntry = {
  entryType?: string;
  startTime?: number;
  duration?: number;
  name?: string;
};

type LongTaskObserverConstructor = new (
  callback: (list: { getEntries: () => LongTaskEntry[] }) => void,
) => LongTaskObserver;

const DEFAULT_CAPACITY = 720;
const DEFAULT_LONG_TASK_CAPACITY = 120;
const MIN_CAPACITY = 1;

const finiteOr = (value: unknown, fallback: number): number => (
  typeof value === 'number' && Number.isFinite(value) ? value : fallback
);

const clampCapacity = (value: number | undefined, fallback: number): number => {
  const candidate = Math.floor(finiteOr(value, fallback));
  return Math.max(MIN_CAPACITY, candidate);
};

const cloneDetails = (
  details: Record<string, string | number | boolean | null> | undefined,
): Record<string, string | number | boolean | null> | undefined => {
  if (!details) return undefined;
  return { ...details };
};

const cloneRendererInfo = (info: RendererInfoSnapshot | null): RendererInfoSnapshot | null => (
  info ? { ...info } : null
);

const percentile = (values: number[], fraction: number): number => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
};

const toRendererInfoSnapshot = (info: unknown): RendererInfoSnapshot | null => {
  if (!info || typeof info !== 'object') return null;
  const source = info as Record<string, unknown>;
  const result: RendererInfoSnapshot = {};

  // THREE groups counters under render/memory/programs. Accept a flat object
  // too, which makes the API convenient for tests and other renderers.
  const render = source.render && typeof source.render === 'object'
    ? source.render as Record<string, unknown>
    : source;
  const memory = source.memory && typeof source.memory === 'object'
    ? source.memory as Record<string, unknown>
    : source;
  const programs = source.programs;

  const copyNumber = (key: string, sourceValue: unknown) => {
    if (typeof sourceValue === 'number' && Number.isFinite(sourceValue)) result[key] = sourceValue;
  };

  for (const key of ['calls', 'triangles', 'points', 'lines']) copyNumber(key, render[key]);
  for (const key of ['geometries', 'textures']) copyNumber(key, memory[key]);
  if (typeof programs === 'number' && Number.isFinite(programs)) {
    result.programs = programs;
  } else if (Array.isArray(programs)) {
    result.programs = programs.length;
  }

  // Keep any additional scalar counters supplied by a custom renderer.
  for (const [key, value] of Object.entries(source)) {
    if (key === 'render' || key === 'memory' || key === 'programs' || key in result) continue;
    copyNumber(key, value);
  }

  return Object.keys(result).length > 0 ? result : null;
};

/**
 * A bounded, JSON-serializable recorder for the hand-input to WebGL path.
 * It is deliberately allocation-light during steady state: the event ring
 * reuses slots and only snapshot() creates a sorted copy for reporting.
 */
export class PerformanceTelemetry {
  readonly capacity: number;
  readonly longTaskCapacity: number;
  readonly enabled: boolean;

  private readonly now: () => number;
  private readonly eventRing: Array<TelemetryEvent | undefined>;
  private readonly longTaskRing: Array<LongTaskSample | undefined>;
  private eventWriteIndex = 0;
  private eventCount = 0;
  private longTaskWriteIndex = 0;
  private longTaskCount = 0;
  private latestRendererInfo: RendererInfoSnapshot | null = null;
  private readonly startedAt: number;
  private longTaskObserver: LongTaskObserver | null = null;

  constructor(options: PerformanceTelemetryOptions = {}) {
    this.capacity = clampCapacity(options.capacity, DEFAULT_CAPACITY);
    this.longTaskCapacity = clampCapacity(options.longTaskCapacity, DEFAULT_LONG_TASK_CAPACITY);
    this.enabled = options.enabled !== false;
    this.now = options.now ?? (() => {
      const performanceObject = (globalThis as { performance?: { now?: () => number } }).performance;
      return typeof performanceObject?.now === 'function' ? performanceObject.now() : Date.now();
    });
    this.eventRing = new Array(this.capacity);
    this.longTaskRing = new Array(this.longTaskCapacity);
    this.startedAt = this.now();

    if (this.enabled && options.observeLongTasks !== false) this.observeLongTasks();
  }

  /** Add an instantaneous stage marker. */
  mark(
    stage: TelemetryStage,
    metadata: Omit<TelemetryEvent, 'stage' | 'at' | 'duration'> = {},
    at = this.now(),
  ): void {
    this.record({ stage, at, duration: 0, ...metadata });
  }

  /** Record a completed interval. Invalid/negative durations are normalized. */
  record(event: TelemetryEvent): void {
    if (!this.enabled) return;
    const at = finiteOr(event.at, this.now());
    const duration = Math.max(0, finiteOr(event.duration, 0));
    const normalized: TelemetryEvent = {
      stage: event.stage,
      at,
      duration,
    };
    if (event.frameId !== undefined) normalized.frameId = event.frameId;
    if (event.sequence !== undefined) normalized.sequence = event.sequence;
    const details = cloneDetails(event.details);
    if (details) normalized.details = details;

    this.eventRing[this.eventWriteIndex] = normalized;
    this.eventWriteIndex = (this.eventWriteIndex + 1) % this.capacity;
    this.eventCount = Math.min(this.eventCount + 1, this.capacity);
  }

  /** Start a span; pass the returned token to end(). */
  begin(
    stage: TelemetryStage,
    metadata: Omit<TelemetrySpan, 'stage' | 'startedAt'> = {},
    startedAt = this.now(),
  ): TelemetrySpan {
    return {
      stage,
      startedAt,
      ...(metadata.frameId === undefined ? {} : { frameId: metadata.frameId }),
      ...(metadata.sequence === undefined ? {} : { sequence: metadata.sequence }),
      ...(metadata.details === undefined ? {} : { details: cloneDetails(metadata.details) }),
    };
  }

  end(span: TelemetrySpan, endedAt = this.now()): void {
    this.record({
      stage: span.stage,
      at: finiteOr(endedAt, this.now()),
      duration: Math.max(0, finiteOr(endedAt, this.now()) - finiteOr(span.startedAt, endedAt)),
      frameId: span.frameId,
      sequence: span.sequence,
      details: span.details,
    });
  }

  /** Convenience wrapper for synchronous work. */
  measure<T>(
    stage: TelemetryStage,
    work: () => T,
    metadata: Omit<TelemetrySpan, 'stage' | 'startedAt'> = {},
  ): T {
    const span = this.begin(stage, metadata);
    try {
      return work();
    } finally {
      this.end(span);
    }
  }

  /** Record a camera/video frame becoming available. */
  recordCapture(
    frameId?: number | string,
    at = this.now(),
    details?: Record<string, string | number | boolean | null>,
  ): void {
    this.mark('capture', { frameId, details }, at);
  }

  /** Record a completed inference interval. */
  recordInference(
    startedAt: number,
    endedAt: number,
    frameId?: number | string,
    details?: Record<string, string | number | boolean | null>,
  ): void {
    this.record({ stage: 'infer', at: endedAt, duration: endedAt - startedAt, frameId, details });
  }

  recordPublish(
    frameId?: number | string,
    at = this.now(),
    sequence?: number,
    details?: Record<string, string | number | boolean | null>,
  ): void {
    this.mark('publish', { frameId, sequence, details }, at);
  }

  recordConsume(
    frameId?: number | string,
    at = this.now(),
    sequence?: number,
    details?: Record<string, string | number | boolean | null>,
  ): void {
    this.mark('consume', { frameId, sequence, details }, at);
  }

  recordFrame(
    duration: number,
    at = this.now(),
    details?: Record<string, string | number | boolean | null>,
  ): void {
    this.record({ stage: 'frame', at, duration, details });
  }

  /** Keep the latest renderer counters without retaining the renderer object. */
  recordRendererInfo(info: unknown): void {
    if (!this.enabled) return;
    this.latestRendererInfo = toRendererInfoSnapshot(info);
  }

  /** Add a Long Task entry (also useful for tests or custom observers). */
  recordLongTask(sample: LongTaskSample): void {
    if (!this.enabled) return;
    const normalized: LongTaskSample = {
      at: finiteOr(sample.at, this.now()),
      duration: Math.max(0, finiteOr(sample.duration, 0)),
    };
    if (sample.name) normalized.name = sample.name;
    this.longTaskRing[this.longTaskWriteIndex] = normalized;
    this.longTaskWriteIndex = (this.longTaskWriteIndex + 1) % this.longTaskCapacity;
    this.longTaskCount = Math.min(this.longTaskCount + 1, this.longTaskCapacity);
  }

  /** Install PerformanceObserver only when the host exposes the longtask type. */
  observeLongTasks(): boolean {
    if (!this.enabled || this.longTaskObserver) return Boolean(this.longTaskObserver);
    const ctor = (globalThis as { PerformanceObserver?: LongTaskObserverConstructor }).PerformanceObserver;
    if (typeof ctor !== 'function') return false;

    try {
      const observer = new ctor((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType && entry.entryType !== 'longtask') continue;
          this.recordLongTask({
            at: finiteOr(entry.startTime, this.now()),
            duration: finiteOr(entry.duration, 0),
            name: entry.name,
          });
        }
      });
      // Some browsers expose PerformanceObserver but do not support longtask.
      observer.observe({ type: 'longtask', buffered: true } as unknown as Record<string, unknown>);
      this.longTaskObserver = observer;
      return true;
    } catch {
      // Unsupported entry type, cross-origin isolation, or a test double that
      // rejects observe() should never make telemetry affect the application.
      this.longTaskObserver = null;
      return false;
    }
  }

  disconnect(): void {
    this.longTaskObserver?.disconnect();
    this.longTaskObserver = null;
  }

  clear(): void {
    this.eventRing.fill(undefined);
    this.longTaskRing.fill(undefined);
    this.eventWriteIndex = 0;
    this.eventCount = 0;
    this.longTaskWriteIndex = 0;
    this.longTaskCount = 0;
    this.latestRendererInfo = null;
  }

  snapshot(at = this.now()): PerformanceTelemetrySnapshot {
    const events = this.readRing(this.eventRing, this.eventWriteIndex, this.eventCount)
      .sort((a, b) => a.at - b.at)
      .map((event) => ({
        ...event,
        ...(event.details ? { details: { ...event.details } } : {}),
      }));
    const longTasks = this.readRing(this.longTaskRing, this.longTaskWriteIndex, this.longTaskCount)
      .sort((a, b) => a.at - b.at)
      .map((sample) => ({ ...sample }));

    const summaries: Partial<Record<TelemetryStage, TelemetryStageSummary>> = {};
    const elapsedSeconds = Math.max(0.001, (finiteOr(at, this.startedAt) - this.startedAt) / 1000);
    for (const stage of ['capture', 'infer', 'publish', 'consume', 'frame'] as TelemetryStage[]) {
      const durations = events.filter((event) => event.stage === stage).map((event) => event.duration);
      if (durations.length === 0) continue;
      const total = durations.reduce((sum, value) => sum + value, 0);
      summaries[stage] = {
        count: durations.length,
        ratePerSecond: durations.length / elapsedSeconds,
        p50Ms: percentile(durations, 0.5),
        p95Ms: percentile(durations, 0.95),
        maxMs: Math.max(...durations),
        averageMs: total / durations.length,
      };
    }

    return {
      version: 1,
      enabled: this.enabled,
      startedAt: this.startedAt,
      generatedAt: finiteOr(at, this.startedAt),
      capacity: this.capacity,
      events,
      longTasks,
      rendererInfo: cloneRendererInfo(this.latestRendererInfo),
      summaries,
    };
  }

  /** JSON.stringify-friendly snapshot; useful for console/download reports. */
  toJSON(at = this.now()): PerformanceTelemetrySnapshot {
    return this.snapshot(at);
  }

  snapshotJson(at = this.now(), pretty = false): string {
    return JSON.stringify(this.snapshot(at), null, pretty ? 2 : 0);
  }

  private readRing<T>(ring: Array<T | undefined>, writeIndex: number, count: number): T[] {
    const result: T[] = [];
    const start = (writeIndex - count + ring.length) % ring.length;
    for (let index = 0; index < count; index += 1) {
      const item = ring[(start + index) % ring.length];
      if (item !== undefined) result.push(item);
    }
    return result;
  }
}

/** Factory kept small so callers can feature-gate telemetry in development. */
export const createPerformanceTelemetry = (
  options: PerformanceTelemetryOptions = {},
): PerformanceTelemetry => new PerformanceTelemetry(options);

/*
 * Development-only singleton used by the camera and R3F paths. Keeping the
 * handoff table here avoids adding hot-path telemetry fields to ControlRefs:
 * the production control contract remains unchanged, while the dev build can
 * correlate a worker result with the first rendered frame that consumed it.
 */
const isDevelopmentBuild = Boolean(
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV,
);

export const performanceTelemetry = createPerformanceTelemetry({
  enabled: isDevelopmentBuild,
  observeLongTasks: isDevelopmentBuild,
});

const telemetryNow = (): number => {
  const performanceObject = (globalThis as { performance?: { now?: () => number } }).performance;
  return typeof performanceObject?.now === 'function' ? performanceObject.now() : Date.now();
};

const pendingInputByOwner = new WeakMap<object, PublishedHandInput>();
const consumedSequenceByOwner = new WeakMap<object, number>();

export const notePublishedHandInput = (
  owner: object,
  input: Omit<PublishedHandInput, 'publishedAt'>,
  publishedAt = telemetryNow(),
): void => {
  if (!performanceTelemetry.enabled) return;
  pendingInputByOwner.set(owner, { ...input, publishedAt });
};

/**
 * Consume the newest hand sample once. Returns false for repeated renders of
 * the same sample, which keeps consume events correlated and bounded.
 */
export const consumePublishedHandInput = (
  owner: object,
  at = telemetryNow(),
): PublishedHandInput | null => {
  if (!performanceTelemetry.enabled) return null;
  const pending = pendingInputByOwner.get(owner);
  if (!pending || consumedSequenceByOwner.get(owner) === pending.sequence) return null;
  consumedSequenceByOwner.set(owner, pending.sequence);
  performanceTelemetry.recordConsume(
    pending.sequence,
    at,
    pending.sequence,
    {
      resultAgeMs: Math.max(0, at - pending.capturedAt),
      // `capturedAt` is sampled on the window while `processedAt` is sampled
      // in a worker. Their performance.now() time origins are not guaranteed
      // to match, so use the worker-reported duration for a trustworthy
      // latency metric and retain the old difference only as a fallback for
      // callers that do not provide inferenceMs.
      workerLatencyMs: pending.inferenceMs !== undefined
        ? Math.max(0, pending.inferenceMs)
        : Math.max(0, pending.processedAt - pending.capturedAt),
      publishToConsumeMs: Math.max(0, at - pending.publishedAt),
    },
  );
  return pending;
};

/**
 * Expose a small JSON-friendly inspection surface in development. The
 * instance itself remains the source of truth and is not installed in
 * production builds, so this has no user-facing/runtime cost there.
 */
if (isDevelopmentBuild && typeof window !== 'undefined') {
  (window as Window & { __HAND_PERF__?: PerformanceTelemetry }).__HAND_PERF__ = performanceTelemetry;
}
