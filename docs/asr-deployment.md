# 服务端中文语音识别部署

系统使用 `sherpa-onnx-node` 和约 226MB 的 Paraformer INT8 流式中英双语模型。浏览器只采集麦克风并通过同源 WebSocket 上传 PCM 数据，不保存录音，也不调用第三方语音 API。该模型比原先的 25MB CTC 小模型更大，但对“放大、缩小、旋转、停止旋转”等中文短指令的识别可靠得多。

## 1. 安装模型

在项目根目录执行：

```bash
chmod +x scripts/download_asr_model.sh
./scripts/download_asr_model.sh
```

脚本会分别下载并校验模型文件的 SHA-256，默认安装到：

```text
models/asr/sherpa-onnx-streaming-paraformer-bilingual-zh-en
```

生产环境可以传入目标目录：

```bash
./scripts/download_asr_model.sh /opt/huishi/models/asr
```

此时 `.env.local` 中的 `ASR_MODEL_DIR` 也必须设置为 `/opt/huishi/models/asr`。

## 2. 服务配置

```dotenv
NODE_ENV=production
CLIENT_ORIGIN=https://your-domain.example
ASR_ENABLED=true
ASR_MODEL_DIR=/opt/huishi/models/asr
ASR_MAX_SESSIONS=3
ASR_NUM_THREADS=1
ASR_ENDPOINT_SILENCE_SECONDS=1.0
```

2核2GB 服务器保持 `ASR_NUM_THREADS=1` 和 `ASR_MAX_SESSIONS=3`。实测模型进程峰值内存约 800MB；模型在进程启动时只加载一次，每个连接只创建识别流。模型缺失或损坏只会禁用语音功能，不影响其他 API。

安装依赖、构建前端，再裁剪开发依赖并启动服务：

```bash
npm ci
npm run build
npm prune --omit=dev
NODE_ENV=production npm start
```

登录后可检查：

```text
GET /api/asr/health
```

正常结果中的 `available` 应为 `true`。

## 3. HTTPS 与 Nginx

远程网页只有在 HTTPS 下才能稳定取得麦克风权限。Nginx 需要同时代理 HTTP API 和 WebSocket：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:4000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Origin $scheme://$host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 60s;
}
```

如果同一份 Nginx 配置还承载构建后的 `dist/`，请同时参考 [内置 3D 模型的浏览器缓存](./cos-model-storage.md)，为 `/sw.js`、`/index.html` 和 `/models/` 设置相应的缓存响应头。

`CLIENT_ORIGIN` 必须与浏览器地址的协议和域名完全一致，否则 WebSocket 会拒绝连接。用户需使用最新版 Chrome 或 Edge，并允许网站访问麦克风。

## 4. 运行检查

1. 登录系统并打开教学模型页面。
2. 点击语音按钮，状态应变为“服务器语音识别已就绪”。
3. 说“放大”“缩小”“旋转”“停止旋转”，确认临时文字和最终动作正常。
4. 同时打开三路语音连接，第四路应提示“语音识别繁忙”。
5. 服务端日志只能包含用户 ID、连接时长、端点延迟和错误，不应出现音频或识别文字。
