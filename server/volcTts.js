import { randomUUID } from 'node:crypto';
import { WebSocket, WebSocketServer } from 'ws';

const VOLC_TTS_URL = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';
const FULL_CLIENT_REQUEST = 0x1;
const FULL_SERVER_RESPONSE = 0x9;
const AUDIO_ONLY_SERVER = 0xb;
const ERROR = 0xf;
const WITH_EVENT = 0x4;
const START_CONNECTION = 1;
const FINISH_CONNECTION = 2;
const START_SESSION = 100;
const CANCEL_SESSION = 101;
const FINISH_SESSION = 102;
const TASK_REQUEST = 200;
const TTS_RESPONSE = 352;

const safeSend = (socket, payload) => {
  if (socket.readyState === WebSocket.OPEN) socket.send(payload);
};

const jsonBytes = (value) => Buffer.from(JSON.stringify(value), 'utf8');

const eventFrame = (event, sessionId, payload = {}) => {
  const sessionBytes = event === START_CONNECTION || event === FINISH_CONNECTION
    ? Buffer.alloc(0)
    : Buffer.from(sessionId, 'utf8');
  const body = jsonBytes(payload);
  const header = Buffer.from([0x11, (FULL_CLIENT_REQUEST << 4) | WITH_EVENT, 0x10, 0x00]);
  const eventBuffer = Buffer.alloc(4);
  eventBuffer.writeInt32BE(event, 0);
  const sessionLength = Buffer.alloc(sessionBytes.length ? 4 : 0);
  if (sessionBytes.length) sessionLength.writeUInt32BE(sessionBytes.length, 0);
  const payloadLength = Buffer.alloc(4);
  payloadLength.writeUInt32BE(body.length, 0);
  return Buffer.concat([header, eventBuffer, sessionLength, sessionBytes, payloadLength, body]);
};

const parseFrame = (data) => {
  const frame = Buffer.from(data);
  if (frame.length < 8) throw new Error('豆包语音响应帧过短');
  const type = frame[1] >> 4;
  const flag = frame[1] & 0x0f;
  const headerSize = (frame[0] & 0x0f) * 4;
  let offset = headerSize;
  let event = 0;
  let sessionId = '';
  if (flag === WITH_EVENT) {
    event = frame.readInt32BE(offset);
    offset += 4;
    if (![50, 51, 52, START_CONNECTION, FINISH_CONNECTION].includes(event)) {
      const length = frame.readUInt32BE(offset);
      offset += 4;
      sessionId = frame.subarray(offset, offset + length).toString('utf8');
      offset += length;
    }
    if ([50, 51, 52].includes(event)) {
      const connectLength = frame.readUInt32BE(offset);
      offset += 4 + connectLength;
    }
  }
  if (type === ERROR) {
    const code = frame.readUInt32BE(offset);
    offset += 4;
    const length = frame.readUInt32BE(offset);
    offset += 4;
    return { type, event, sessionId, error: `${code}: ${frame.subarray(offset, offset + length).toString('utf8')}` };
  }
  const payloadLength = frame.readUInt32BE(offset);
  offset += 4;
  return { type, event, sessionId, payload: frame.subarray(offset, offset + payloadLength) };
};

