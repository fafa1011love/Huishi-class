# 数智课堂当前版本上线交接

更新日期：2026-11-08
目标分支：`main`
适用范围：当前工作区合并后的版本，包含模型生成额度、备课与课堂工具改动，以及 GitHub `origin/main` 上已合入的可视化课堂和资源整理更新。

## 1. 交接结论

当前版本已实现并通过本地前端生产构建、备课相关前端测试、模型额度单元测试和 K12/课件 Python 测试。该结果不等于已经部署到生产环境：生产服务器、线上 MySQL、真实第三方模型密钥和线上用户流程尚未在本次验证。

上线前应确保 Node API 与 Python 备课服务均重启到同一提交，并确认 Node API 使用正确的 MySQL 数据库。模型额度表由 Node API 启动时自动创建。不要重置或清空额度表；上线后首次初始化的用户从 3 次开始，不追溯历史模型生成记录。

## 2. 已实现功能与边界

### 2.1 免费模型生成额度

- 普通用户每个账号有 3 次免费模型生成额度，不按月或其他周期恢复。
- 管理员 `role === 'admin'` 不扣额度，两个建模 UI 中也隐藏额度提示。
- 额度按用户 `user_id` 记录。首次查询或首次提交时通过 `INSERT IGNORE` 创建记录，`total=3`、`used=0`；因此已经存在的账号也从本功能上线后重新开始，不回算旧历史。
- 单图生成、四视图生成、单图/四视图任务的重新处理各扣 1 次。生成任务一旦被服务端接受，即使后续模型生成失败，也不退次数。
- 请求格式错误、上游明确以 4xx 拒绝，以及生成服务无法连接而未接受请求时，当前逻辑退还预扣次数。
- 导入已有模型不扣次。生成教案、练习题、互动课件、Word/PPT 导出也不扣此额度；额度只限制模型生成与重新处理。
- 额度用完后服务端返回 `403`、错误码 `MODEL_QUOTA_EXHAUSTED` 和“免费生成次数已用完，请联系管理员”；前端禁用生成/重新处理入口并展示联系管理员提示。
- 额度读取失败或尚未取得结果时，UI 不猜测剩余数字，显示额度状态暂不可用并说明提交仍由服务端校验。
- 没有管理员额度配置页面、付费购买、用户自助申请或自动补次数功能。管理员调整需要由有权限的运维人员直接处理数据，并记录原因。

相关位置：

- 数据表、鉴权接口、扣次与生成任务入口：`server/index.js`
- 原子扣次、读取、退款逻辑：`server/modelGenerationQuota.js`
- 备课建模提示与按钮：`prep/PrepStudio.tsx`、`prep/prep-styles.css`
- 独立建模工作区提示：`components/IntegratedModelingStudio.tsx`、`index.css`
- 用户角色传递：`Dashboard.tsx`、`prep/IntegratedPrepStudio.tsx`
- 核心 API：`GET /api/models/generation-quota`、`POST /api/models/jobs/single-image`、`POST /api/models/jobs/multiview`、`POST /api/models/:id/reprocess`；备课代理生成入口位于 `/api/prep/3d/generate-image` 与 `/api/prep/3d/generate-multiview-model`。

### 2.2 内置模型侧边栏复位

- 仅在当前选中的内置模型 `sourceKind === 'builtin'`，且查看器确认模型有多个可拆部件并支持归位时显示复位图标。
- 智能课堂生成模型、不可拆分的单网格模型、单向拆解但不能归位的模型不显示。
- 点击调用现有拆解复位逻辑，只恢复部件布局，不重新下载/挂载模型，不重置镜头角度或缩放。
- 实现位置：`Dashboard.tsx`；按钮在模型侧边栏当前选中条目附近，工作区工具条也有对应复位入口。

### 2.3 备课与模型工作区

- 备课流程支持本科以及 K12 学段；K12 年级、学科和教材选项由 `services/k12Template.ts` 管理，课时数/总时长由 `services/lessonSchedule.ts` 归一化。
- 本科继续使用设计工作流；K12 请求路由至 K12 教案预览/生成处理，并允许在 AI 不可用时按现有服务策略回退或提示失败。不要将两种学段的请求结构互换。
- 备课 UI、步骤与数据映射主要在 `prep/PrepStudio.tsx`；集成容器在 `prep/IntegratedPrepStudio.tsx`。
- 独立建模入口在 `components/IntegratedModelingStudio.tsx`。图片生成由服务端配置的混元 3D 服务处理；不要绕过服务端额度校验直接调用第三方服务。
- 额度只限制模型生成，不限制本地上传/导入已有模型、课堂编辑或内容导出。

