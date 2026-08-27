import assert from 'node:assert/strict';
import { once } from 'node:events';
import test from 'node:test';
import express from 'express';
import {
  build3dSubmissionDescription,
  buildActivityLogDescription,
  buildActivityLogEntry,
  buildLogPagination,
  MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH,
  MAX_LOG_DESCRIPTION_LENGTH,
  buildSemanticActivityLog,
  createActivityLogMiddleware,
  initializeActivityLog,
  mapActivityAction,
  normalizeIpAddress,
  normalizeLogPagination,
  normalizeOptionalSchool,
  resolveRequestIp,
  resolveTrustProxySetting,
  updateLastAccess,
  validateOptionalSchool,
} from './activityLog.js';

test('normalizes IPv4-mapped IPv6 addresses and never reads X-Forwarded-For directly', () => {
  assert.equal(normalizeIpAddress('::ffff:192.0.2.10'), '192.0.2.10');
  assert.equal(normalizeIpAddress('::ffff:c000:020a'), '192.0.2.10');
  assert.equal(normalizeIpAddress('[2001:db8::1]'), '2001:db8::1');
  assert.equal(normalizeIpAddress('not-an-ip'), null);
  assert.equal(
    resolveRequestIp({
      ip: '::ffff:198.51.100.7',
      headers: { 'x-forwarded-for': '203.0.113.99' },
      socket: { remoteAddress: '192.0.2.1' },
    }),
    '198.51.100.7',
  );
});

test('trusts only loopback proxies in development and one proxy in production by default', () => {
  assert.equal(resolveTrustProxySetting(undefined, false), 'loopback');
  assert.equal(resolveTrustProxySetting(undefined, true), 1);
  assert.equal(resolveTrustProxySetting('0', false), 0);
  assert.equal(resolveTrustProxySetting('2', false), 2);
  assert.equal(resolveTrustProxySetting('-1', true), 1);
  assert.equal(resolveTrustProxySetting('nope', false), 'loopback');
});

