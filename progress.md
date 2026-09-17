# Progress

## 2026-09-14

- 完成 HandLandmarker Worker 管线：`requestVideoFrameCallback`（无支持时 RAF fallback）、单 in-flight、旧帧丢弃、GPU→CPU fallback，摄像头限制 `320×240 / 30fps`。
- 完成时间感知控制数学：旋转差分按真实采样间隔换算为每秒速率，ModelViewer、ProceduralEarth、ProceduralTerrain、OpenGlobusEarth 和语音控制均按 `delta` 单次积分。
- Tracker 增加 120ms stale 预测、handedness 成本/锁定槽位、捏合/双指旋转滞回；ModelViewer 捏合释放宽限为 150ms。
- 删除模型侧重复 EMA 和无用 Dashboard 手势 React state；保留 ControlRefs 作为热路径通信。
- 虚拟手改为 4 个 InstancedMesh + 1 个 LineSegments；高模关闭实时投影阴影，阴影贴图 1024，ContactShadows 事件触发且 `frames={1}`。
- 加入会话模型模板缓存/引用计数与资源清理，降低模型切换后的 GPU/纹理泄漏风险。
- 生成并接入 `public/models/heart-interactive-lod.glb`：心脏由 2,682,160 降至 224,946 三角形。
- 增加 `services/performanceTelemetry.ts`：开发模式记录 capture/infer/publish/consume/frame、renderer.info、Long Task，并暴露 `window.__HAND_PERF__`；未使用 React state。
- 增加 `services/handGestureMath.ts` 与 tracker/telemetry 单元测试，覆盖 15/20/30Hz 速率不变性、1–3 帧漏检、150ms 宽限、滞回、handedness 翻转。
- 自适应渲染质量：Canvas DPR 初始 1，交互中 1.25，空闲 900ms 后最多 1.5；交互时暂停阴影更新，释放后刷新一次。
- 验证：`npx tsc --noEmit --pretty false`、`npm run build`、`npm run test:voice` 均通过；完整测试共 86 项通过。
- 未完成硬件验收：当前环境没有 Intel UHD 620/630 摄像头/真实 GPU，FPS/1% low/输入延迟需在目标设备用 `window.__HAND_PERF__.snapshotJson()` 采集。
- 保留用户原有 `.env.example` 删除状态，未执行破坏性 git 操作。
- 复核并修复拖拽滤波绕过：`handNDCPosition` 现在由 HandController 的时间感知滤波统一发布，ModelViewer 不再从原始指尖重建拖拽射线。
- 增加 160ms Worker 结果 watchdog；无结果时清理旧旋转/缩放/拖拽/虚拟手状态，且不覆盖正在运行的语音旋转。模式切换期间的带 sequence 帧错误改为可恢复丢帧。
- 修正遥测跨 Worker 时钟计算，使用主线程接收时间 + worker `inferenceMs`；虚拟手视觉平滑改为 35ms 时间常数。
- 为 HIV 和 9 个高面数器官生成并接入 Draco 互动 LOD：每个约 224k 三角形；原始模型保留。逐个通过 glTF-Transform 校验（无错误；Draco 为校验器不支持的提示）。
- 最新验证：`npx tsc --noEmit --pretty false`、`npm run build`、`node --experimental-strip-types --test services/*.test.ts`（86/86）通过；目标 Intel GPU 的实机 FPS/延迟仍待采集。
- 开始最终审计阶段：复核 Worker 调度/清理、真实渲染帧时遥测、DPR 恢复上限，并在修复后重跑类型检查、单测、构建和浏览器烟测。
- 最终审计修复：模式重初始化前暂停帧调度并由 `ready` 恢复；致命 Worker/摄像头路径统一释放资源；忽略过期初始化失败；帧遥测改为真实 `delta * 1000` 且附带 `callbackMs`；交互/稳定 DPR 均不超过物理 DPR。
- 修复后验证：`npx tsc --noEmit --pretty false` 通过，`npm run test:voice` 86/86 通过。
- LOD 接线复核通过：内置模型使用互动 LOD，导入模型不被误替换；11 组源/LOD 的节点、网格、材质名称与数量一致；无全局强制 `DoubleSide`。
- 浏览器基础页加载成功，但工作台有登录门禁；未擅自创建/使用账号，改用临时本地 Vite 入口完成 WebGL 烟测。
- 临时页首次真实初始化 HandLandmarker Worker 发现 MediaPipe 模块 Worker 兼容错误 `self.import is not a function`；确认 WASM loader 是经典脚本，改为 Vite classic Worker 运行以使用原生 `importScripts()`，待浏览器复验。
- Vite dev classic Worker 仍保留 ESM import，改回模块 Worker并增加固定同源 loader 的 Blob ESM/`ModuleFactory` 适配及 `custom_dbg` 兼容。浏览器复验通过：GPU delegate ready、心脏 LOD 非空、遥测启用且短测 frame p95 约 10.5ms。
- 生产预览复验通过：构建后的哈希 Worker chunk 成功初始化 MediaPipe/WASM/模型并返回 GPU delegate ready，控制台无错误；临时烟测入口已删除。
- 完整 Worker 推理链复验通过：16×16 空白 `ImageBitmap` 返回 sequence 1 正常 result（0 手、无 console error）；冷启动首帧约 4.16s，验收按预热后采样。临时入口已删除。
- 最终验证通过：`npx tsc --noEmit --pretty false`、`npm run test:voice`（86/86）、`npm run build`（2706 modules）、`git diff --check`。计划阶段 7 完成；仅剩目标 Intel UHD 620/630 + 真实摄像头的 120 秒硬件门禁。
- 本地服务：Vite 前端保持在 `http://127.0.0.1:3000/`；4000 端口已有 API 实例，前端代理 `/api/auth/me` 返回预期未登录 401，链路可达。

