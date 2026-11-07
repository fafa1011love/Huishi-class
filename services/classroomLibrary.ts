import type { ExportLesson, TeacherLessonDraft } from './lessonWordExport';
import type { CoursewareManifest } from '../types/courseware';

export type TeacherReview = {
  draft: TeacherLessonDraft;
  quality: { valid: boolean; blocking: string[]; checks?: string[] };
  confirmed?: boolean;
};
export type ClassroomData = {
  contentKey?: string;
  courseware?: CoursewareManifest | null;
  review?: TeacherReview | null;
  ppt?: { downloadUrl: string; fileName: string; fingerprint?: string } | null;
};
export type ClassroomPlan = ExportLesson & {
  id: string;
  modelAsset?: Record<string, unknown>;
  warmupQuestions?: import('./quizData').WarmupQuestion[];
  classroomData?: ClassroomData;
};
export type ClassroomRecord = { id: string; title: string; plan: ClassroomPlan; updatedAt: string };

export function contentFingerprint(value: unknown): string {
  const text = JSON.stringify(value) || '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}

export function normalizeClassroomPlan<T extends ClassroomPlan>(plan: T): T {
  const { classroomData, ...content } = plan;
  // Local object URLs and downloaded model IDs change when reopening the same lesson.
  const { modelAsset, ...teaching } = content;
  const modelIdentity = modelAsset ? {
    source: modelAsset.source || 'generated',
    localModelId: modelAsset.source === 'imported' ? modelAsset.localModelId : undefined,
    url: [modelAsset.exportModelUrl, modelAsset.appearanceUrl, modelAsset.glbUrl, modelAsset.modelUrl]
      .find(url => typeof url === 'string' && !url.startsWith('blob:')),
    fileName: modelAsset.fileName,
  } : null;
  const contentKey = contentFingerprint({ ...teaching, modelIdentity });
  const valid = !classroomData?.contentKey || classroomData.contentKey === contentKey;
  return { ...plan, classroomData: { ...classroomData, ...(valid ? {} : { review: null, ppt: null, courseware: null }), contentKey } };
}

export function classroomCourseware(plan: ClassroomPlan): CoursewareManifest | null {
  const manifest = normalizeClassroomPlan(plan).classroomData?.courseware;
  return manifest?.lessonId === plan.id ? manifest : null;
}

export function persistentClassroomPlan(plan: ClassroomPlan): ClassroomPlan {
  const normalized = normalizeClassroomPlan(plan);
  const asset = normalized.modelAsset;
  const durable = (value: unknown): value is string => typeof value === 'string' && !value.startsWith('blob:') && !value.startsWith('data:');
  const modelUrl = [asset?.exportModelUrl, asset?.appearanceUrl, asset?.glbUrl, asset?.modelUrl].find(durable) || '';
  const assetUrls = Object.fromEntries(Object.entries((asset?.assetUrls || {}) as Record<string, string>).filter(([, url]) => durable(url)));
  const modelAsset = asset ? Object.fromEntries(Object.entries({ ...asset, assetUrls }).filter(([, value]) => typeof value !== 'string' || durable(value))) : undefined;
  const manifest = normalized.classroomData?.courseware;
  const courseware = manifest ? { ...manifest, model: { ...manifest.model, modelUrl, assetUrls },
    assets: manifest.assets.filter(item => item.type !== 'model' || !!modelUrl).map(item => item.type === 'model' ? { ...item, url: modelUrl } : item) } : manifest;
  const cached = normalized.classroomData?.ppt;
  const ppt = cached && manifest && cached.fingerprint === contentFingerprint(manifest)
    ? { ...cached, fingerprint: contentFingerprint(courseware) } : cached;
  return { ...normalized, modelAsset, classroomData: { ...normalized.classroomData, courseware, ppt } };
}

export async function listClassrooms(): Promise<ClassroomRecord[]> {
  const response = await fetch('/api/lesson-plans', { credentials: 'include' });
  if (!response.ok) throw new Error('课堂记录加载失败，请重试');
  const data = await response.json();
  return (data.records || []).map((record: ClassroomRecord) => ({ ...record, plan: normalizeClassroomPlan(record.plan) }));
}

export async function saveClassroom(plan: ClassroomPlan) {
  const response = await fetch('/api/lesson-plans', {
    method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: persistentClassroomPlan(plan) }),
  });
  if (!response.ok) throw new Error('课堂保存失败，请重试');
  window.dispatchEvent(new Event('classroom-library-updated'));
}