### 2.4 教案、课堂库和互动课件

- `services/classroomLibrary.ts` 负责课堂内容归一化、指纹和持久化数据整理；页面集成在 `components/ClassroomLibrary.tsx`。
- 课堂库操作包含打开课堂、打开已保存互动课件、审核/确认教案、导出 Word 与导出配套 PPT。课件读取失败或不存在时应提示先回到备课生成，不应伪造可用数据。
- 课堂课件按 lesson id 通过已鉴权 API 读取/保存，入口在 `server/index.js` 的 `/api/courseware/:lessonId` 路由。教案持久化通过 `/api/lesson-plans`。
- 对教案实质内容修改会使关联课件/PPT 指纹失效；审核状态、模型临时 object URL 刷新等不应误删无关课堂数据。具体规则由 `services/classroomLibrary.ts` 和对应测试固定。
- Word 导出以教师审核确认的数据为准；未经确认、过期或质量检查失败的内容不能按已确认稿导出。生成逻辑与页面位于 `services/lessonWordExport.ts`、`prep/LessonExportPage.tsx`。
- 配套 PPT 导出校验课件阻断问题及课件页/PPT 页一致性。当前合并后的 Python 服务返回页数/对齐报告；不要把“有动画并逐页验收通过”作为本版本保证，除非服务端显式返回动画验收报告。

### 2.5 可视化课堂与其他更新

- 可视化课堂入口由 `App.tsx` 与 `Dashboard.tsx` 接入，页面为 `VisualClassroom.tsx`，课程目录通过 `services/visualClassroom.ts` 读取 `public/visual-classroom/manifest.json` 和对应静态 HTML。
- 目录数据与实际静态文件必须一起发布；只部署 manifest 或只部署 HTML 都会造成缺课件/资源错误。部分条目可能标注需要联网或资源缺失，按页面提示处理。
- 远端合入的欢迎页交互提示优化、视觉课堂内容和资产清理也属于当前 `main` 版本。GitHub 近期历史包含旧文档、截图和部分大体积模型资源清理；不要从旧备份批量恢复被删除的资源，除非明确确认运行时仍引用它们。

## 3. 数据结构与生命周期

| 数据 | 存储位置 | 关键字段/标识 | 生命周期与注意事项 |
| --- | --- | --- | --- |
| 用户模型免费额度 | MySQL `user_model_generation_quotas` | `user_id` 主键、`total`、`used`、`updated_at` | 首次查询/生成时创建；用户删除时外键级联删除；不要因普通部署重跑而清表。 |
| 模型生成任务 | MySQL `user_model_jobs` | 任务 `id`、`user_id`、`mode`、`status`、`created_at`、`updated_at` | 状态包括 queued/processing/completed/failed；客户端轮询任务状态。失败任务不自动返还已接受任务的额度。 |
| 模型文件及衍生资源 | 服务端模型存储/生成目录，记录关联用户与任务 | model/job id、资源 URL、文件类型 | 生产环境需配置持久化磁盘/对象存储和下载 URL 重写；临时目录不可作为长期文件存储。 |
| 教案 | MySQL lesson-plan API | lesson id 与 plan JSON | 通过鉴权接口读写；避免在发布时清空已有课堂记录。 |
| 互动课件 | MySQL 课件 API/对应 manifest | `lessonId`、scene 列表、模型/视图引用 | 修改课程内容后重新生成或复核；跨 lesson 复用 manifest 是错误。 |
| 可视化课堂目录 | 静态文件 `public/visual-classroom/` | manifest 中的课程/章节/课件路径 | 与前端静态资源一起版本化、构建及部署。 |

额度扣减使用条件更新：`used = used + 1 WHERE used < total`，成功更新一行才算预留成功，避免并发超扣。新部署不要对旧用户按已有任务量回填 `used`。

## 4. 主要配置与启动依赖

参考 `.env.example`，生产密钥只配置在部署平台或服务器的环境变量中，不要写入仓库或交接文件。

