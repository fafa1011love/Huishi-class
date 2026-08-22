import assert from 'node:assert/strict';
import test from 'node:test';
import { logUserActivity } from './userActivityLog.ts';

test('posts only the fixed semantic event envelope', async () => {
  const originalFetch = globalThis.fetch;
  let requestInit: RequestInit | undefined;

  globalThis.fetch = async (_input, init) => {
    requestInit = init;
    return { ok: true, status: 204 } as Response;
  };

  try {
    await logUserActivity({
      type: 'gesture.mode.switch',
      payload: { mode: 'dual' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestInit?.method, 'POST');
  assert.equal(requestInit?.credentials, 'include');
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    type: 'gesture.mode.switch',
    payload: { mode: 'dual' },
  });
  assert.equal(String(requestInit?.body).includes('description'), false);
  assert.equal(String(requestInit?.body).includes('ImageBase64'), false);
});

test('does not throw when the best-effort endpoint fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 503, json: async () => ({ message: '暂不可用' }) } as Response);

  try {
    await assert.doesNotReject(() => logUserActivity({
      type: 'gesture.part.move',
      payload: { modelName: '地球内部结构', partName: '地幔' },
    }));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
