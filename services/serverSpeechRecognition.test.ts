import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAsrWebSocketUrl,
  describeAsrError,
  ServerSpeechRecognition,
  ServerSpeechRecognitionError,
} from './serverSpeechRecognition.ts';

class FakeSocket {
  readyState = 0;
  binaryType: BinaryType = 'blob';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: Array<string | ArrayBufferLike | ArrayBufferView> = [];

  send(data: string | ArrayBufferLike | ArrayBufferView) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 } as CloseEvent);
  }

  open() {
    this.readyState = 1;
    this.onopen?.(new Event('open'));
  }

  message(payload: object) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent);
  }
}

const waitForTurn = () => new Promise((resolve) => setTimeout(resolve, 0));

const createRuntime = () => {
  const sockets: FakeSocket[] = [];
  const tracks: Array<{ stopped: boolean; stop: () => void }> = [];
  const workletPorts: Array<{ onmessage: ((event: MessageEvent<ArrayBuffer>) => void) | null }> = [];

  const runtime = {
    location: { protocol: 'https:', host: 'class.example' },
    workletUrl: '/asr-audio-processor.js',
    handshakeTimeoutMs: 100,
    getUserMedia: async () => {
      const track = { stopped: false, stop() { this.stopped = true; } };
      tracks.push(track);
      return { getTracks: () => [track] } as any;
    },
    createAudioContext: () => {
      const context = {
        state: 'running',
        destination: {},
        audioWorklet: { addModule: async () => undefined },
        createMediaStreamSource: () => ({ connect: () => undefined, disconnect: () => undefined }),
        createGain: () => ({
          gain: { value: 1 },
          connect: () => undefined,
          disconnect: () => undefined,
        }),
        resume: async () => undefined,
        close: async () => { context.state = 'closed'; },
      };
      return context as any;
    },
    createWorkletNode: () => {
      const port = { onmessage: null };
      workletPorts.push(port);
      return { port, connect: () => undefined, disconnect: () => undefined } as any;
    },
    createWebSocket: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
  };
  return { runtime, sockets, tracks, workletPorts };
};

test('builds same-origin ws and wss endpoints', () => {
  assert.equal(buildAsrWebSocketUrl({ protocol: 'https:', host: 'class.example' } as Location), 'wss://class.example/api/asr');
  assert.equal(buildAsrWebSocketUrl({ protocol: 'http:', host: 'localhost:3000' } as Location), 'ws://localhost:3000/api/asr');
});

test('maps server and microphone error messages for the UI', () => {
  assert.match(describeAsrError(new ServerSpeechRecognitionError('busy', 'busy')), /繁忙/);
  assert.match(describeAsrError(new ServerSpeechRecognitionError('microphone_denied', 'denied')), /麦克风访问被拒绝/);
});

test('connects, streams callbacks, and releases microphone on pause', async () => {
  const partials: string[] = [];
  const finals: string[] = [];
  const errors: Error[] = [];
  const { runtime, sockets, tracks, workletPorts } = createRuntime();
  const recognition = new ServerSpeechRecognition({
    onPartial: (text) => partials.push(text),
    onFinal: (text) => finals.push(text),
    onError: (error) => errors.push(error),
  }, runtime);

  const starting = recognition.start();
  await waitForTurn();
  sockets[0].open();
  assert.deepEqual(JSON.parse(String(sockets[0].sent[0])), { type: 'start', sampleRate: 16000 });
  sockets[0].message({ type: 'ready' });
  await starting;

  sockets[0].message({ type: 'partial', text: '放' });
  sockets[0].message({ type: 'final', text: '放大' });
  const frame = new Float32Array(1600).buffer;
  workletPorts[0].onmessage?.({ data: frame } as MessageEvent<ArrayBuffer>);

  assert.equal(recognition.currentState, 'active');
  assert.deepEqual(partials, ['放']);
  assert.deepEqual(finals, ['放大']);
  assert.equal(errors.length, 0);
  assert.equal(sockets[0].sent[1], frame);

  await recognition.pause();
  assert.equal(recognition.currentState, 'paused');
  assert.equal(tracks[0].stopped, true);
  assert.equal(sockets[0].readyState, 3);
});

test('rejects a busy response and releases acquired resources', async () => {
  const { runtime, sockets, tracks } = createRuntime();
  const recognition = new ServerSpeechRecognition({
    onPartial: () => undefined,
    onFinal: () => undefined,
    onError: () => undefined,
  }, runtime);

  const starting = recognition.start();
  await waitForTurn();
  sockets[0].open();
  sockets[0].message({ type: 'error', code: 'busy', message: 'busy', retryable: true });

  await assert.rejects(starting, (error: any) => error.code === 'busy');
  assert.equal(recognition.currentState, 'stopped');
  assert.equal(tracks[0].stopped, true);
});

test('sends finish before closing an active session', async () => {
  const { runtime, sockets, tracks } = createRuntime();
  const recognition = new ServerSpeechRecognition({
    onPartial: () => undefined,
    onFinal: () => undefined,
    onError: () => undefined,
  }, runtime);

  const starting = recognition.start();
  await waitForTurn();
  sockets[0].open();
  sockets[0].message({ type: 'ready' });
  await starting;
  await recognition.stop();

  assert.equal(JSON.parse(String(sockets[0].sent.at(-1))).type, 'finish');
  assert.equal(tracks[0].stopped, true);
  assert.equal(recognition.currentState, 'stopped');
});

test('releases the microphone when listening permission is revoked during startup', async () => {
  const { runtime, sockets, tracks } = createRuntime();
  let guardChecks = 0;
  const recognition = new ServerSpeechRecognition({
    onPartial: () => undefined,
    onFinal: () => undefined,
    onError: () => undefined,
  }, runtime, () => {
    guardChecks += 1;
    return guardChecks === 1;
  });

  await recognition.start();

  assert.equal(tracks[0].stopped, true);
  assert.equal(sockets.length, 0);
  assert.equal(recognition.currentState, 'stopped');
});
