import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOrchestratorDecision, detectDirectClassroomCommand } from './agentRuntime.ts';

test('open-ended Xiaozhi questions are answered through DeepSeek without echoing the user', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let requestBody: any = null;
  globalThis.fetch = (async (_input, init) => {
    calls += 1;
    requestBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({
      content: JSON.stringify({
        response: '我是小智，由数智课堂系统、语音交互和大模型能力一起组成，专门陪你用3D模型学习。',
        action: 'answer',
        request: '你知道自己怎么来的吗？',
        toolCalls: [],
      }),
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const decision = await buildOrchestratorDecision('你知道自己怎么来的吗？', {
      currentModelId: 'earth_layers',
      currentModelName: '地球内部结构',
      hasModel: true,
      sessionId: 7,
    });

    assert.equal(calls, 1);
    assert.equal(requestBody.task, 'orchestrator');
    assert.equal(requestBody.sessionId, 7);
    assert.equal(decision.action, 'answer');
    assert.doesNotMatch(decision.response, /我听到啦/);
    assert.notEqual(decision.response, '你知道自己怎么来的吗？');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('DeepSeek failures fall back without repeating the user utterance', async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = (async () => new Response(JSON.stringify({ message: 'DeepSeek 未配置' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  })) as typeof fetch;
  console.warn = () => {};

  try {
    const request = '黑洞是什么？';
    const decision = await buildOrchestratorDecision(request);

    assert.equal(decision.action, 'answer');
    assert.doesNotMatch(decision.response, /我听到啦/);
    assert.doesNotMatch(decision.response, /黑洞是什么/);
    assert.match(decision.response, /DeepSeek/);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});

test('pure built-in model navigation switches without starting a teaching demo', async () => {
  const cases = [
    ['切换到心脏模型', 'heart'],
    ['打开地球内部结构', 'earth_layers'],
    ['加载 HIV 模型', 'hiv'],
    ['载入金刚石模型', 'diamond'],
    ['调出心脏模型2', 'biodigital_heart'],
  ] as const;

  for (const [request, modelId] of cases) {
    const decision = await buildOrchestratorDecision(request);
    assert.equal(decision.action, 'switch_model', request);
    assert.equal(decision.modelId, modelId, request);
    assert.deepEqual(decision.toolCalls, [], request);
  }
});

test('teaching words take priority over model navigation words', async () => {
  const cases = [
    ['讲解心脏模型', 'heart'],
    ['介绍地球内部结构', 'earth_layers'],
    ['演示 HIV 模型', 'hiv'],
    ['打开并讲解心脏模型', 'heart'],
    ['切换到地球内部结构并分析一下', 'earth_layers'],
    ['看看金刚石模型', 'diamond'],
    ['展示心脏模型2', 'biodigital_heart'],
  ] as const;

  for (const [request, modelId] of cases) {
    const decision = await buildOrchestratorDecision(request);
    assert.equal(decision.action, 'teach_demo', request);
    assert.equal(decision.modelId, modelId, request);
  }
});

test('switching to the active model remains a direct idempotent switch decision', async () => {
  const decision = await buildOrchestratorDecision('打开地球内部结构', {
    currentModelId: 'earth_layers',
    currentModelName: '地球内部结构',
    hasModel: true,
  });

  assert.equal(decision.action, 'switch_model');
  assert.equal(decision.modelId, 'earth_layers');
  assert.match(decision.response, /已经在展示/);
  assert.deepEqual(decision.toolCalls, []);
});

test('gesture commands map to deterministic on and off tools', () => {
  const enable = detectDirectClassroomCommand('小智，帮我开启手势操纵');
  const disable = detectDirectClassroomCommand('关闭一下手势控制');

  assert.equal(enable?.toolCalls?.[0]?.name, 'enable_gesture');
  assert.equal(disable?.toolCalls?.[0]?.name, 'disable_gesture');
  assert.equal(detectDirectClassroomCommand('把摄像头打开')?.toolCalls?.[0]?.name, 'enable_gesture');
  assert.equal(detectDirectClassroomCommand('摄像头关掉')?.toolCalls?.[0]?.name, 'disable_gesture');
});

test('fullscreen commands map to deterministic enter and exit tools', () => {
  const enterCommands = ['全屏', '进入全屏', '全屏展示', '放大展示', '小智，帮我把模型全屏'];
  const exitCommands = ['取消全屏', '退出全屏', '小屏', '恢复窗口', '小智，切回小屏'];

  for (const command of enterCommands) {
    const decision = detectDirectClassroomCommand(command);
    assert.equal(decision?.action, 'control_model', command);
    assert.equal(decision?.toolCalls?.[0]?.name, 'enter_fullscreen', command);
  }

  for (const command of exitCommands) {
    const decision = detectDirectClassroomCommand(command);
    assert.equal(decision?.action, 'control_model', command);
    assert.equal(decision?.toolCalls?.[0]?.name, 'exit_fullscreen', command);
  }

  assert.equal(detectDirectClassroomCommand('全屏模式怎么使用'), null);
});

test('sidebar navigation commands map to the requested platform', () => {
  const resources = detectDirectClassroomCommand('切换学科资源库');
  const agents = detectDirectClassroomCommand('切换到多智能体平台');

  assert.equal(resources?.toolCalls?.[0]?.name, 'switch_sidebar');
  assert.equal(resources?.toolCalls?.[0]?.args.tab, 'resource');
  assert.equal(agents?.toolCalls?.[0]?.name, 'switch_sidebar');
  assert.equal(agents?.toolCalls?.[0]?.args.tab, 'agent');
  assert.equal(detectDirectClassroomCommand('多智能体是怎么协作的'), null);
});

test('simple 3D control commands stay deterministic and do not call DeepSeek', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('DeepSeek should not be called for direct controls');
  }) as typeof fetch;

  try {
    const zoom = await buildOrchestratorDecision('放大一点');
    const stop = await buildOrchestratorDecision('停止旋转');
    const gesture = await buildOrchestratorDecision('关闭手势');
    const fullscreen = await buildOrchestratorDecision('全屏展示');
    const smallScreen = await buildOrchestratorDecision('恢复窗口');

    assert.equal(zoom.action, 'control_model');
    assert.equal(zoom.toolCalls?.[0]?.name, 'auto_zoom');
    assert.equal(stop.action, 'control_model');
    assert.equal(stop.toolCalls?.[0]?.name, 'auto_rotate');
    assert.equal(stop.toolCalls?.[0]?.args.speed, 0);
    assert.equal(gesture.action, 'control_model');
    assert.equal(gesture.toolCalls?.[0]?.name, 'disable_gesture');
    assert.equal(fullscreen.action, 'control_model');
    assert.equal(fullscreen.toolCalls?.[0]?.name, 'enter_fullscreen');
    assert.equal(smallScreen.action, 'control_model');
    assert.equal(smallScreen.toolCalls?.[0]?.name, 'exit_fullscreen');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
