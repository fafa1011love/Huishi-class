# 手势与 3D 性能基线

本文定义手势输入到 3D 画面的观测接口和发版门禁。性能采样默认只在开发/验收构建开启；生产环境应创建 `enabled: false` 的实例，避免保存用户的运行时数据。

## 遥测接口

`services/performanceTelemetry.ts` 不依赖 React、Three.js 或浏览器全局对象，Node 测试和 SSR 可以直接导入。它提供固定容量的环形缓冲，不会因为长时间运行无限增长。

```ts
import { createPerformanceTelemetry } from './services/performanceTelemetry';

const telemetry = createPerformanceTelemetry({
  enabled: import.meta.env.DEV,
  capacity: 720,          // 约 12 秒的 60Hz pipeline 事件
  longTaskCapacity: 120,
  observeLongTasks: true,
});
```

所有时间均为单调毫秒（`performance.now()`）；`TelemetryEvent.at` 是事件结束或 marker 时间，区间开始时间为 `at - duration`。使用同一 `frameId` 关联摄像头帧、推理结果和渲染消费点。

推荐在现有循环中接入以下点：

```ts
// camera requestVideoFrameCallback (或取到新 currentTime 的位置)
telemetry.recordCapture(frameId, captureAt, {
  source: 'rVFC',
  width: video.videoWidth,
  height: video.videoHeight,
});

const inferStart = performance.now();
const result = landmarker.detectForVideo(video, inferStart);
telemetry.recordInference(inferStart, performance.now(), frameId);

telemetry.recordPublish(frameId, performance.now(), sequence);

// ModelViewer useFrame 中，在第一次读取该结果后调用
telemetry.recordConsume(frameId, performance.now(), sequence);

// 同一个 useFrame 中
telemetry.recordFrame(delta * 1000, performance.now(), { dpr, model });
telemetry.recordRendererInfo(gl.info);
```

`recordRendererInfo` 只复制数字计数器，不保存 renderer 引用；支持 Three.js 的 `render.calls/triangles/points/lines`、`memory.geometries/textures` 和 `programs`。浏览器提供 `PerformanceObserver` 时，构造函数会自动收集 `longtask`；不支持时静默降级。

## JSON 快照

调用 `telemetry.snapshot()` 得到 `PerformanceTelemetrySnapshot`，或调用 `snapshotJson(now, true)` 生成可下载文本。字段如下：

| 字段 | 含义 |
| --- | --- |
| `events` | 最近 N 个 capture/infer/publish/consume/frame 事件，按 `at` 排序 |
| `longTasks` | 最近的主线程 Long Task（通常 `duration > 50ms`） |
| `rendererInfo` | 最近一次 WebGL renderer.info 数字快照 |
| `summaries` | 每个阶段的 count、每秒速率、p50/p95/max/平均耗时 |

示例（缩略）：

```json
{
  "version": 1,
  "events": [
    {"stage":"capture","at":1000.0,"duration":0,"frameId":42},
    {"stage":"infer","at":1016.2,"duration":14.8,"frameId":42},
    {"stage":"publish","at":1016.5,"duration":0,"frameId":42,"sequence":9},
    {"stage":"consume","at":1020.1,"duration":0,"frameId":42,"sequence":9},
    {"stage":"frame","at":1021.0,"duration":16.4}
  ],
  "summaries": {"infer":{"count":1,"p50Ms":14.8,"p95Ms":14.8}}
}
```

建议把快照绑定到开发面板或 `window.__HAND_PERF__`（仅 DEV），但不要在每个事件上调用 React `setState`；用 250-500ms 定时器读取快照即可。

## 验收环境与门禁

每个模型预热 10 秒后采样 120 秒，关闭 DevTools，浏览器为当前 Chrome/Edge，显示器 60Hz。必须覆盖课堂常见的 Intel UHD 620/630（4 逻辑核、8GB）和一台 Iris Xe。心脏模型、地球图层标签和双手拖拽都要测。

| 指标 | UHD 620/630 门槛 | Iris Xe/高性能目标 |
| --- | ---: | ---: |
| 推理耗时 p50 / p95 / max | <= 25 / 35 / 50 ms | <= 16 / 25 / 40 ms |
| 推理结果速率 | >= 20 results/s | >= 28 results/s |
| 单 in-flight 推理排队等待 p95 | <= 8 ms | <= 8 ms |
| publish -> 首次 consume p50 / p95 | <= 12 / 25 ms | <= 8 / 20 ms |
| capture -> consume p50 / p95 | <= 100 / 160 ms | <= 70 / 110 ms |
| 稳态 FPS（median / 1% low） | >= 50 / 40 | >= 58 / 52 |
| frame time p95 / p99 | <= 25 / 33.3 ms | <= 18.5 / 25 ms |
| `>50ms` 长帧（120s） | <= 2 次且不连续 | <= 1 次且不连续 |
| Long Task 总时长（120s） | <= 150 ms | <= 75 ms |
| 10 分钟末段 FPS 相对首段下降 | < 15% | < 10% |
| 10 分钟 JS heap 净增长 | < 30 MB | < 20 MB |

另外固定以下资源预算：默认 LOD 单模型 <= 250k triangles、主场景 <= 120 draw calls、虚拟手 <= 6 draw calls；集显 DPR 为 1.0。若某模型超过预算，应切换低模/关闭实时接触阴影，而不是降低输入采样率来掩盖问题。

### 自动化采集建议

使用 Playwright Chromium 的 fake media 输入一段可重复的双手轨迹，导出遥测 JSON。CI 检查事件序列、`frameId` 是否单调、是否存在同时进行的两个推理、publish/consume 间隔和环形缓冲上限。CI 虚拟 GPU 只做时序/内存回归，不作为 FPS 门禁；FPS 门禁在真实 UHD 课堂机上执行。

## 本地检查

```bash
node --experimental-strip-types --test services/performanceTelemetry.test.ts
node --experimental-strip-types --test services/handTargetTracker.test.ts
npx tsc --noEmit --pretty false
```

测试覆盖：禁用模式在 Node 下安全导入、事件/Long Task 环形淘汰、阶段 p50/p95 统计、renderer.info 深拷贝、PerformanceObserver 降级，以及追踪器锁定、速度预测、短时 stale 姿态和 cooldown 时序。
