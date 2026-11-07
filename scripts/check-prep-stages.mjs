import { chromium } from '../../teacher-studio/frontend/node_modules/playwright/index.mjs';
import { transform } from 'esbuild';
import assert from 'node:assert/strict';

// Mock generation so this UI regression check never submits a paid AI/model job.
const base = process.env.CLASSROOM_CHECK_URL || 'http://127.0.0.1:3017';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message); });
  const compiled = await transform(`
    import React from '/node_modules/.vite/deps/react.js';
    import ReactDOM from '/node_modules/.vite/deps/react-dom_client.js';
    import PrepStudio from '/prep/PrepStudio.tsx';
    import { ThemeProvider } from '/components/ThemeProvider.tsx';
    import '/prep/prep-styles.css';
    ReactDOM.createRoot(document.getElementById('root')).render(<ThemeProvider><PrepStudio onBack={()=>{}} /></ThemeProvider>);
  `, { loader: 'jsx', format: 'esm' });
  await page.route('**/__prep_stage_check', route => route.fulfill({ contentType: 'text/html', body: `<div id="root"></div><script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;await import('/__prep_stage_check.js');</script>` }));
  await page.route('**/__prep_stage_check.js', route => route.fulfill({ contentType: 'application/javascript', body: compiled.code }));
  const requests = [];
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/lesson/preview') || path.endsWith('/generate-draft')) {
      requests.push({ path, body: route.request().postDataJSON() });
      return route.fulfill({ status: 400, json: { error: '测试请求已捕获，未调用生成服务' } });
    }
    return route.fulfill({ json: path === '/api/lesson-plans' ? { records: [] } : { blenderAvailable: true, singleImage: { available: true } } });
  });
  await page.goto(`${base}/__prep_stage_check`);
  const stage = page.getByLabel(/^学段/);
  await stage.waitFor({ state: 'visible' });
  assert.deepEqual(await stage.locator('option').allTextContents(), ['小学', '初中', '高中', '本科']);
  for (const [value, grade, templateStage] of [['小学', '三年级', '小学1-3年级'], ['小学', '六年级', '小学4-6年级'], ['初中', '九年级', '初中'], ['高中', '高三', '高中']]) {
    await stage.selectOption(value);
    await page.getByLabel(/^年级/).selectOption(grade);
    const expectedSubjects = value === '小学'
      ? ['请选择学科', '语文', '数学', '英语']
      : ['请选择学科', '语文', '数学', '英语', '物理', '化学', '生物学', '历史', '地理', value === '高中' ? '思想政治' : '道德与法治', '体育与健康'];
    assert.deepEqual(await page.getByLabel(/^学科/).locator('option').allTextContents(), expectedSubjects);
    await page.getByLabel(/^学科/).selectOption('数学');
    await page.getByLabel('课题名称', { exact: false }).fill('函数');
    assert.equal(await page.getByLabel(/^课型/).isVisible(), false);
    await page.getByText('更多课程信息', { exact: true }).click();
    assert.equal(await page.getByLabel(/^课型/).isVisible(), true);
    await page.getByLabel(/^节数/).selectOption('2');
    assert.equal(await page.getByLabel(/^总时长/).inputValue(), '80');
    await page.getByLabel(/^总时长/).selectOption('120');
    assert.equal(await page.getByLabel(/^节数/).inputValue(), '3');
    assert.equal(await page.getByLabel('课时（分钟）', { exact: true }).count(), 0);
    assert.equal(await page.getByLabel('专业名称', { exact: false }).count(), 0);
    await page.getByRole('button', { name: '生成教案', exact: true }).click();
    await Promise.all([
      page.waitForResponse(response => response.url().endsWith('/lesson/preview')),
      page.getByRole('button', { name: '暂不建模，继续生成', exact: true }).click(),
    ]);
    const last = requests.at(-1);
    assert.equal(last.body.stage, value);
    assert.equal(last.body.grade, grade);
    assert.equal(last.body.subject, '数学');
    assert.equal(last.body.templateStage, templateStage);
    assert.equal(last.body.lessonCount, 3);
    assert.equal(last.body.duration, 120);
    await page.getByText('更多课程信息', { exact: true }).click();
  }
  await stage.selectOption('本科');
  await page.getByLabel('专业名称', { exact: false }).fill('生物医学');
  await page.getByLabel(/^节数/).selectOption('3');
  assert.equal(await page.getByLabel(/^总时长/).inputValue(), '120');
  await page.getByRole('button', { name: '生成教案', exact: true }).click();
  await Promise.all([
    page.waitForResponse(response => response.url().endsWith('/generate-draft')),
    page.getByRole('button', { name: '暂不建模，继续生成', exact: true }).click(),
  ]);
  assert.equal(requests.at(-1).body.request.stage, '本科');
  assert.equal(requests.at(-1).body.mode, 'quick');
  await stage.selectOption('小学');
  assert.equal(await page.getByLabel(/^学科/).getByRole('option', { name: '科学' }).count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  const viewportFit = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.equal(viewportFit, true);
  assert.equal(await page.getByLabel(/^节数/).isVisible(), true);
  assert.equal(await page.getByLabel(/^总时长/).isVisible(), true);
  assert.deepEqual(errors, []);
  console.log('PASS: K12 stages, grades, duration and legacy endpoint; undergraduate quick draft and duration linkage');
} finally {
  await browser.close();
}
