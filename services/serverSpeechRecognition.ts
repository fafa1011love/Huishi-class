export type AsrErrorCode =
  | 'unauthorized'
  | 'busy'
  | 'unavailable'
  | 'invalid_audio'
  | 'microphone_denied'
  | 'microphone_unavailable'
  | 'connection_failed';

export interface ServerSpeechRecognitionCallbacks {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (error: ServerSpeechRecognitionError) => void;
}

type RecognitionState = 'idle' | 'connecting' | 'active' | 'paused' | 'stopped';

interface WebSocketLike {
  readyState: number;
  binaryType: BinaryType;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
  onclose: ((event: CloseEvent) => void) | null;
  send(data: string | ArrayBufferLike | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
}

export interface SpeechRecognitionRuntime {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createAudioContext: () => AudioContext;
  createWorkletNode: (context: AudioContext) => AudioWorkletNode;
  createWebSocket: (url: string) => WebSocketLike;
  location: Pick<Location, 'protocol' | 'host'>;
  workletUrl: string;
  handshakeTimeoutMs: number;
}

const defaultRuntime = (): SpeechRecognitionRuntime => ({
  getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
  createAudioContext: () => new AudioContext({ latencyHint: 'interactive' }),
  createWorkletNode: (context) => new AudioWorkletNode(context, 'huishi-asr-audio-processor'),
  createWebSocket: (url) => new WebSocket(url),
  location: window.location,
  workletUrl: '/asr-audio-processor.js',
  handshakeTimeoutMs: 8_000,
});

export class ServerSpeechRecognitionError extends Error {
  public readonly code: AsrErrorCode;
  public readonly retryable: boolean;