test('accepts forwarded client IPs only when the immediate proxy is trusted', async () => {
  const requestIp = async (trustProxy) => {
    const app = express();
    app.set('trust proxy', trustProxy);
    app.get('/', (req, res) => res.json({ ip: resolveRequestIp(req) }));

    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    try {
      const address = server.address();
      const response = await fetch(`http://127.0.0.1:${address.port}`, {
        headers: { 'x-forwarded-for': '203.0.113.99, 198.51.100.7' },
      });
      return (await response.json()).ip;
    } finally {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  };

  assert.equal(await requestIp('loopback'), '198.51.100.7');
  assert.equal(await requestIp(0), '127.0.0.1');
});

test('persists a valid recent IP without erasing it when a later request has no usable address', async () => {
  const updates = [];
  const pool = {
    execute: async (sql, values) => updates.push({ sql, values }),
  };

  await updateLastAccess(pool, { userId: 9, ipAddress: '::ffff:192.0.2.8' });
  await updateLastAccess(pool, { userId: 9, ipAddress: 'not-an-ip' });

  assert.equal(updates.length, 2);
  assert.equal(updates[0].values.ipAddress, '192.0.2.8');
  assert.equal(updates[1].values.ipAddress, null);
  assert.match(updates[0].sql, /last_access_ip = COALESCE\(:ipAddress, last_access_ip\)/);
});

test('trims optional school values, stores blanks as null, and validates the 128-character limit', () => {
  assert.equal(normalizeOptionalSchool('  杭州实验学校  '), '杭州实验学校');
  assert.equal(normalizeOptionalSchool('   '), null);
  assert.equal(normalizeOptionalSchool(undefined), null);
  assert.equal(validateOptionalSchool('a'.repeat(128)).valid, true);
  assert.equal(validateOptionalSchool('a'.repeat(129)).valid, false);
  assert.throws(() => normalizeOptionalSchool(42), /学校需为不超过 128 个字符的文本/);
});

test('maps auth, feedback, profile, admin, and fallback requests to stable actions', () => {
  assert.equal(mapActivityAction({ method: 'POST', path: '/api/auth/register', statusCode: 201 }), 'auth.register');
  assert.equal(mapActivityAction({ method: 'POST', path: '/api/auth/login', statusCode: 401 }), 'auth.login.failure');
  assert.equal(mapActivityAction({ method: 'POST', path: '/api/auth/admin/login', statusCode: 200 }), 'auth.admin.login');
  assert.equal(mapActivityAction({ method: 'POST', path: '/api/feedback', statusCode: 201 }), 'feedback.submit');
  assert.equal(mapActivityAction({ method: 'PATCH', path: '/api/profile', statusCode: 200 }), 'profile.update');
  assert.equal(mapActivityAction({ method: 'PATCH', path: '/api/profile/password', statusCode: 200 }), 'profile.password.update');
  assert.equal(mapActivityAction({ method: 'PATCH', path: '/api/profile/password', statusCode: 400 }), 'profile.password.update.failure');
  assert.equal(mapActivityAction({ method: 'PATCH', path: '/api/admin/users/7/status', statusCode: 200 }), 'admin.user.status.update');
  assert.equal(mapActivityAction({ method: 'DELETE', path: '/api/admin/resource-models/8', statusCode: 204 }), 'admin.resource.model.delete');
  assert.equal(mapActivityAction({ method: 'GET', path: '/api/voice/preferences?x=1', statusCode: 200 }), 'voice.preferences.view');
  assert.equal(mapActivityAction({ method: 'GET', path: '/api/custom/thing', statusCode: 200 }), 'api.get.custom.thing');
});

test('normalizes bounded log pagination and returns total page metadata', () => {
  assert.deepEqual(normalizeLogPagination(undefined, undefined), { page: 1, pageSize: 50, offset: 0 });
  assert.deepEqual(normalizeLogPagination('3', '500'), { page: 3, pageSize: 100, offset: 200 });
  assert.deepEqual(normalizeLogPagination('bad', 'bad'), { page: 1, pageSize: 50, offset: 0 });
  assert.equal(normalizeLogPagination('999999999999999', '100').page, 1_000_000);
  assert.deepEqual(buildLogPagination({ page: 2, pageSize: 50, total: 101 }), {
    page: 2,
    pageSize: 50,
    total: 101,
    totalPages: 3,
  });
  assert.deepEqual(buildLogPagination({ page: 1, pageSize: 50, total: 0 }), {
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 0,
  });
});

test('builds an allow-listed audit record without request body or credential fields', () => {
  const entry = buildActivityLogEntry({
    req: {
      method: 'POST',
      path: '/api/feedback?token=should-not-be-recorded',
      ip: '::ffff:192.0.2.11',
      headers: { 'user-agent': 'test-agent' },
      body: { content: 'private feedback' },
      cookies: { hs_auth: 'private-cookie' },
    },
    statusCode: 201,
    user: { id: 9, username: 'student' },
  });

  assert.deepEqual(entry, {
    userId: 9,
    usernameSnapshot: 'student',
    action: 'feedback.submit',
    description: '用户提交了使用反馈',
    method: 'POST',
    path: '/api/feedback',
    statusCode: 201,
    ipAddress: '192.0.2.11',
    userAgent: 'test-agent',
  });
  assert.equal('body' in entry, false);
  assert.equal('cookies' in entry, false);
  assert.equal('authorization' in entry, false);
});

test('builds readable semantic descriptions from fixed event payloads', () => {
  assert.deepEqual(buildSemanticActivityLog({
    type: 'model.switch',
    payload: { fromModel: '心脏模型1', toModel: '地球内部结构', source: 'ai' },
  }), {
    action: 'model.switch',
    description: '用户通过小智从“心脏模型1”切换到了 3D 模型“地球内部结构”',
    payload: { fromModel: '心脏模型1', toModel: '地球内部结构', source: 'ai' },
  });

  assert.equal(
    buildSemanticActivityLog({
      type: 'xiaozhi.conversation',
      payload: { userText: '  请介绍地球\n内部结构  ', assistantText: '地球由地壳、地幔、外核和内核组成。' },
    }).description,
    '用户与小智完成了一轮对话：用户说“请介绍地球 内部结构”；小智回答“地球由地壳、地幔、外核和内核组成。”',
  );

  assert.equal(
    buildSemanticActivityLog({ type: 'gesture.part.move', payload: { modelName: '地球内部结构', partName: '地幔' } }).description,
    '用户通过手势抓取、移动并释放了模型“地球内部结构”的部件“地幔”',
  );
  assert.equal(
    buildSemanticActivityLog({ type: 'gesture.mode.switch', payload: { mode: 'dual' } }).description,
    '用户将手势交互模式切换为双手模式',
  );
});

test('rejects unknown event types, extra fields, and malformed values', () => {
  assert.throws(
    () => buildSemanticActivityLog({ type: 'feedback.submit', payload: {} }),
    /不支持的行为事件类型/,
  );
  assert.throws(
    () => buildSemanticActivityLog({
      type: 'gesture.mode.switch',
      payload: { mode: 'single', description: '客户端伪造的说明' },
    }),
    /包含不支持的字段/,
  );
  assert.throws(
    () => buildSemanticActivityLog({
      type: 'xiaozhi.conversation',
      payload: { userText: '你好', assistantText: '' },
    }),
    /小智回答内容不能为空/,
  );
  assert.throws(
    () => buildSemanticActivityLog({
      type: 'gesture.mode.switch',
      payload: { mode: 'two-hands' },
    }),
    /交互模式必须是 single 或 dual/,
  );
});

test('keeps both sides of an oversized Xiaozhi conversation visible within the description limit', () => {
  const event = buildSemanticActivityLog({
    type: 'xiaozhi.conversation',
    payload: {
      userText: `用户片段${'U'.repeat(MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH * 3)}`,
      assistantText: `助手片段${'A'.repeat(MAX_ACTIVITY_CONVERSATION_TEXT_LENGTH * 3)}`,
    },
  });
  const entry = buildActivityLogEntry({
    req: { method: 'POST', path: '/api/activity-events' },
    statusCode: 204,
    action: event.action,
    description: event.description,
    user: null,
  });

  assert.ok(Array.from(entry.description).length <= MAX_LOG_DESCRIPTION_LENGTH);
  assert.match(entry.description, /用户与小智完成了一轮对话/);
  assert.match(entry.description, /用户片段/);
  assert.match(entry.description, /；小智回答“/);
  assert.match(entry.description, /助手片段/);
  assert.match(entry.description, /…/);
});

test('does not include image data or raw image addresses in 3D descriptions', () => {
  const imageBase64 = 'data:image/png;base64,' + 'A'.repeat(200);
  const imageUrl = 'https://private.example/image.png?token=secret';
  const description = build3dSubmissionDescription({ image: true });
  assert.equal(description, '用户使用了图生 3D');
  assert.equal(description.includes(imageBase64), false);
  assert.equal(description.includes(imageUrl), false);
  assert.equal(
    build3dSubmissionDescription({ prompt: '  一只\n可爱的猫  ' }),
    '用户使用了文生 3D，提示词：“一只 可爱的猫”',
  );
});

test('returns deterministic Chinese fallback descriptions for legacy rows', () => {
  assert.equal(
    buildActivityLogDescription({ action: 'admin.logs.view', method: 'GET', path: '/api/admin/logs' }),
    '管理员查看了操作日志',
  );
  assert.equal(
    buildActivityLogDescription({ action: 'profile.password.update.failure', method: 'PATCH', path: '/api/profile/password', statusCode: 400 }),
    '用户修改了登录密码（请求未成功）',
  );
  assert.equal(
    buildActivityLogEntry({ req: { method: 'GET', path: '/api/admin/logs' }, statusCode: 200, user: null }).description,
    '管理员查看了操作日志',
  );
});

test('semantic requests reuse one middleware audit entry with the server description', async () => {
  let finishHandler;
  const inserts = [];
  const pool = {
    execute: async (sql, values) => {
      if (sql.startsWith('INSERT INTO activity_logs')) inserts.push({ sql, values });
    },
  };
  const middleware = createActivityLogMiddleware({ getPool: () => pool });
  const req = {
    method: 'POST',
    path: '/api/activity-events',
    activityLogLogAnonymous: true,
    activityLogAction: 'gesture.mode.switch',
    activityLogDescription: '用户将手势交互模式切换为单手模式',
  };
  const res = {
    statusCode: 204,
    once: (_event, handler) => { finishHandler = handler; },
  };

  middleware(req, res, () => {});
  finishHandler();
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].values.action, 'gesture.mode.switch');
  assert.equal(inserts[0].values.description, '用户将手势交互模式切换为单手模式');
  assert.equal(inserts[0].sql.includes('request.body'), false);
});

test('adds the nullable description column without rewriting existing activity rows', async () => {
  const queries = [];
  const pool = {
    query: async (sql) => {
      queries.push(sql);
      if (sql.startsWith('SHOW COLUMNS FROM activity_logs')) return [[]];
      return [[]];
    },
  };

  await initializeActivityLog(pool);

  assert.equal(queries.some((sql) => sql.includes('description TEXT NULL')), true);
  assert.equal(queries.some((sql) => sql.includes('ALTER TABLE activity_logs ADD COLUMN description TEXT NULL AFTER action')), true);
  assert.equal(queries.some((sql) => sql.includes('DELETE FROM activity_logs')), false);
});
