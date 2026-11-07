import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Play, X } from 'lucide-react';
import LessonExportPage from '../prep/LessonExportPage';
import { buildLessonWord, buildTeacherLessonWord, canExportLesson, lessonWordFilename } from '../services/lessonWordExport';
import { contentFingerprint, saveClassroom, type ClassroomPlan, type ClassroomRecord, type TeacherReview } from '../services/classroomLibrary';
import { prepareCoursewareViews } from '../services/coursewareExport';
import type { CoursewareManifest } from '../types/courseware';
import ClassroomToolButton from './ClassroomToolButton';

function download(url: string, name: string) {
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.appendChild(link); link.click(); link.remove();
}

export default function ClassroomLibrary({ records, activeId, onOpen, onNotice, onSaved }: {
  records: ClassroomRecord[];
  activeId: string | null;
  onOpen: (record: ClassroomRecord, play?: boolean) => Promise<void>;
  onNotice: (message: string) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const busyRef = useRef(false);
  const [reviewPlan, setReviewPlan] = useState<ClassroomPlan | null>(null);
  const [remoteCourseware, setRemoteCourseware] = useState<{ lessonId: string; manifest: CoursewareManifest } | null>(null);
  const [coursewareLoading, setCoursewareLoading] = useState(false);
  const reviewRef = useRef<ClassroomPlan | null>(null);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [saveError, setSaveError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);

  const record = records.find(item => item.id === activeId);

  useEffect(() => {
    let cancelled = false;
    const cached = record?.plan.classroomData?.courseware;
    if (!record || cached?.lessonId === record.id) {
      setRemoteCourseware(null);
      setCoursewareLoading(false);
      return;
    }
    setCoursewareLoading(true);
    void fetch(`/api/courseware/${encodeURIComponent(record.id)}`, { credentials: 'include' })
      .then(async response => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error('本课堂课件读取失败');
        return (await response.json()).manifest as CoursewareManifest;
      })
      .then(manifest => {
        if (cancelled) return;
        setRemoteCourseware(manifest?.lessonId === record.id && Array.isArray(manifest.scenes) ? { lessonId: record.id, manifest } : null);
      })
      .catch(() => {
        if (!cancelled) setRemoteCourseware(null);
      })
      .finally(() => {
        if (!cancelled) setCoursewareLoading(false);
      });
    return () => { cancelled = true; };
  }, [record?.id, record?.plan.classroomData?.courseware]);

  useEffect(() => {
    if (!reviewPlan) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setReviewPlan(null); reviewRef.current = null; }
      if (event.key === 'Tab') {
        const dialog = closeRef.current?.parentElement;
        const focusable = dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, select, [tabindex="0"]');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); previous?.focus(); };
  }, [reviewPlan?.id]);

  const updateReview = useCallback((review: TeacherReview | null) => {
    const current = reviewRef.current;
    if (!current) return;
    const next = { ...current, classroomData: { ...current.classroomData, review } };
    reviewRef.current = next; setReviewPlan(next); setSaveError('');
    saveQueue.current = saveQueue.current.catch(() => {}).then(() => saveClassroom(next)).then(onSaved).catch((error) => {
      setSaveError(error instanceof Error ? error.message : '审核稿保存失败');
      onNotice('审核稿保存失败，请重试保存，避免刷新后丢失');
    });
  }, [onSaved, onNotice]);

  const exportWord = async (record: ClassroomRecord) => {
    if (busyRef.current) return;
    const plan = record.plan;
    if (!canExportLesson(plan)) return onNotice('请先在智能备课中确认教案内容');
    const review = plan.classroomData?.review;
    if (plan.designWorkflow && (!review?.confirmed || !review.quality.valid)) {
      reviewRef.current = plan; setReviewPlan(plan); return;
    }
    busyRef.current = true; setBusy(`${plan.id}:word`);
    try {
      const blob = plan.designWorkflow ? await buildTeacherLessonWord(review!.draft) : await buildLessonWord(plan);
      const url = URL.createObjectURL(blob);
      download(url, lessonWordFilename(plan.title)); setTimeout(() => URL.revokeObjectURL(url), 60000);
      onNotice('Word 教案已导出');
    } catch (error) { onNotice(error instanceof Error ? error.message : '教案导出失败'); }
    finally { busyRef.current = false; setBusy(null); }
  };

  const exportPpt = async (record: ClassroomRecord) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(`${record.id}:ppt`);
    try {
      let manifest = record.plan.classroomData?.courseware || (remoteCourseware?.lessonId === record.id ? remoteCourseware.manifest : undefined);
      if (!manifest) {
        const response = await fetch(`/api/courseware/${encodeURIComponent(record.id)}`, { credentials: 'include' });
        if (response.ok) manifest = (await response.json()).manifest;
      }
      if (!manifest || manifest.lessonId !== record.id) throw new Error('暂无配套 PPT，请先在智能备课中生成本课课件');
      const cached = record.plan.classroomData?.ppt;
      if (cached?.fingerprint === contentFingerprint(manifest)) {
        const response = await fetch(cached.downloadUrl, { method: 'HEAD', credentials: 'include' }).catch(() => null);
        if (response?.ok) { download(cached.downloadUrl, cached.fileName); onNotice('PPT 已开始下载'); return; }
      }
      onNotice('正在导出本课堂 PPT…');
      const prepared = await prepareCoursewareViews(manifest, onNotice);
      const response = await fetch('/api/prep/courseware/export-pptx', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest: prepared }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || data.message || 'PPT 导出失败');
      const exportedManifest = (data.manifest || prepared) as CoursewareManifest;
      const sceneCount = exportedManifest.scenes.filter(scene => scene.enabled !== false).length;
      if (data.aligned !== true || data.sceneCount !== sceneCount || data.slideCount !== sceneCount) throw new Error('课件与 PPT 页数不一致，已停止下载');
      if (data.animation?.verified !== true) throw new Error(data.animation?.message || 'PPT 未通过导出检查');
      const plan = { ...record.plan, classroomData: { ...record.plan.classroomData, courseware: exportedManifest,
        ppt: { downloadUrl: data.downloadUrl, fileName: data.fileName, fingerprint: contentFingerprint(exportedManifest) } } };
      await saveClassroom(plan); onSaved();
      download(data.downloadUrl, data.fileName);
      onNotice(data.warnings?.length ? `PPT 已导出；${data.warnings.join('；')}` : 'PPT 已导出');
    } catch (error) { onNotice(error instanceof Error ? error.message : 'PPT 导出失败，请重试'); }
    finally { busyRef.current = false; setBusy(null); }
  };

  const currentCourseware = record?.plan.classroomData?.courseware || (remoteCourseware?.lessonId === record?.id ? remoteCourseware.manifest : null);
  const hasCourseware = Boolean(currentCourseware?.lessonId === record?.id && currentCourseware.scenes?.length);
  const hasPpt = Boolean(record?.plan.classroomData?.ppt?.downloadUrl);
  return <>
    {record && <>
      <ClassroomToolButton disabled={busy !== null || coursewareLoading || !hasCourseware} hint={coursewareLoading ? '正在读取本课堂课件，请稍候。' : hasCourseware ? '打开本课堂互动课件。' : '本课堂还没有生成互动课件，请先在智能备课中生成课件。'} onClick={() => void onOpen({ ...record, plan: { ...record.plan, classroomData: { ...record.plan.classroomData, courseware: currentCourseware } } }, true)}><Play size={18} /><span>课件</span></ClassroomToolButton>
      <ClassroomToolButton disabled={busy !== null} hint="导出本课堂已经审核确认的 Word 教案。" onClick={() => void exportWord(record)}><Download size={18} /><span>{busy === `${record.id}:word` ? '导出中…' : '导出教案'}</span></ClassroomToolButton>
      <ClassroomToolButton disabled={busy !== null || coursewareLoading || !hasCourseware} hint={coursewareLoading ? '正在读取本课堂课件，请稍候。' : hasPpt ? '下载本课堂已经生成的配套 PPT。' : hasCourseware ? '本课堂已有互动课件，将根据当前课件重新导出 PPT。' : '本课堂还没有生成互动课件，请先在智能备课中生成课件。'} onClick={() => void exportPpt(record)}><Download size={18} /><span>{busy === `${record.id}:ppt` ? '导出中…' : '导出 PPT'}</span></ClassroomToolButton>
    </>}
    {reviewPlan && createPortal(<div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#061421bb', display: 'grid', placeItems: 'center', padding: 16 }} onClick={event => { if (event.target === event.currentTarget) { setReviewPlan(null); reviewRef.current = null; } }}>
      <div className="classroom-review" role="dialog" aria-modal="true" aria-label="审核并导出教案" style={{ position: 'relative', width: 'min(100%, 1050px)', maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto', background: 'white', color: '#182a31', borderRadius: 16, padding: '40px 20px 20px' }}>
        <button ref={closeRef} type="button" aria-label="关闭审核窗口" style={{ position: 'absolute', right: 12, top: 12 }} onClick={() => { setReviewPlan(null); reviewRef.current = null; }}><X size={22} /></button>
        {saveError && <p role="alert">{saveError} <button onClick={() => updateReview(reviewPlan.classroomData?.review || null)}>重试保存</button></p>}
        <LessonExportPage plan={reviewPlan} editing={false} onBack={() => { setReviewPlan(null); reviewRef.current = null; }} onNotice={onNotice}
          review={reviewPlan.classroomData?.review || null} onReviewChange={updateReview} />
      </div>
    </div>, document.body)}
  </>;
}
