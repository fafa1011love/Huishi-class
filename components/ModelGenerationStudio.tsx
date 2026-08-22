import React, { Component, Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, useGLTF } from '@react-three/drei';
import { ArrowLeft, Box, Image as ImageIcon, Sparkles, Upload, UploadCloud } from 'lucide-react';
import { saveGeneratedModel } from '../services/localModelLibrary';

type GenerationMode = 'text' | 'image';
type JobStatus = 'queued' | 'in_progress' | 'completed' | 'failed';

interface GenerationFile {
  type?: string;
  Type?: string;
  url?: string;
  Url?: string;
  preview_image_url?: string;
  PreviewImageUrl?: string;
}

interface GenerationJob {
  id: string;
  model: string;
  mode: GenerationMode;
  sourceName?: string;
  prompt?: string;
  status: JobStatus;
  createdAt: number;
}

interface ModelGenerationStudioProps {
  onBack: () => void;
  ownerId: number;
  onImportModel: (modelId: string) => void;
}

const MAX_SAVED_JOBS = 20;

function jobStorageKey(ownerId: number) {
  return `huishi-3d-generation-jobs:${ownerId}`;
}

function loadSavedJobs(ownerId: number): GenerationJob[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(jobStorageKey(ownerId)) || '[]');
    if (!Array.isArray(saved)) return [];

    return saved.filter((job): job is GenerationJob => (
      job
      && typeof job.id === 'string'
      && job.id.length > 0
      && (job.mode === 'text' || job.mode === 'image')
      && typeof job.createdAt === 'number'
    )).slice(0, MAX_SAVED_JOBS);
  } catch {
    return [];
  }
}

function normalizeStatus(value?: string): JobStatus {
  const status = String(value || 'queued').toLowerCase();
  const aliases: Record<string, JobStatus> = {
    wait: 'queued', waiting: 'queued', pending: 'queued', queued: 'queued',
    run: 'in_progress', running: 'in_progress', processing: 'in_progress', in_progress: 'in_progress',
    done: 'completed', success: 'completed', succeeded: 'completed', completed: 'completed',
    fail: 'failed', failed: 'failed', error: 'failed',
  };
  return aliases[status] || 'queued';
}

async function responseError(response: Response) {
  try {
    const data = await response.json();
    return data?.Response?.Error?.Message || data?.message || data?.error || '请求失败';
  } catch {
    if (response.status === 404) return '3D 建模接口尚未加载，请重启后端服务后重试';
    if (response.status === 413) return '图片体积过大，请压缩到 8MB 以内后重试';
    return `建模服务请求失败（${response.status}）`;
  }
}

function GeneratedModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  return <primitive object={scene.clone()} />;
}

class PreviewBoundary extends Component<React.PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <div className="ai3d-preview-message">模型预览加载失败，请下载后查看</div>;
    }
    return this.props.children;
  }
}

function ModelPreview({ url }: { url: string }) {
  return (
    <PreviewBoundary key={url}>
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
        <ambientLight intensity={1.5} />
        <directionalLight position={[5, 8, 5]} intensity={2.5} />
        <directionalLight position={[-5, 3, -5]} intensity={1} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.2}>
            <Center><GeneratedModel url={url} /></Center>
          </Bounds>
        </Suspense>
        <OrbitControls autoRotate />
      </Canvas>
    </PreviewBoundary>
  );
}

