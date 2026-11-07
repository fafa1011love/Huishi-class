// 欢迎页「交互指令」回归：用构建产出的真实 CSS + 源码真实文案常量渲染同一段 DOM，
// 再由无头 Chrome(CDP) 校验文案、字号、行高与裁切。
// 运行：node scripts/verify-intro-instruction.mjs（需先 vite build）
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 4323;
const CDP_PORT = 9334;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = `http://127.0.0.1:${PORT}`;
const SHOT = path.join(ROOT, '.workbuddy', 'tmp', 'intro-instruction-after.png');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf',
};

// 从源码读取真实文案常量，避免验证脚本与实现各写一份而失真
function readInstruction() {
  const src = fs.readFileSync(path.join(ROOT, 'Dashboard.tsx'), 'utf8');
  const m = src.match(/const INTRO_INSTRUCTION\s*=\s*\n?\s*'([\s\S]*?)'\s*;/);
  if (!m) throw new Error('未能从 Dashboard.tsx 解析 INTRO_INSTRUCTION');
  return m[1].replace(/\\n/g, '\n').split('\n');
}

// 从 dist/index.html 解析当前构建的真实 CSS 文件名
function readBuiltCss() {
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');
  const href = [...html.matchAll(/<link[^>]+href="([^"]+\.css)"/g)].map((x) => x[1])[0];
  if (!href) throw new Error('dist/index.html 未找到 CSS 链接（请先 vite build）');
  const rel = href.replace(/^\//, '');
  return { href: rel, css: fs.readFileSync(path.join(DIST, rel), 'utf8') };
}

const EXPECTED_LINES = [
  '单手模式',
  '旋转：食指中指伸直贴合控制旋转，其余手指握拳',
  '缩放：拇食指靠近缩小 | 张开放大，其余手指握拳',
  '拆解：拇食指抓取部位，其余手指伸直',
  '双手模式',
  '左手旋转 / 右手缩放 / 双手均可拆解',
];

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

async function run() {
  const lines = readInstruction();
  const built = readBuiltCss();
  const body = lines.map(escapeHtml).join('<br>');
  const page = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${built.css}</style></head>
<body style="margin:0;position:relative;height:100vh;background:#06131f;overflow:hidden">
<div class="lab-welcome">
  <div class="lab-cube-card"></div>
  <div class="lab-welcome-copy is-ready">
    <h2 class="lab-welcome-title">欢迎来到 <span>数智课堂</span></h2>
    <div class="lab-stream"><b>交互指令：</b><p>${body}</p></div>
  </div>
</div></body></html>`;

  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '/__verify__') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(page);
      return;
    }
    const file = path.resolve(path.join(DIST, urlPath.replace(/^\//, '')));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`验证页已启动：${BASE}（CSS：${built.href}）`);

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), `shuzhi-intro-cdp-${process.pid}`)}`,
    '--window-size=1440,900',
    `${BASE}/__verify__`,
  ], { stdio: 'ignore' });

  let ws;
  try {
    for (let i = 0; i < 80; i += 1) {
      try { if ((await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)).ok) break; } catch { /* not ready */ }
      await sleep(250);
    }
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const target = targets.find((item) => item.type === 'page' && item.url.includes('127.0.0.1'));
    if (!target) throw new Error('未找到页面 target');
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); });

    let seq = 0;
    const pending = new Map();
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!msg.id || !pending.has(msg.id)) return;
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const r = await send('Runtime.evaluate', { expression, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
      return r.result.value;
    };
    await send('Page.enable');
    await send('Runtime.enable');
    for (let i = 0; i < 60; i += 1) {
      if (await evalJs(`!!document.querySelector('.lab-stream p') && document.readyState === 'complete'`)) break;
      await sleep(200);
    }

    const info = await evalJs(`(() => {
      const stream = document.querySelector('.lab-stream');
      const p = stream.querySelector('p');
      const cs = getComputedStyle(stream);
      const pr = p.getBoundingClientRect();
      const sr = stream.getBoundingClientRect();
      return {
        title: stream.querySelector('b').innerText.trim(),
        lines: p.innerText.split('\\n').map((s) => s.trim()).filter(Boolean),
        fontSize: parseFloat(cs.fontSize),
        lineHeight: parseFloat(cs.lineHeight),
        pScrollHeight: p.scrollHeight,
        pClientHeight: p.clientHeight,
        pBottom: pr.bottom,
        streamBottom: sr.bottom,
        viewportHeight: window.innerHeight,
      };
    })()`);

    check('源码文案为 6 行且逐行与需求一致',
      lines.length === EXPECTED_LINES.length && EXPECTED_LINES.every((l, i) => lines[i] === l),
      `${lines.length} 行：${lines.join(' | ')}`);
    check('页面实际渲染 6 行且逐行一致',
      info.lines.length === EXPECTED_LINES.length && EXPECTED_LINES.every((l, i) => info.lines[i] === l),
      `${info.lines.length} 行`);
    check('标题仍为「交互指令：」', info.title === '交互指令：', info.title);
    check('已移除「Single Hand First」与「单手模式优先」',
      !lines.some((l) => l.includes('Single Hand First') || l.includes('单手模式优先')));
    check('双手模式为「左手旋转 / 右手缩放」', lines.includes('左手旋转 / 右手缩放 / 双手均可拆解'));
    check('字号已缩小到 15px 以内', info.fontSize > 0 && info.fontSize <= 15, `${info.fontSize}px`);
    check('行高收紧到 1.55 以内', info.lineHeight / info.fontSize <= 1.55,
      `${(info.lineHeight / info.fontSize).toFixed(2)}`);
    check('正文无内部溢出', info.pScrollHeight <= info.pClientHeight + 1,
      `scroll=${info.pScrollHeight} client=${info.pClientHeight}`);
    check('6 行全部落在视口内、无裁切',
      info.pBottom > 0 && info.pBottom <= info.viewportHeight && info.streamBottom <= info.viewportHeight,
      `p.bottom=${Math.round(info.pBottom)} stream.bottom=${Math.round(info.streamBottom)} viewport=${info.viewportHeight}`);

    fs.mkdirSync(path.dirname(SHOT), { recursive: true });
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(SHOT, Buffer.from(shot.data, 'base64'));
    console.log(`截图：${SHOT}`);
  } finally {
    if (ws) ws.close();
    chrome.kill();
    await new Promise((resolve) => server.close(resolve));
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n结果：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) process.exitCode = 1;
}

run().catch((err) => {
  console.error('验证失败：', err.message);
  process.exitCode = 1;
});
