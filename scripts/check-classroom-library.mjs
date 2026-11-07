import { chromium } from '../../teacher-studio/frontend/node_modules/playwright/index.mjs';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const base = process.env.CLASSROOM_CHECK_URL || 'http://127.0.0.1:3017';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const errors = [];
page.on('pageerror', error => { errors.push(error.message); console.error('PAGE:', error.message); });
const source = `
import React from '/node_modules/.vite/deps/react.js';
import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
import Dashboard from '/Dashboard.tsx';
import {ThemeProvider} from '/components/ThemeProvider.tsx';
import '/index.css';
ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><Dashboard playIntro={false} currentUser={{id:999999,name:'课堂测试',username:'classroom-check',role:'teacher'}} onLogout={()=>{}} onBack={()=>{}} /></ThemeProvider>);`;
const compiled = await transform(source, { loader: 'jsx', format: 'esm' });
const manifest = {
  version: 1, lessonId: 'check-a', title: '课堂甲课件', revision: 1, status: 'ready',
  model: { modelUrl: '', parts: [], defaultMode: 'appearance', observationTasks: [] }, assets: [], questions: [],
  scenes: [{ id: 'scene-1', enabled: true, type: 'hook', layout: 'cinematic-question', title: '课堂甲独有内容', claim: '甲的教学结论', studentAction: '甲的观察任务', expectedOutput: '甲的学习记录', motion: { preset: 'fade', durationMs: 250 } }],
};
const draft = {
  title: '课堂甲教师教案', courseName: '观察课', duration: 40, overview: '用于课堂观察与交流。', objectives: ['能够描述观察结果'],
  keyPoints: ['观察证据'], difficulties: ['解释证据'], teacherPreparation: ['准备图片'], studentPreparation: ['阅读教材'],
  process: [{ name: '观察与交流', minutes: 40, teacherActivity: '引导观察', studentActivity: '记录并交流', question: '你观察到了什么？', check: '检查记录' }],
  homework: ['整理记录'], blackboardDesign: ['证据与结论'], references: [],
};
const workflow = { version: 2, status: 'approved', qualityPending: false, quality: { blocking: [] }, staleSteps: [], steps: [{ approved: true, status: 'ready' }] };
let records = [
  { id: 'check-a', title: '课堂甲', updatedAt: new Date().toISOString(), plan: { id: 'check-a', title: '课堂甲', request: {}, designWorkflow: workflow, warmupQuestions: [], classroomData: { courseware: manifest, review: { draft, quality: { valid: true, blocking: [] }, confirmed: true } } } },
  { id: 'check-b', title: '课堂乙', updatedAt: new Date().toISOString(), plan: { id: 'check-b', title: '课堂乙', request: {}, designWorkflow: workflow, classroomData: { courseware: { ...manifest, lessonId: 'check-b', title: '课堂乙课件', scenes: [{ ...manifest.scenes[0], title: '课堂乙独有内容' }] } } } },
];
let pptCalls = 0;
await page.route('**/__classroom_check', route => route.fulfill({ contentType: 'text/html', body: `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0"><div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/__classroom_check.js');</script></body></html>` }));
await page.route('**/__classroom_check.js', route => route.fulfill({ contentType: 'application/javascript', body: compiled.code }));
await page.route('**/api/**', async route => {
  const url = new URL(route.request().url());
  const pathname = url.pathname;
  if (pathname === '/api/lesson-plans') {
    if (route.request().method() === 'POST') {
      const { plan } = route.request().postDataJSON();
      records = records.map(record => record.id === plan.id ? { ...record, plan } : record);
      return route.fulfill({ json: { id: plan.id } });
    }
    return route.fulfill({ json: { records } });
  }
  if (pathname.endsWith('/prepare-views')) return route.fulfill({ json: { status: 'not-required' } });
  if (pathname.endsWith('/export-pptx')) {
    pptCalls++;
    const body = route.request().postDataJSON();
    assert.equal(body.manifest.lessonId, 'check-a');
    assert.equal(body.manifest.scenes[0].title, '课堂甲独有内容');
    return route.fulfill({ json: { fileName: '课堂甲.pptx', downloadUrl: '/api/prep/courseware/download/check.pptx', aligned: true, sceneCount: 1, slideCount: 1, animation: { verified: true } } });
  }
  if (pathname.endsWith('/download/check.pptx')) return route.fulfill({ contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', headers: { 'Content-Disposition': 'attachment; filename="check.pptx"' }, body: 'test-pptx-download' });
  if (pathname.endsWith('/prepare-export')) return route.fulfill({ json: { draft, quality: { valid: true, blocking: [] } } });
  return route.fulfill({ json: { tags: [], models: [], memories: [], settings: {}, records: [] } });
});

try {
  await mkdir('outputs/classroom-library-check', { recursive: true });
  await page.goto(`${base}/__classroom_check`);
  await page.getByRole('button', { name: '课堂甲', exact: true }).click();
  await page.getByRole('status').filter({ hasText: '本课堂尚未生成模型' }).waitFor();
  const toolbar = page.locator('.lab-stage-tools');
  await toolbar.getByRole('button', { name: '导出教案', exact: true }).waitFor();
  assert.equal(await page.locator('.lab-sidebar').getByRole('button', { name: '导出教案', exact: true }).count(), 0);
  let downloading = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: '导出教案', exact: true }).click();
  assert.match((await downloading).suggestedFilename(), /教案\.docx$/);
  downloading = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: '导出 PPT', exact: true }).click();
  await downloading;
  downloading = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: '导出 PPT', exact: true }).click();
  await downloading;
  assert.equal(pptCalls, 1, 'unchanged courseware reuses the cached PPT');
  await toolbar.getByRole('button', { name: '课件', exact: true }).click();
  await page.getByRole('heading', { name: '课堂甲独有内容', exact: true }).waitFor();
  await page.getByRole('button', { name: '退出互动课件' }).click();
  await page.getByRole('status').filter({ hasText: '本课堂尚未生成模型' }).waitFor();
  await page.screenshot({ path: 'outputs/classroom-library-check/desktop.png' });
  await page.getByRole('button', { name: '课堂乙', exact: true }).click();
  await toolbar.getByRole('button', { name: '课件', exact: true }).click();
  await page.getByRole('heading', { name: '课堂乙独有内容', exact: true }).waitFor();
  assert.equal(await page.getByRole('heading', { name: '课堂甲独有内容', exact: true }).count(), 0);
  await page.getByRole('button', { name: '退出互动课件' }).click();
  await toolbar.getByRole('button', { name: '导出教案', exact: true }).click();
  await page.getByRole('dialog', { name: '审核并导出教案' }).waitFor();
  await page.getByRole('button', { name: '确认审核', exact: true }).click();
  await page.getByRole('button', { name: '导出 Word', exact: true }).waitFor();
  await page.getByRole('button', { name: '关闭审核窗口' }).click();
  await page.reload();
  await page.getByRole('status').filter({ hasText: '本课堂尚未生成模型' }).waitFor();
  assert.equal(await page.getByRole('button', { name: '课堂乙', exact: true }).count(), 1);
  downloading = page.waitForEvent('download');
  await toolbar.getByRole('button', { name: '导出教案', exact: true }).click();
  await downloading;
  assert.equal(await page.getByRole('dialog', { name: '审核并导出教案' }).count(), 0, 'confirmed review survives a reload');
  await page.setViewportSize({ width: 390, height: 844 });
  const box = await toolbar.boundingBox();
  assert.ok(box && box.x >= 0 && box.x + box.width <= 391);
  await toolbar.getByRole('button', { name: '导出 PPT', exact: true }).scrollIntoViewIfNeeded();
  const pptBox = await toolbar.getByRole('button', { name: '导出 PPT', exact: true }).boundingBox();
  assert.ok(pptBox && pptBox.y >= 0 && pptBox.y + pptBox.height <= 844);
  await page.screenshot({ path: 'outputs/classroom-library-check/mobile.png' });
  assert.deepEqual(errors, []);
  console.log('PASS: toolbar placement, no-model message, Word download, PPT cache, classroom isolation, review persistence, reload and mobile bounds');
} catch (error) {
  console.error((await page.locator('body').innerText()).slice(0, 3000));
  await page.screenshot({ path: 'outputs/classroom-library-check/failure.png' });
  throw error;
} finally { await browser.close(); }