function JobCard({ job, ownerId, onImportModel }: { job: GenerationJob; ownerId: number; onImportModel: (modelId: string) => void }) {
  const [status, setStatus] = useState<JobStatus>(job.status);
  const [files, setFiles] = useState<GenerationFile[]>([]);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    let stopped = false;

    const poll = async () => {
      try {
        const response = await fetch('/api/3d/query', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ JobId: job.id }),
        });
        if (!response.ok) throw new Error(await responseError(response));
        const payload = await response.json();
        const result = payload.Response || payload;
        if (result.Error) throw new Error(result.Error.Message || '任务查询失败');
        if (stopped) return;

        const nextStatus = normalizeStatus(result.status || result.Status || result.task_status || result.TaskStatus);
        setStatus(nextStatus);
        const resultFiles = result.ResultFile3Ds || result.data || result.Data;
        if (nextStatus === 'completed' && Array.isArray(resultFiles)) setFiles(resultFiles);
        if (nextStatus === 'failed') setError(result.ErrorMessage || result.error || '生成失败，请重试');
      } catch (pollError) {
        if (!stopped) setError(pollError instanceof Error ? pollError.message : '任务查询失败');
      }
    };

    poll();
    const timer = status === 'queued' || status === 'in_progress'
      ? window.setInterval(poll, 5000)
      : undefined;
    return () => {
      stopped = true;
      if (timer) window.clearInterval(timer);
    };
  }, [job.id, status]);

  const normalizedFiles = files.map((file) => ({
    type: String(file.type || file.Type || '').toLowerCase(),
    url: file.url || file.Url || '',
    preview: file.preview_image_url || file.PreviewImageUrl || '',
  }));
  const glb = normalizedFiles.find((file) => file.type === 'glb');
  const preview = normalizedFiles.find((file) => file.type === 'preview' || file.preview)?.preview;
  // Tencent's result URL is already object storage. Loading it in the browser keeps
  // large model bytes off the application server.
  const viewerUrl = glb?.url || '';
  const statusLabel = { queued: '排队中', in_progress: '生成中', completed: '已完成', failed: '失败' }[status];
  const importModel = async () => {
    if (!viewerUrl || isImporting) return;
    setIsImporting(true);
    setImportError('');
    const sourceBaseName = (job.sourceName || '图生3D模型').replace(/\.[^.]+$/, '');

    try {
      const record = await saveGeneratedModel({
        id: `generated-${job.id}`,
        ownerId,
        name: `${sourceBaseName}-生成模型.glb`,
        url: viewerUrl,
      });
      onImportModel(record.id);
    } catch (importFailure) {
      setImportError(importFailure instanceof Error ? importFailure.message : '模型保存失败，请重试');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <article className="ai3d-panel ai3d-job-card">
      <div className="ai3d-job-topline">
        <span>任务 {job.id.slice(0, 8)}…</span>
        <span className={`ai3d-status ai3d-status-${status}`}>{statusLabel}</span>
      </div>
      <div className="ai3d-job-title">
        {job.prompt ? `提示词：${job.prompt}` : '图生 3D 模型'}
        <small>自研快速模型</small>
      </div>

      {(status === 'queued' || status === 'in_progress') && (
        <div className="ai3d-job-placeholder">
          <span className="ai3d-spinner" />
          <strong>正在生成建模...</strong>
          <span>通常约 1–2 分钟，可以返回课堂，任务会继续生成</span>
          {error && <em>{error}</em>}
        </div>
      )}
      {status === 'failed' && <div className="ai3d-job-error">{error || '生成失败，请重试'}</div>}
      {status === 'completed' && (
        <div className="ai3d-preview">
          {viewerUrl ? <ModelPreview url={viewerUrl} /> : preview ? <img src={preview} alt="生成结果预览" /> : <div className="ai3d-preview-message">暂无可用预览</div>}
        </div>
      )}
      {status === 'completed' && (
        <div className="ai3d-downloads">
          {job.mode === 'image' && viewerUrl && (
            <button type="button" className="ai3d-import" onClick={importModel} disabled={isImporting}>
              <Upload size={15} />{isImporting ? '正在保存...' : '一键导入'}
            </button>
          )}
          {normalizedFiles.filter((file) => ['glb', 'obj', 'fbx'].includes(file.type) && file.url).map((file, index) => (
            <a key={`${file.type}-${index}`} href={file.url} target="_blank" rel="noreferrer" download>
              下载 .{file.type.toUpperCase()}
            </a>
          ))}
        </div>
      )}
      {importError && <div className="ai3d-import-error">{importError}</div>}
    </article>
  );
}