## 2026-09-15

- 开始 Phase 8：定位右手食指/中指并拢旋转的走停问题，确认单帧姿态误判会立即清空采样基准，双手模式还会在旋转处理函数外提前短路。
- 已实现旋转连续性状态机：单次误判进入宽限，第二次失败或超过 120ms 才释放；宽限速度按 90ms 时间常数衰减，恢复时保留最后有效位置基准。
- 旋转位置滤波调整为 32ms；位移先按真实采样时间转换为每秒速率，再应用固定速率死区。
- 新增 4 项确定性回归测试；`npm run test:voice` 90/90、`npx tsc --noEmit --pretty false`、`git diff --check` 已通过。首次生产构建受工作区读取沙箱限制失败，待在批准的构建权限下重跑。
- 沙箱外生产构建通过（Vite 2706 modules）；本地页面 `http://127.0.0.1:3000/` 返回 HTTP 200。Phase 8 完成，真实摄像头双指操作仍需用户在目标设备上手动确认。

## 2026-09-18

- 开始 Phase 9：定位连续拆解时旧零件被再次拖走的问题。
- 确认根因是 ModelViewer 重复判断捏合并在明确松开后仍保留 150ms 可移动旧抓取，同时抓取为持续电平触发、代理包围盒优先于真实网格命中。
- 用户确认交互规则为“松开后，在新目标上重新捏合才抓取”；当前基线 `npm run test:voice` 94/94、`npx tsc --noEmit --pretty false` 通过。
- 完成拖拽会话状态机接线：ModelViewer 只消费 `ControlRefs.isDragging`，每次捏合只选取一次，松开即时固定，丢帧冻结且 watchdog 清零后释放，旋转中断后要求完整松开。
- 精确网格射线命中优先于代理包围盒；不可拆核心从可抓取集合中过滤。新增 5 项针对性测试并通过，`git diff --check` 通过。
- Phase 9 首次组合补丁因 `ModelViewer` import 上下文不匹配而完整失败、未产生部分写入；改为依据当前源码分块实施。
- 已实现拖拽会话状态机：显式松开立即释放、一次捏合只选一次、旋转中断后需完整松开再武装；新增真实网格优先/代理兜底选择，并排除不可拆解核心。
- Phase 9 定向测试 21/21 通过，`npx tsc --noEmit --pretty false` 通过，`git diff --check` 通过。
- Phase 9 最终验证通过：全量服务测试 99/99、`npx tsc --noEmit --pretty false`、`npm run build`（Vite 2707 modules）及 `git diff --check` 均成功。
- 浏览器确认 `http://localhost:5173/` 可加载并跳转管理员登录页；连续拆解的真实摄像头操作受登录与摄像头权限门禁限制，未擅自输入凭据或授权摄像头。
- Phase 9 完成；旧零件不会在下一次新捏合时被继续拖回，仍需用户在已登录且连接摄像头的目标设备上做最终手感验收。
- 使用临时本地入口对真实 PubChem 6233 模型完成连续拖放回归：先将右侧可拆侧基移到右侧并释放，再重新捏合左侧侧基移到左侧；两次移动事件分别触发，第二次操作期间右侧已放置零件始终固定。
- 浏览器回归期间首次入口因不稳定 props 和缺少 `index.css` 出现重载与 150px 画布；修正入口后验证通过。隐藏窗口启动 Vite 被环境阻止，改用普通 PTY 服务完成验证。
- 浏览器回归临时文件 `drag-smoke.html`、`drag-smoke.tsx` 已删除；产品源码中未保留测试入口。
- 清理临时入口后再次验证：`npm run test:voice` 99/99、`npx tsc --noEmit --pretty false`、`npm run build`（Vite 2707 modules）和 `git diff --check` 均通过；`http://127.0.0.1:3000/` 返回 HTTP 200。