- `API_PORT`：Node API 端口，示例为 `4000`。
- `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE`：Node API 数据库连接。启动账户需能创建/维护应用表，且 `users(id)` 与额度表外键类型兼容。
- `TEACHER_STUDIO_SERVICE_URL`：Python 备课服务地址，示例为 `http://127.0.0.1:8765`。
- `TEACHER_STUDIO_AUTOSTART`、`TEACHER_STUDIO_PYTHON`：本机开发可由 Node 拉起 Python 服务；生产环境要确认部署策略、Python 路径和服务健康检查，不要假定开发机路径可用。
- `HUNYUAN3D_BASE_URL`、`HUNYUAN3D_API_KEY`、`HUNYUAN3D_MODEL`：图片转 3D 服务配置。密钥缺失或服务不可用时模型生成不可用；额度查询仍可工作。
- `JWT_SECRET`：必须使用生产专用强随机密钥。轮换会影响已有登录会话。
- `LESSON_AI_API_KEY`、`LESSON_AI_BASE_URL`、`LESSON_AI_MODEL`：可选的课程 AI 配置；按实际 provider 配置。未配置时按各生成路径的回退/错误策略工作。

正常发布顺序：备份数据库和上传资源 → 拉取目标提交 → 安装锁文件依赖 → 设置服务端环境变量 → 启动 MySQL → 启动/重启 Python 备课服务 → 启动/重启 Node API → 检查健康状态和日志 → 用普通账号与管理员账号做冒烟测试 → 再向教师开放。

必须重启 Node API：额度表初始化和新路由在 Node 进程启动时生效。只刷新浏览器或只发布静态前端，不能启用服务端扣次控制。若 4000 端口仍由旧进程占用，需确认该进程已加载当前提交后再验收，不能把旧进程返回的行为当作新版本。

## 5. 上线验收清单

- 普通账号登录后，备课建模与独立建模页面均显示清晰额度提示及服务端真实余额。
- 管理员账号两处均不显示额度提醒，生成不扣次数。
- 新普通账号及上线前已有账号首次查询均为 `3/3`；已有历史生成不计入 `used`。
- 依次提交单图、四视图和重新处理，额度分别减少一次；额度为零后不能再创建任务，响应 `403 MODEL_QUOTA_EXHAUSTED`。
- 并发请求最多接受剩余额度数量的生成任务；检查任务表与额度表一致。
- 导入已有模型、生成教案、练习题、互动课件、Word/PPT 不改变额度。
- 无效格式/服务无法连接时核验预扣已退还；生成服务接受任务后再失败时不退还。
- 复位按钮只在支持归位的已选内置可拆分模型出现，点击后相机视角与缩放保持。
- 可视化课堂随机抽查 manifest 条目和静态 HTML 文件；课堂库刷新后检查教案及课件关联没有串课。
- Word 与 PPT 下载文件名、内容、页数及服务端资源 URL 可从真实部署环境访问。

## 6. 已做验证与未验证项

本次本地验证结果：

- `npm run build`：通过。仍有已有的大 JS chunk 体积警告，不阻断构建。
- `npm run test:prep`：52 项通过。
- `node --test server/modelGenerationQuota.test.js`：4 项通过，覆盖初始化、原子扣减、并发上限和退款。
- `py -3 -m unittest test_k12_generation test_courseware_layout`：13 项通过。
- `git diff --check`：通过；Windows 提示部分文件会按仓库换行设置转换 LF/CRLF，不是内容错误。

本次没有连接生产数据库/真实 Hunyuan 账户，也没有执行生产部署或生产账号端到端测试。发布负责人必须完成上一节的线上冒烟检查。当前 PPT 服务返回页数和对齐报告；动画验收不是本版本上线承诺。

## 7. 后续维护限制

- 如需增加免费额度或人工补次数，必须通过后台运维 SQL/脚本审计操作；不要在前端伪改余额，也不要用重置全表的方法解决单用户问题。
- 若计划改变额度规则（周期重置、按角色不同、计入旧任务、失败退款），需同时改数据库策略、所有模型生成入口、管理员豁免和前端提示，并补并发/失败测试。
- 新增任何图片转模型路由时，先确认是否属于“模型生成”，并将鉴权、原子扣次、管理员豁免、退款与错误码纳入测试；导入模型路由要保持免扣。
- 不要记录或提交数据库密码、JWT、Hunyuan/API 密钥、生产用户个人数据或实际普通用户账号密码。
- GitHub push 不代表生产部署完成；确认 CI、发布平台和生产进程确实已更新后，才能对外宣称上线。
