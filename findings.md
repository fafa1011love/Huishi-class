# Findings

## Baseline diagnosis

- HandController 原实现把同步 `detectForVideo()` 放在 requestAnimationFrame 中，且最多检测 4 手，会阻塞 R3F 主线程。
- 旋转差分没有除以真实采样时间，并在 ModelViewer 中跨多个显示帧重复积分。
- 输入、速度、3D 控制和拖拽存在多层 EMA，造成明显滞后。
- Tracker 漏检立即返回空 active，ModelViewer 的捏合释放宽限为 0。
- heart-optimized.glb 运行时约 2.68M 三角形；Draco 只减下载体积。
- Canvas DPR 上限 2、2048 阴影、全网格阴影/DoubleSide、ContactShadows 每帧更新造成较高 GPU 负载。

## Current workspace observations

- 现有用户改动：`.env.example` 删除，必须保留。
- 并行代理已新增 `services/handLandmarker.worker.ts` 和 `services/performanceTelemetry.ts`；尚未完成整合审查。
- `types.ts` 已补充速度单位注释。
- Three.js 自带 `examples/jsm/modifiers/SimplifyModifier.js`，可作为缺少 gltf-transform 时的减面后备；应避免在渲染热路径同步运行。
- 当前 ProceduralTerrain/OpenGlobus/ModelViewer 仍有 `delta * 60` 或无 delta 的速度积分，必须等代理完成后统一审查。
- Worker 当前协议草案使用 ImageBitmap，需在主线程严格维护单个 in-flight 请求，并在 worker 返回 `{ sequence, capturedAt, processedAt, landmarks, handedness }` 语义上补齐时间字段。

## Implementation review (2026-09-14)

- All active consumers now treat ControlRefs rotationVelocity/zoomSpeed as per-second rates and clamp long frame deltas to 50ms.
- The adaptive DPR path distinguishes hand visibility from actual interaction so a visible idle hand does not pin low quality indefinitely.
- The original custom LOD script intentionally rejects multi-buffer/non-Draco inputs. For the remaining built-in high-poly assets, glTF-Transform simplify + Draco was used offline; 10 additional checked-in LODs now stay below ~225k triangles and are selected only for public built-ins (uploaded assets are untouched).
- A worker can fail between mode reinitialization messages or stall without sending a result. Frame-scoped worker errors are recoverable; a 160ms response watchdog clears rates, landmarks, NDC and drag state, while preserving an active voice rotation command.
- Worker and window `performance.now()` clocks are not assumed to share a time origin. Inference telemetry is anchored to the main-thread receive time and uses the worker-reported `inferenceMs` duration.
- Virtual-hand overlay smoothing is time-aware (35ms constant) so its visual response does not change with display refresh rate.

## Final audit (2026-09-14)

- Final review targets are the worker scheduler during mode reinitialization, actual inter-frame telemetry, and idle DPR restoration capped by the physical device pixel ratio.
- The existing worktree includes all prior implementation and generated LOD assets; the unrelated `.env.example` deletion remains user-owned and must be preserved.
- R3F frame telemetry was measuring only the JavaScript callback body; acceptance frame-time statistics require `delta * 1000`. Callback cost is retained separately as `callbackMs` metadata.
- Mode switches set `workerReady=false` but left the video callback scheduler active. Pausing it until the next worker `ready` message removes needless callbacks and makes one-scheduler ownership explicit.
- Adaptive quality used absolute DPR values; both active and stable targets must be capped by `window.devicePixelRatio` so DPR-1 devices are never supersampled.
- Fatal camera/worker paths now need to stop both the MediaStream and Worker; obsolete async initialization failures must not terminate a newer mode initialization.
- Built-in model loads pass an empty `assetUrls` map, so all configured interactive LOD URLs are selected. Imported/local models carry asset mappings and intentionally retain their original URL and structure.
- All 11 LOD files preserve source node/mesh/material name arrays and counts. The remaining `DoubleSide` assignment is limited to the reconstructed PubChem subset material, not applied globally.
- The normal browser path is authentication-gated and has no existing anonymous development preview. Browser smoke testing must not create or use an account implicitly; use a temporary local-only Vite harness for `ModelViewer` and remove it afterward.
- Real module-worker initialization exposed `self.import is not a function` in `@mediapipe/tasks-vision`. Its generated WASM loader is a classic script that defines global `ModuleFactory`; dynamic ESM import is also invalid under Vite public assets. The correct compatibility path is Vite's classic Worker output so MediaPipe can use `importScripts()`.
- Vite dev does not transpile the imported TypeScript worker into a runnable classic script, so the durable solution remains a module Worker with a constrained same-origin loader adapter. It imports the classic Emscripten source as a Blob ESM, explicitly exports `ModuleFactory`, and supplies the loader's strict-mode `custom_dbg` global.
- Browser retest passes: HandLandmarker reports `ready` with the GPU delegate, the heart LOD renders, dev telemetry records 79 frames with p95 10.5ms in the short smoke run, and renderer triangles are about 230k including scene extras.
- The production worker chunk also initializes with the GPU delegate under `vite preview` with no console errors, confirming the loader adapter works after bundling. Temporary smoke pages are not part of the final source or build.
- A synthetic 16x16 `ImageBitmap` completed the full worker protocol (`ready -> frame sequence 1 -> result`) with zero detected hands and no console errors. The cold first inference took about 4.16s, reinforcing that FPS/latency acceptance must begin after model warmup.

## Two-finger rotation stutter (2026-09-15)

- `isTwoFingerRotationGesture` immediately cleared the active state whenever either finger-extension check or the normalized fingertip-distance threshold failed for one inference sample.
- `applySingleHandRotation` then cleared `prevRotatePosRef`; the first recovered sample could only establish a new baseline. One bad sample therefore removed both that update and the next update from model motion.
- Dual-hand mode evaluated the hard predicate before calling the rotation handler, so a continuity policy inside the handler would otherwise be bypassed.
- The displacement deadzone scaled with sample duration before rate normalization. A fixed rate deadzone is needed so equivalent motion behaves the same at 15/20/30Hz.

## Sequential disassembly wrong-part drag (2026-09-18)

- `HandController` already publishes a hysteresis-filtered `isDragging` signal and preserves it across short tracker gaps, but `ModelViewer` independently reclassifies pinch from landmarks with different thresholds.
- `ModelViewer` treats an explicit non-pinch sample like a detector gap: it keeps the old grab alive for 150ms and continues applying pointer movement during that grace. Moving toward the next part can therefore pull the previously placed part back across the scene.
- Grab acquisition is level-triggered, so a held pinch can select a part on any later render frame. The agreed behavior is edge-triggered: one fresh pinch gets one selection attempt, and a miss requires release before retry.
- Part selection currently returns the nearest proxy AABB before testing real mesh intersections. A proxy can therefore override a different part that the user visibly targeted.
- 可靠修复应区分“明确松开”和“手部数据缺失”：前者当帧固定旧零件，后者才保留 150ms tracker 宽限。
- PubChem 6233 的 `core` 已标记 `disassemblable=false`，但此前仍进入 `grabbableParts`；从交互零件列表过滤该标记可避免苯环核心的大范围命中干扰两个甲基侧基。
- 真实 PubChem 6233 浏览器回归验证了完整链路：右侧侧基释放后固定，重新捏合并拖动左侧侧基时不会把右侧旧零件重新带回；两次释放各产生一次零件移动事件。
- 主应用工作台仍受登录门禁限制，因此回归使用临时本地 `ModelViewer` 入口模拟 `ControlRefs` 的捏合边沿；入口只用于验证并已删除。
