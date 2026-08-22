import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { WebSocket } from 'ws';
import {
  ASR_SAMPLE_RATE,
  attachAsrWebSocketServer,
  createAsrService,
} from './asr.js';

class FakeStream {
  constructor() {
    this.sampleCount = 0;
    this.ready = 0;
    this.text = '';
  }

  acceptWaveform({ samples, sampleRate }) {
    assert.equal(sampleRate, ASR_SAMPLE_RATE);
    this.sampleCount += samples.length;
    this.ready += 1;
  }

  inputFinished() {
    this.ready += 1;
  }
}

class FakeRecognizer {
  createStream() {
    return new FakeStream();
  }

  isReady(stream) {
    return stream.ready > 0;
  }

  decode(stream) {
    stream.ready -= 1;
    if (stream.sampleCount > 0) stream.text = '放大';
  }

  getResult(stream) {
    return { text: stream.text };
  }

  isEndpoint(stream) {
    return stream.sampleCount >= 1_600;
  }

  reset(stream) {
    stream.sampleCount = 0;
    stream.text = '';
  }
}

const open = (service, userId) => {
  const messages = [];
  const result = service.openSession({ userId, send: (message) => messages.push(message) });
  return { ...result, messages };
};

test('limits concurrent ASR sessions and one connection per user', () => {
  const service = createAsrService({ recognizer: new FakeRecognizer(), maxSessions: 2 });
  const first = open(service, 1);
  const duplicate = open(service, 1);
  const second = open(service, 2);
  const overflow = open(service, 3);

  assert.ok(first.session);
  assert.equal(duplicate.error.code, 'busy');
  assert.ok(second.session);
  assert.equal(overflow.error.code, 'busy');
  assert.deepEqual(service.getHealth(), {
    available: true,
    activeSessions: 2,
    maxSessions: 2,
    model: 'sherpa-onnx-streaming-paraformer-bilingual-zh-en',
  });

  first.session.close('test');
  assert.ok(open(service, 3).session);
});

test('emits ready, partial, and final messages for streaming audio', () => {
  const service = createAsrService({ recognizer: new FakeRecognizer() });
  const { session, messages } = open(service, 7);

  assert.equal(session.start(ASR_SAMPLE_RATE), null);
  assert.equal(session.acceptAudio(new Float32Array(800)), null);
  assert.equal(session.acceptAudio(new Float32Array(800)), null);

  assert.deepEqual(messages, [
    { type: 'ready' },
    { type: 'partial', text: '放大' },
    { type: 'final', text: '放大' },
  ]);
});

test('rejects invalid sample rates and malformed audio', () => {
  const service = createAsrService({ recognizer: new FakeRecognizer() });
  const { session } = open(service, 8);

  assert.equal(session.start(48_000).code, 'invalid_audio');
  assert.equal(session.acceptAudio(new Float32Array(100)).code, 'invalid_audio');
  assert.equal(session.start(ASR_SAMPLE_RATE), null);
  assert.equal(session.acceptAudio(new Float32Array([Number.NaN])).code, 'invalid_audio');
  assert.equal(session.acceptAudio(new Float32Array(ASR_SAMPLE_RATE + 1)).code, 'invalid_audio');
});

test('flushes the current utterance when the client sends finish', () => {
  const service = createAsrService({ recognizer: new FakeRecognizer() });
  const { session, messages } = open(service, 9);
  session.start(ASR_SAMPLE_RATE);
  session.acceptAudio(new Float32Array(800));
  session.finish();

  assert.equal(messages.at(-1).type, 'final');
  assert.equal(messages.at(-1).text, '放大');
});

test('reports unavailable without preventing service construction', () => {
  const service = createAsrService({ enabled: false });
  assert.equal(service.getHealth().available, false);
  assert.equal(open(service, 1).error.code, 'unavailable');
});

test('authenticates websocket upgrades and returns structured busy errors', async (context) => {
  const server = createServer();
  const service = createAsrService({ recognizer: new FakeRecognizer(), maxSessions: 1 });
  const wss = attachAsrWebSocketServer({
    server,
    asrService: service,
    allowedOrigin: 'https://class.example',
    authenticate: async (request) => request.headers.cookie === 'session=ok' ? { id: 42 } : null,
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(async () => {
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    await new Promise((resolve) => server.close(resolve));
  });
  const { port } = server.address();
  const url = `ws://127.0.0.1:${port}/api/asr`;

  const connect = (cookie) => new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers: { Origin: 'https://class.example', Cookie: cookie } });
    const firstMessage = new Promise((resolveMessage) => {
      ws.once('message', (data) => resolveMessage(JSON.parse(data.toString('utf8'))));
    });
    ws.once('error', reject);
    ws.once('open', () => resolve({ ws, firstMessage }));
  });

  const unauthorized = await connect('');
  assert.equal((await unauthorized.firstMessage).code, 'unauthorized');

  const first = await connect('session=ok');
  first.ws.send(JSON.stringify({ type: 'start', sampleRate: ASR_SAMPLE_RATE }));
  assert.equal((await first.firstMessage).type, 'ready');

  const duplicate = await connect('session=ok');
  assert.equal((await duplicate.firstMessage).code, 'busy');
  first.ws.close();
});
