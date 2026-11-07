// 可视化课堂端到端回归：静态托管 dist + 无头 Chrome(CDP) 真实点击与 iframe 加载验证
// 运行：node scripts/verify-visual-classroom.mjs
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = 4322;
const CDP_PORT = 9333;
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = `http://127.0.0.1:${PORT}`;
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
  '.mp4': 'video/mp4', '.txt': 'text/plain; charset=utf-8',
};

const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'visual-classroom', 'manifest.json'), 'utf8'));
function firstLesson(subjectId, gradeId) {
  const subject = manifest.subjects.find((s) => s.id === subjectId);
  const grade = subject?.grades.find((g) => g.id === gradeId);
  const volume = grade?.volumes[0];
  const chapter = volume?.chapters[0];
  const lesson = chapter?.lessons[0];
  if (!lesson) throw new Error(`manifest 缺少 ${subjectId}/${gradeId} 的课件`);
  return { volume, chapter, lesson };
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  let file = path.resolve(path.join(DIST, urlPath));
  if (!file.startsWith(DIST)) { res.writeHead(403); res.end('forbidden'); return; }
  if (urlPath === '/' || !path.extname(file)) file = path.join(DIST, 'index.html');
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
});

async function waitCdp() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (response.ok) return;
    } catch { /* not ready */ }
    await sleep(250);
  }
  throw new Error('Chrome CDP 端口未就绪');
}