export default function ModelGenerationStudio({ onBack, ownerId, onImportModel }: ModelGenerationStudioProps) {
  const [mode, setMode] = useState<GenerationMode>('text');
  const [prompt, setPrompt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageBase64, setImageBase64] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [jobs, setJobs] = useState<GenerationJob[]>(() => loadSavedJobs(ownerId));

  useEffect(() => {
    try {
      window.localStorage.setItem(jobStorageKey(ownerId), JSON.stringify(jobs.slice(0, MAX_SAVED_JOBS)));
    } catch {
      // 本地存储不可用时仍允许当前页面正常创建和查询任务。
    }
  }, [jobs, ownerId]);

  const selectImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setError('');
    const reader = new FileReader();
    reader.onload = () => setImageBase64(String(reader.result || '').split(',')[1] || '');
    reader.onerror = () => setError('图片读取失败，请重新选择');
    reader.readAsDataURL(file);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'text' ? !prompt.trim() : !imageBase64) return;
    setLoading(true);
    setError('');
    const submittedMode = mode;
    const submittedImageName = imageFile?.name;
    const body = mode === 'text'
      ? { Model: 'rapid', ResultFormat: 'GLB', Prompt: prompt.trim() }
      : { Model: 'rapid', ResultFormat: 'GLB', ImageBase64: imageBase64 };

    try {
      const response = await fetch('/api/3d/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(await responseError(response));
      const payload = await response.json();
      const result = payload.Response || payload;
      if (result.Error) throw new Error(result.Error.Message || '提交失败');
      const id = result.JobId || result.TaskId || result.id || result.request_id;
      if (!id) throw new Error('服务未返回任务编号');

      setJobs((current) => [{
        id,
        model: 'rapid',
        mode: submittedMode,
        sourceName: submittedMode === 'image' ? submittedImageName : undefined,
        prompt: submittedMode === 'text' ? prompt.trim() : undefined,
        status: normalizeStatus(result.status || result.Status),
        createdAt: Date.now(),
      }, ...current].slice(0, MAX_SAVED_JOBS));
      setPrompt('');
      setImageFile(null);
      setImageBase64('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="ai3d-studio">
      <div className="ai3d-orb ai3d-orb-one" />
      <div className="ai3d-orb ai3d-orb-two" />
      <div className="ai3d-container">
        <button type="button" className="ai3d-back" onClick={onBack}><ArrowLeft size={17} />返回课堂</button>
        <header className="ai3d-header">
          <div className="ai3d-brand-icon"><Box size={34} /></div>
          <h1>3D 建模生成</h1>
          <p>基于自研 3D 模型，轻松将文本和图像转化为高精度 3D 资产。</p>
        </header>

        <div className="ai3d-layout">
          <section className="ai3d-panel ai3d-form-panel">
            <div className="ai3d-tabs">
              <button type="button" className={mode === 'text' ? 'active' : ''} onClick={() => setMode('text')}><Sparkles size={16} />文生 3D</button>
              <button type="button" className={mode === 'image' ? 'active' : ''} onClick={() => setMode('image')}><ImageIcon size={16} />图生 3D</button>
            </div>
            <div className="ai3d-field">
              <label>当前模型</label>
              <div className="ai3d-input ai3d-readonly">自研 3D 模型 · 极速版</div>
            </div>
            <form onSubmit={submit}>
              {mode === 'text' ? (
                <div className="ai3d-field">
                  <label htmlFor="ai3d-prompt">提示词（Prompt）</label>
                  <textarea id="ai3d-prompt" className="ai3d-input" rows={5} placeholder="例如：一只可爱的小狗，卡通风格..." value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                </div>
              ) : (
                <div className="ai3d-field">
                  <label htmlFor="ai3d-image">上传图片</label>
                  <label className="ai3d-upload" htmlFor="ai3d-image">
                    <UploadCloud size={28} />
                    <span>{imageFile ? imageFile.name : '选择 PNG 或 JPEG 图片'}</span>
                  </label>
                  <input id="ai3d-image" className="ai3d-file-input" type="file" accept="image/png,image/jpeg" onChange={selectImage} />
                </div>
              )}
              {error && <div className="ai3d-form-error">{error}</div>}
              <button className="ai3d-primary" type="submit" disabled={loading || (mode === 'text' ? !prompt.trim() : !imageBase64)}>
                {loading ? '提交中...' : '开始生成 3D 模型'}
              </button>
            </form>
          </section>

          <section className="ai3d-gallery">
            {jobs.length === 0 ? (
              <div className="ai3d-empty"><Box size={44} /><strong>暂无任务</strong><span>从左侧创建第一个 3D 模型吧</span></div>
            ) : jobs.map((job) => <JobCard key={job.id} job={job} ownerId={ownerId} onImportModel={onImportModel} />)}
          </section>
        </div>
      </div>
    </main>
  );
}
