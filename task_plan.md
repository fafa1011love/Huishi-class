# 手势 3D 低延迟优化

## Goal

让摄像头手势操纵在普通集显电脑上跟手、连续、稳定，同时保留鼠标、语音、标签、测验和拆解功能。

## Phases

### Phase 1: 汇总并审查并行代理改动，确认输入/控制/渲染接口
**Status:** complete

### Phase 2: 完成 Worker 手势管线、连续性和速率单位契约
**Status:** complete

### Phase 3: 完成渲染负载优化、LOD/虚拟手和资源生命周期处理
**Status:** complete

### Phase 4: 补充性能遥测、单元测试并修复编译/行为回归
**Status:** complete

### Phase 5: 运行生产构建与可用的浏览器烟测，记录剩余硬件验收限制
**Status:** complete

### Phase 6: 复核边界状态：拖拽滤波、Worker 卡顿、模式切换和高模 LOD 覆盖
**Status:** complete

### Phase 7: 最终审计 Worker 生命周期、真实帧时遥测和自适应 DPR，并完成浏览器烟测
**Status:** complete

### Phase 8: 修复右手双指旋转的单帧误判卡顿
**Status:** complete

- 增加 120ms/连续 2 次失败的旋转连续性状态机。
- 宽限期间衰减最后有效速度，恢复时沿用最后有效采样基准。
- 将旋转死区改为采样率无关的每秒速率死区，并补充确定性测试。
- 完成类型检查、全量单元测试、生产构建和差异检查。

## Acceptance

- 结果队列最多 1 帧，漏检 1-3 帧不释放抓取。
- rotationVelocity/zoomSpeed 明确为每秒速率，每个渲染帧只按 delta 积分一次。
- 输入 15/20/30Hz 回放结果基本一致，捏合释放约 120-180ms。
- 高三角形模型有互动 LOD；集显交互期间降低 DPR、阴影和 ContactShadows 负担。
- 开发模式输出统一 JSON 性能记录，不使用 React state 承载热路径指标。

## Verification

- `npx tsc --noEmit --pretty false`：通过。
- `npm run build`：通过（Vite 2706 modules transformed）。
- `npm run test:voice`：90 项通过（含 4 项双指旋转连续性/速率回归测试）。
- 心脏 LOD 生成/Draco round-trip：`2,682,160 → 224,946` 三角形，约 `7.59 MB → 1.32 MB`。
- 其余超过 25 万三角形的内置模型也已接入互动 LOD（HIV 与 9 个器官，约 224k 三角形/模型）。
- 拖拽改为消费 HandController 发布的滤波 NDC；Worker 无结果约 160ms 后自动清理旧控制量。
- 模式切换会暂停帧调度并由 Worker `ready` 恢复；致命路径统一释放 Worker 与 MediaStream。
- 修复 MediaPipe 在模块 Worker 中加载经典 Emscripten runtime 的兼容问题，开发与生产预览均实测 GPU delegate ready。
- R3F frame 指标记录真实 `delta * 1000`；交互/稳定 DPR 均不超过物理设备 DPR。
- 双指旋转单次姿态误判保持最多 120ms，第二次连续失败或超时才释放；宽限速度按 90ms 时间常数衰减。
- 旋转位置滤波为 32ms，死区按每秒速率计算；15/20/30Hz 确定性回放测试通过。
- 目标 Intel UHD 620/630 的真实 FPS、1% low 和输入延迟仍需在硬件上采集；本环境未连接摄像头/目标 GPU。

## Errors Encountered

| Error | Attempt | Resolution |
|---|---:|---|
| tracker handedness flip test initially exposed raw-candidate side leak | 1 | Return post-update track from `updateLocked`, preserving slot semantic side |
| no browser/target GPU telemetry available in workspace | 1 | Keep dev-only `window.__HAND_PERF__` JSON recorder and document hardware test gate |
| Worker 重建期间把“尚未准备完成”误报为致命错误 | 1 | 按带 sequence 的帧错误丢弃并继续调度；仅无 sequence 的初始化错误终止会话 |
| 临时文件检查的 PowerShell `Test-Path` 布尔语法错误 | 1 | 给每个 `Test-Path` 调用加括号后重跑 |
| 尝试启动 API 时 4000 端口已占用 | 1 | 通过前端代理请求 `/api/auth/me` 返回预期 401，确认已有 API 服务正常可达，无需重复启动 |
| 沙箱内生产构建无法读取工作区上级目录，导致 esbuild 无法解析 vite.config.ts | 1 | 使用已批准的 `npm run build` 沙箱外前缀重跑，仅用于构建验证 |