  constructor(
    code: AsrErrorCode,
    message: string,
    retryable = false,
  ) {
    super(message);
    this.name = 'ServerSpeechRecognitionError';
    this.code = code;
    this.retryable = retryable;
  }
}

export const buildAsrWebSocketUrl = (location: Pick<Location, 'protocol' | 'host'>) =>
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api/asr`;

export const describeAsrError = (error: ServerSpeechRecognitionError) => {
  const messages: Record<AsrErrorCode, string> = {
    unauthorized: '登录已过期，请重新登录后使用语音输入。',
    busy: '语音识别繁忙，请稍后再试。',
    unavailable: '服务器语音识别暂不可用，请联系管理员检查模型配置。',
    invalid_audio: '语音数据格式异常，请关闭语音后重试。',
    microphone_denied: '麦克风访问被拒绝，请在浏览器地址栏中允许麦克风权限。',
    microphone_unavailable: '没有检测到可用麦克风，请检查设备连接。',
    connection_failed: '无法连接服务器语音识别，请检查网络后重试。',
  };
  return messages[error.code] || error.message;
};

const normalizeError = (error: unknown): ServerSpeechRecognitionError => {
  if (error instanceof ServerSpeechRecognitionError) return error;
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return new ServerSpeechRecognitionError('microphone_denied', error.message);
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return new ServerSpeechRecognitionError('microphone_unavailable', error.message);
    }
  }
  return new ServerSpeechRecognitionError(
    'connection_failed',
    error instanceof Error ? error.message : String(error || 'unknown error'),
    true,
  );
};

const parseServerError = (message: any) => {
  const supported: AsrErrorCode[] = ['unauthorized', 'busy', 'unavailable', 'invalid_audio'];
  const code = supported.includes(message?.code) ? message.code : 'connection_failed';
  return new ServerSpeechRecognitionError(code, String(message?.message || code), Boolean(message?.retryable));
};

export class ServerSpeechRecognition {
  private state: RecognitionState = 'idle';
  private socket: WebSocketLike | null = null;
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mutedGain: GainNode | null = null;
  private generation = 0;
  private readonly callbacks: ServerSpeechRecognitionCallbacks;
  private readonly runtime: SpeechRecognitionRuntime;
  private readonly canContinue: () => boolean;

  constructor(
    callbacks: ServerSpeechRecognitionCallbacks,
    runtime?: Partial<SpeechRecognitionRuntime>,
    canContinue: () => boolean = () => true,
  ) {
    this.callbacks = callbacks;
    const defaults = typeof window === 'undefined' ? {} : defaultRuntime();
    this.runtime = { ...defaults, ...runtime } as SpeechRecognitionRuntime;
    this.canContinue = canContinue;
  }

  get currentState() {
    return this.state;
  }

  async start() {
    if (this.state === 'active') return;
    if (this.state === 'connecting') throw new ServerSpeechRecognitionError('connection_failed', '语音识别正在连接');
    await this.connect();
  }

  async pause() {
    if (this.state !== 'active' && this.state !== 'connecting') return;
    this.state = 'paused';
    this.generation += 1;
    await this.releaseResources();
  }

  async resume() {
    if (this.state !== 'paused') return;
    await this.connect();
  }

  async stop() {
    if (this.state === 'stopped' || this.state === 'idle') return;
    this.state = 'stopped';
    this.generation += 1;
    await this.releaseResources(true);
  }

  private async connect() {
    if (!this.canContinue()) {
      this.state = 'stopped';
      return;
    }
    const generation = ++this.generation;
    this.state = 'connecting';

    try {
      const stream = await this.runtime.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (generation !== this.generation || !this.canContinue()) {
        stream.getTracks().forEach((track) => track.stop());
        if (generation === this.generation) this.state = 'stopped';
        return;
      }
      this.mediaStream = stream;

      const context = this.runtime.createAudioContext();
      this.audioContext = context;
      await context.audioWorklet.addModule(this.runtime.workletUrl);
      if (generation !== this.generation) return;
      if (!this.canContinue()) {
        this.state = 'stopped';
        this.generation += 1;
        await this.releaseResources();
        return;
      }

      this.sourceNode = context.createMediaStreamSource(stream);
      this.workletNode = this.runtime.createWorkletNode(context);
      this.mutedGain = context.createGain();
      this.mutedGain.gain.value = 0;
      this.sourceNode.connect(this.workletNode);
      this.workletNode.connect(this.mutedGain);
      this.mutedGain.connect(context.destination);

      const socket = this.runtime.createWebSocket(buildAsrWebSocketUrl(this.runtime.location));
      socket.binaryType = 'arraybuffer';
      this.socket = socket;
      this.workletNode.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (this.socket === socket && socket.readyState === 1 && event.data.byteLength > 0) {
          socket.send(event.data);
        }
      };

      await this.awaitReady(socket, generation);
      if (generation !== this.generation) return;
      if (!this.canContinue()) {
        this.state = 'stopped';
        this.generation += 1;
        await this.releaseResources();
        return;
      }
      if (context.state === 'suspended') await context.resume();
      if (!this.canContinue()) {
        this.state = 'stopped';
        this.generation += 1;
        await this.releaseResources();
        return;
      }
      this.state = 'active';
    } catch (error) {
      if (generation === this.generation) {
        this.state = 'stopped';
        await this.releaseResources();
      }
      throw normalizeError(error);
    }
  }

  private awaitReady(socket: WebSocketLike, generation: number) {
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new ServerSpeechRecognitionError('connection_failed', '语音识别连接超时', true));
      }, this.runtime.handshakeTimeoutMs);

      const rejectOnce = (error: ServerSpeechRecognitionError) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        reject(error);
      };

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'start', sampleRate: 16_000 }));
      };
      socket.onmessage = (event) => {
        let message: any;
        try {
          message = JSON.parse(String(event.data));
        } catch {
          rejectOnce(new ServerSpeechRecognitionError('connection_failed', '服务器返回了无效消息'));
          return;
        }

        if (message.type === 'ready') {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
          return;
        }
        if (message.type === 'partial') this.callbacks.onPartial(String(message.text || ''));
        if (message.type === 'final') this.callbacks.onFinal(String(message.text || ''));
        if (message.type === 'error') {
          const error = parseServerError(message);
          if (!settled) rejectOnce(error);
          else {
            this.callbacks.onError(error);
            void this.stop();
          }
        }
      };
      socket.onerror = () => rejectOnce(
        new ServerSpeechRecognitionError('connection_failed', 'WebSocket 连接失败', true),
      );
      socket.onclose = () => {
        if (this.socket !== socket || generation !== this.generation) return;
        const error = new ServerSpeechRecognitionError('connection_failed', '语音识别连接已断开', true);
        if (!settled) rejectOnce(error);
        else if (this.state === 'active') {
          this.callbacks.onError(error);
          void this.stop();
        }
      };
    });
  }

  private async releaseResources(sendFinish = false) {
    const worklet = this.workletNode;
    const source = this.sourceNode;
    const gain = this.mutedGain;
    const stream = this.mediaStream;
    const context = this.audioContext;
    const socket = this.socket;

    if (sendFinish && socket?.readyState === 1) {
      try { socket.send(JSON.stringify({ type: 'finish' })); } catch { /* connection is already closing */ }
    }

    this.workletNode = null;
    this.sourceNode = null;
    this.mutedGain = null;
    this.mediaStream = null;
    this.audioContext = null;
    this.socket = null;

    if (worklet) worklet.port.onmessage = null;
    try { source?.disconnect(); } catch { /* already disconnected */ }
    try { worklet?.disconnect(); } catch { /* already disconnected */ }
    try { gain?.disconnect(); } catch { /* already disconnected */ }
    stream?.getTracks().forEach((track) => track.stop());
    if (context && context.state !== 'closed') {
      try { await context.close(); } catch { /* browser is already closing it */ }
    }
    if (socket && (socket.readyState === 0 || socket.readyState === 1)) {
      try { socket.close(1000, 'client_stop'); } catch { /* already closed */ }
    }
  }
}
