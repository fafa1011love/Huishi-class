import assert from 'node:assert/strict';
import test from 'node:test';
import { __test__, createVolcTtsService } from './volcTts.js';

test('encodes and decodes a protocol event frame', () => {
  const frame = __test__.eventFrame(100, 'session-1', { req_params: { speaker: 'voice-1' } });
  const parsed = __test__.parseFrame(frame);
  assert.equal(parsed.type, 1);
  assert.equal(parsed.event, 100);
  assert.equal(parsed.sessionId, 'session-1');
  assert.deepEqual(JSON.parse(parsed.payload.toString('utf8')), { req_params: { speaker: 'voice-1' } });
});

test('does not create an external socket when the provider is not configured', () => {
  let createCalls = 0;
  const service = createVolcTtsService({
    apiKey: '',
    defaultSpeaker: '',
    createSocket: () => { createCalls += 1; throw new Error('should not connect'); },
  });
  const opened = service.open({ speaker: '', send: () => undefined, close: () => undefined });
  assert.equal(service.enabled, false);
  assert.equal(opened.error.code, 'unavailable');
  assert.equal(createCalls, 0);
});

test('rejects a speaker outside the configured allowlist', () => {
  const service = createVolcTtsService({ apiKey: 'test-key', defaultSpeaker: 'voice-1' });
  const opened = service.open({ speaker: 'voice-2', send: () => undefined, close: () => undefined });
  assert.equal(opened.error.code, 'invalid_voice');
});