export function createVolcTtsService({
  apiKey = process.env.VOLC_TTS_API_KEY || '',
  resourceId = process.env.VOLC_TTS_RESOURCE_ID || 'seed-tts-2.0',
  defaultSpeaker = process.env.VOLC_TTS_DEFAULT_SPEAKER || '',
  endpoint = process.env.VOLC_TTS_ENDPOINT || VOLC_TTS_URL,
  createSocket = (url, options) => new WebSocket(url, options),
} = {}) {
  const enabled = Boolean(apiKey && defaultSpeaker);
  const allowedSpeakers = new Set((process.env.VOLC_TTS_SPEAKERS || defaultSpeaker).split(',').map((item) => item.trim()).filter(Boolean));

  return {
    enabled,
    defaultSpeaker,
    speakers: [...allowedSpeakers].map((id) => ({ id, name: id === defaultSpeaker ? '豆包默认真人音色' : id })),
    open({ speaker = defaultSpeaker, send, close }) {
      if (!enabled) return { error: { type: 'error', code: 'unavailable', message: '豆包真人音色尚未配置' } };
      if (!allowedSpeakers.has(speaker)) return { error: { type: 'error', code: 'invalid_voice', message: '不支持该真人音色' } };

      const sessionId = randomUUID();
      const connectId = randomUUID();
      let provider;
      let finished = false;
      let sessionStarted = false;
      let finishRequested = false;
      let finishTimer = null;
      const sendFinish = () => {
        finishTimer = null;
        if (!finished && provider?.readyState === WebSocket.OPEN && sessionStarted) {
          provider.send(eventFrame(FINISH_SESSION, sessionId, {}));
        }
      };
      const scheduleFinish = () => {
        if (finishTimer || !sessionStarted) return;
        // Give the provider a small window to consume the final text packet.
        finishTimer = setTimeout(sendFinish, 120);
      };
      const startSession = () => {
        if (sessionStarted || finished || provider?.readyState !== WebSocket.OPEN) return;
        sessionStarted = true;
        provider.send(eventFrame(START_SESSION, sessionId, {
          event: START_SESSION,
          req_params: {
            speaker,
            audio_params: { format: 'pcm', sample_rate: 24000, channel: 1 },
          },
        }));
      };
      const fail = (message) => {
        if (finished) return;
        finished = true;
        if (finishTimer) clearTimeout(finishTimer);
        send({ type: 'error', code: 'provider_error', message });
        close(1011, 'provider_error');
        provider?.close();
      };
      try {
        provider = createSocket(endpoint, {
          headers: {
            'X-Api-Key': apiKey,
            'X-Api-Resource-Id': resourceId,
            'X-Api-Connect-Id': connectId,
          },
        });
      } catch (error) {
        return { error: { type: 'error', code: 'provider_error', message: error.message || '无法连接豆包语音服务' } };
      }
      provider.on('open', () => {
        provider.send(eventFrame(START_CONNECTION, '', {}));
      });
      provider.on('message', (data) => {
        try {
          const frame = parseFrame(data);
          if (frame.error) return fail(frame.error);
          if (frame.type === FULL_SERVER_RESPONSE && frame.event === 50) startSession();
          if (frame.type === FULL_SERVER_RESPONSE && frame.event === 150) {
            send({ type: 'ready', sampleRate: 24000 });
            if (finishRequested) scheduleFinish();
          }
          if (frame.type === AUDIO_ONLY_SERVER && frame.event === TTS_RESPONSE && frame.payload?.length) {
            send(frame.payload, { binary: true });
          }
          if (frame.type === FULL_SERVER_RESPONSE && [152, 153].includes(frame.event)) {
            if (frame.event === 153) return fail('豆包语音合成会话失败');
            if (!finished) {
              finished = true;
              send({ type: 'done' });
              close(1000, 'done');
              provider.close();
            }
          }
        } catch (error) {
          fail(error.message || '无法解析豆包语音响应');
        }
      });
      provider.on('error', (error) => fail(error.message || '豆包语音连接失败'));
      provider.on('close', (code, reason) => {
        if (!finished) {
          const detail = reason?.toString('utf8') || `code=${code}`;
          fail(`豆包语音连接已关闭：${detail}`);
        }
      });

      return {
        push(text) {
          if (!provider || provider.readyState !== WebSocket.OPEN || finished) return;
          const value = String(text || '');
          if (value) provider.send(eventFrame(TASK_REQUEST, sessionId, {
            event: TASK_REQUEST,
            req_params: {
              speaker,
              audio_params: { format: 'pcm', sample_rate: 24000, channel: 1 },
              text: value,
            },
          }));
        },
        finish() {
          if (finished) return;
          finishRequested = true;
          if (!provider || provider.readyState !== WebSocket.OPEN || !sessionStarted) return;
          scheduleFinish();
        },
        cancel() {
          if (finished) return;
          finished = true;
          if (finishTimer) clearTimeout(finishTimer);
          if (provider?.readyState === WebSocket.OPEN) provider.send(eventFrame(CANCEL_SESSION, sessionId, {}));
          provider?.close();
        },
      };
    },
  };
}

export function attachVolcTtsWebSocketServer({ server, ttsService, authenticate, allowedOrigin, websocketPath = '/api/tts' }) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  wss.on('connection', (ws, _request, user) => {
    let session = null;
    const close = (code, reason) => { if (ws.readyState === WebSocket.OPEN) ws.close(code, reason); };
    ws.on('message', (data, isBinary) => {
      if (isBinary) return close(1003, 'text_only');
      let message;
      try { message = JSON.parse(data.toString('utf8')); } catch { return close(1007, 'invalid_json'); }
      if (message.type === 'start') {
        if (session) return close(1008, 'already_started');
        const opened = ttsService.open({ speaker: message.speaker, send: (payload, options) => safeSend(ws, options?.binary ? payload : JSON.stringify(payload)), close });
        if (opened.error) safeSend(ws, JSON.stringify(opened.error));
        else session = opened;
      } else if (message.type === 'text') session?.push(message.text);
      else if (message.type === 'finish') session?.finish();
      else if (message.type === 'cancel') session?.cancel();
    });
    ws.on('close', () => session?.cancel());
  });
  server.on('upgrade', async (request, socket, head) => {
    let pathname;
    try { pathname = new URL(request.url || '/', 'http://localhost').pathname; } catch { socket.destroy(); return; }
    if (pathname !== websocketPath) return;
    if (allowedOrigin && request.headers.origin !== allowedOrigin) { socket.destroy(); return; }
    const user = await authenticate(request).catch(() => null);
    wss.handleUpgrade(request, socket, head, (ws) => {
      if (!user) { safeSend(ws, JSON.stringify({ type: 'error', code: 'unauthorized', message: '登录已过期，请重新登录' })); ws.close(1008, 'unauthorized'); return; }
      wss.emit('connection', ws, request, user);
    });
  });
  return wss;
}

export const __test__ = { eventFrame, parseFrame };