async function run() {
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`静态服务已启动：${BASE}`);

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--no-first-run', '--no-default-browser-check', '--remote-allow-origins=*',
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${path.join(os.tmpdir(), `shuzhi-visual-cdp-${process.pid}`)}`,
    '--window-size=1440,900',
    `${BASE}/#visual`,
  ], { stdio: 'ignore' });

  let ws;
  try {
    await waitCdp();
    const targets = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
    const page = targets.find((item) => item.type === 'page' && item.url.includes('127.0.0.1'));
    if (!page) throw new Error('未找到页面 target');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
    });

    let seq = 0;
    const pending = new Map();
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (!msg.id || !pending.has(msg.id)) return;
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    });
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
    const evalJs = async (expression) => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      }
      return result.result.value;
    };
    const waitFor = async (expression, timeout, label) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const value = await evalJs(`(() => { try { return !!(${expression}); } catch (e) { return false; } })()`);
        if (value) return;
        await sleep(200);
      }
      throw new Error(`等待超时：${label}`);
    };
    const cardTexts = () => evalJs(`[...document.querySelectorAll('button')]
      .filter((b) => b.querySelector('h3') && ['初一','初二','高一','高二','数学','物理'].includes(b.querySelector('h3').textContent.trim()))
      .map((b) => b.innerText)`);
    const clickCard = (label) => evalJs(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.querySelector('h3')?.textContent?.trim() === ${JSON.stringify(label)});
      if (!b) throw new Error('未找到卡片: ' + ${JSON.stringify(label)});
      b.click(); return true;
    })()`);
    const iframeInfo = () => evalJs(`(() => {
      const f = document.querySelector('iframe');
      const doc = f && f.contentDocument;
      const text = doc?.body?.innerText?.trim() || '';
      return { src: f?.src || '', title: doc?.title || '', len: text.length, head: text.slice(0, 60) };
    })()`);
    const waitIframe = async (label) => {
      await waitFor(`!!document.querySelector('iframe')`, 20000, `${label} iframe 出现`);
      await waitFor(`(() => { const f = document.querySelector('iframe'); return !!(f?.contentDocument?.body?.innerText?.trim().length); })()`, 20000, `${label} iframe 内容`);
      return iframeInfo();
    };

    await send('Page.enable');
    await send('Runtime.enable');
    await waitFor(`document.body.innerText.includes('今天想看哪一册')`, 25000, '年级页渲染');

    // 1. 年级页
    const gradeText = await evalJs('document.body.innerText');
    check('年级页显示 4 个年级', ['初一', '初二', '高一', '高二'].every((g) => gradeText.includes(g)));
    check('年级页显示 181 个互动课件', gradeText.includes('181 个互动课件'), gradeText.match(/\d+ 个互动课件/)?.[0]);
    const gradeCards = await cardTexts();
    const g2 = gradeCards.find((t) => t.startsWith('高二'));
    check('高二卡片标注物理学科', !!g2 && g2.includes('物理') && !g2.includes('数学'), g2?.replace(/\n/g, ' | '));
    const g8 = gradeCards.find((t) => t.startsWith('初二'));
    check('初二卡片标注数学+物理', !!g8 && g8.includes('数学') && g8.includes('物理'), g8?.replace(/\n/g, ' | '));

    // 2. 初二 → 学科页
    await clickCard('初二');
    await waitFor(`document.body.innerText.includes('选择学科')`, 12000, '学科页渲染');
    const subjectCards = await cardTexts();
    check('初二学科页有数学与物理两张卡片', subjectCards.length === 2, subjectCards.map((t) => t.split('\n')[0]).join(','));
    check('初二物理卡片显示 43 个课件', subjectCards.some((t) => t.startsWith('物理') && t.includes('43 个课件')));
    check('初二数学卡片显示 32 个课件', subjectCards.some((t) => t.startsWith('数学') && t.includes('32 个课件')));
    check('已移除「更多学科」占位', !(await evalJs('document.body.innerText')).includes('更多学科'));

    // 3. 物理 → 章节页
    await clickCard('物理');
    await waitFor(`document.body.innerText.includes('章节课件')`, 12000, '章节页渲染');
    const chapterText = await evalJs('document.body.innerText');
    check('章节页显示八年级上/下两册', chapterText.includes('八年级上册') && chapterText.includes('八年级下册'));
    check('章节页显示物理主题章节', chapterText.includes('声现象') && chapterText.includes('透镜及其应用'));
    const lessonCount = await evalJs(`document.querySelectorAll('button[title]').length`);
    check('章节页渲染课件卡片', lessonCount > 0, `${lessonCount} 个`);

    // 4. 打开课件 → iframe
    const firstTitle = await evalJs(`(() => { const b = document.querySelector('button[title]'); if (!b) throw new Error('无课件卡片'); b.click(); return b.title; })()`);
    const iframeG8 = await waitIframe('初二物理');
    check('初二物理课件在站内 iframe 播放', iframeG8.src.includes('/visual-classroom/physics/g8/') && iframeG8.len > 0, `${firstTitle} → ${iframeG8.src.split('/').slice(-1)[0]} (${iframeG8.len} 字符)`);

    // 4b. 默认布局：铺满页面可用区域（红框范围）
    const layout = await evalJs(`(() => {
      const frame = document.querySelector('iframe');
      const stage = frame?.parentElement;
      const doc = frame?.contentDocument;
      const r = stage?.getBoundingClientRect();
      return {
        stageWidth: Math.round(r?.width || 0),
        stageHeight: Math.round(r?.height || 0),
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        hasHeader: document.body.innerText.includes('可视化课堂'),
        innerScrollW: doc?.documentElement?.scrollWidth || 0,
        innerClientW: doc?.documentElement?.clientWidth || 0,
        hasCompactButton: [...document.querySelectorAll('button')].some((b) => b.innerText.includes('居中播放')),
      };
    })()`);
    check('默认铺满页面可用区域', layout.stageWidth >= layout.viewportW - 40 && layout.stageHeight >= layout.viewportH * 0.55,
      `stage ${layout.stageWidth}x${layout.stageHeight} / viewport ${layout.viewportW}x${layout.viewportH}`);
    check('顶部标题栏仍可见', layout.hasHeader);
    check('课件内部无横向滚动', layout.innerScrollW <= layout.innerClientW + 2, `scrollWidth ${layout.innerScrollW} / clientWidth ${layout.innerClientW}`);
    check('提供「居中播放」开关', layout.hasCompactButton);

    // 4c. 切为居中卡片
    await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('居中播放')); if (!b) throw new Error('无居中按钮'); b.click(); return true; })()`);
    await waitFor(`[...document.querySelectorAll('button')].some((b) => b.innerText.includes('铺满播放'))`, 8000, '切换居中模式');
    const compactLayout = await evalJs(`(() => { const r = document.querySelector('iframe')?.parentElement?.getBoundingClientRect(); return { w: Math.round(r?.width || 0), h: Math.round(r?.height || 0), hint: document.body.innerText.includes('当前为居中卡片模式') }; })()`);
    check('居中播放收缩为 1200px 卡片', compactLayout.w <= 1200 && compactLayout.w < layout.stageWidth && compactLayout.h <= 820,
      `${compactLayout.w}x${compactLayout.h}（原 ${layout.stageWidth}）`);
    check('居中模式显示切换说明', compactLayout.hint);

    // 4d. 点「铺满播放」恢复
    await evalJs(`(() => { const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('铺满播放')); if (!b) throw new Error('无铺满按钮'); b.click(); return true; })()`);
    await waitFor(`[...document.querySelectorAll('button')].some((b) => b.innerText.includes('居中播放'))`, 8000, '恢复铺满模式');
    const restoredWidth = await evalJs(`Math.round(document.querySelector('iframe')?.parentElement?.getBoundingClientRect().width || 0)`);
    check('点「铺满播放」恢复铺满尺寸', Math.abs(restoredWidth - layout.stageWidth) <= 2, `${restoredWidth} vs ${layout.stageWidth}`);

    // 5. 深链：高二物理必修三
    const g2Entry = firstLesson('physics', 'g2');
    await send('Page.navigate', { url: `${BASE}/?case=g2#visual/g2/physics/a/c01/${encodeURIComponent(g2Entry.lesson.id)}` });
    await waitFor(`location.search.includes('case=g2') && document.querySelector('iframe')?.src.includes('/physics/g2/')`, 25000, '高二深链');
    const iframeG2 = await waitIframe('高二物理');
    const g2ViewerText = await evalJs('document.body.innerText');
    check('高二物理必修三深链可播放', iframeG2.src.includes('/visual-classroom/physics/g2/') && iframeG2.len > 0, `${g2Entry.lesson.name} → ${iframeG2.src.split('/').slice(-1)[0]} (${iframeG2.len} 字符)`);
    check('高二 viewer 显示所属年级', g2ViewerText.includes('高二'));

    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    const shotPath = path.join(ROOT, '.workbuddy', 'tmp', 'visual-viewer-after.png');
    fs.mkdirSync(path.dirname(shotPath), { recursive: true });
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    check('已生成优化后布局截图', fs.statSync(shotPath).size > 20000, `${fs.statSync(shotPath).size} bytes · ${shotPath}`);

    // 6. 深链：高二学科页只有物理
    await send('Page.navigate', { url: `${BASE}/?case=g2subject#visual/g2` });
    await waitFor(`location.search.includes('case=g2subject') && document.body.innerText.includes('选择学科')`, 25000, '高二学科页');
    const g2Cards = await cardTexts();
    check('高二学科页仅物理', g2Cards.length === 1 && g2Cards[0].startsWith('物理'), g2Cards.map((t) => t.split('\n')[0]).join(','));

    // 7. 数学回归
    const mathEntry = firstLesson('math', 'g7');
    await send('Page.navigate', { url: `${BASE}/?case=math#visual/g7/math/a/c01/${encodeURIComponent(mathEntry.lesson.id)}` });
    await waitFor(`location.search.includes('case=math') && document.querySelector('iframe')?.src.includes('/math/g7/')`, 25000, '初一数学深链');
    const iframeMath = await waitIframe('初一数学');
    check('初一数学深链仍可播放', iframeMath.src.includes('/visual-classroom/math/g7/') && iframeMath.len > 0, `${mathEntry.lesson.name} → ${iframeMath.src.split('/').slice(-1)[0]} (${iframeMath.len} 字符)`);

    // 8. HTTP 冒烟
    for (const urlPath of ['/visual-classroom/manifest.json', g2Entry.lesson.url, mathEntry.lesson.url]) {
      const response = await fetch(`${BASE}${urlPath}`);
      check(`HTTP 200 ${urlPath.slice(0, 62)}`, response.ok, String(response.status));
    }
  } finally {
    if (ws) { try { ws.close(); } catch { /* ignore */ } }
    try { chrome.kill(); } catch { /* ignore */ }
    try { await new Promise((resolve) => server.close(resolve)); } catch { /* ignore */ }
  }

  const failed = results.filter((item) => !item.ok);
  console.log(`\n汇总：${results.length - failed.length}/${results.length} 通过`);
  if (failed.length) {
    console.log(`失败项：${failed.map((item) => item.name).join('、')}`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error('验证中断：', error.message);
  try { server.close(); } catch { /* ignore */ }
  process.exitCode = 1;
});
