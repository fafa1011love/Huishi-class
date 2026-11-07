export interface VisualLesson {
  id: string;
  name: string;
  url: string;
  source: string;
  needsNetwork: boolean;
  missingAssets: boolean;
}

export interface VisualChapter {
  id: string;
  name: string;
  lessons: VisualLesson[];
}

export interface VisualVolume {
  id: string;
  name: string;
  chapters: VisualChapter[];
}

export interface VisualGrade {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  volumes: VisualVolume[];
}

export interface VisualSubject {
  id: string;
  name: string;
  description: string;
  grades: VisualGrade[];
}

export interface VisualManifest {
  version: number;
  generatedAt: string;
  root: string;
  subjects: VisualSubject[];
}

export interface VisualRoute {
  gradeId?: string;
  subjectId?: string;
  volumeId?: string;
  chapterId?: string;
  lessonId?: string;
}

export interface VisualSelection {
  subject: VisualSubject;
  grade: VisualGrade;
  volume: VisualVolume;
  chapter: VisualChapter;
  lesson: VisualLesson;
}

/** 跨学科学合并后的年级卡片数据（同一年级可能同时有数学、物理） */
export interface VisualGradeSummary {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  subjectIds: string[];
  volumeCount: number;
  chapterCount: number;
  lessonCount: number;
}

export interface VisualSubjectOption {
  subject: VisualSubject;
  grade: VisualGrade;
}

const MANIFEST_URL = '/visual-classroom/manifest.json';
const ROUTE_KEYS = ['gradeId', 'subjectId', 'volumeId', 'chapterId', 'lessonId'] as const;
const EMPTY_SEGMENT = '-';

let manifestPromise: Promise<VisualManifest> | null = null;

function assertManifest(value: unknown): VisualManifest {
  if (!value || typeof value !== 'object') throw new Error('资源清单格式错误');
  const manifest = value as VisualManifest;
  if (!Array.isArray(manifest.subjects) || manifest.subjects.length === 0) {
    throw new Error('资源清单中没有可用的学科数据');
  }
  return manifest;
}

export function loadVisualManifest(): Promise<VisualManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL, { cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`资源清单加载失败（HTTP ${response.status}）`);
        return response.json() as Promise<VisualManifest>;
      })
      .then(assertManifest)
      .catch((error: unknown) => {
        manifestPromise = null;
        throw error instanceof Error ? error : new Error('资源清单加载失败');
      });
  }
  return manifestPromise;
}

export function countChapters(grade: VisualGrade): number {
  return grade.volumes.reduce((total, volume) => total + volume.chapters.length, 0);
}

export function countLessons(grade: VisualGrade): number {
  return grade.volumes.reduce(
    (total, volume) => total + volume.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0),
    0,
  );
}

export function allLessons(grade: VisualGrade): Array<{ volume: VisualVolume; chapter: VisualChapter; lesson: VisualLesson }> {
  return grade.volumes.flatMap((volume) =>
    volume.chapters.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({ volume, chapter, lesson })),
    ),
  );
}

const GRADE_ORDER = ['g7', 'g8', 'g1', 'g2'];
const SUBJECT_ACCENTS: Record<string, string> = {
  math: '#38bdf8',
  physics: '#34d399',
};

export function subjectAccent(subjectId: string): string {
  return SUBJECT_ACCENTS[subjectId] ?? '#a78bfa';
}

/** 汇总所有学科的年级，同 id 年级合并统计，按初中→高中顺序排列 */
export function listGrades(manifest: VisualManifest): VisualGradeSummary[] {
  const merged = new Map<string, VisualGradeSummary>();
  for (const subject of manifest.subjects) {
    for (const grade of subject.grades) {
      let summary = merged.get(grade.id);
      if (!summary) {
        summary = {
          id: grade.id,
          name: grade.name,
          subtitle: grade.subtitle,
          accent: grade.accent,
          subjectIds: [],
          volumeCount: 0,
          chapterCount: 0,
          lessonCount: 0,
        };
        merged.set(grade.id, summary);
      }
      if (!summary.subjectIds.includes(subject.id)) summary.subjectIds.push(subject.id);
      summary.volumeCount += grade.volumes.length;
      summary.chapterCount += countChapters(grade);
      summary.lessonCount += countLessons(grade);
    }
  }
  return [...merged.values()].sort((a, b) => {
    const ai = GRADE_ORDER.indexOf(a.id);
    const bi = GRADE_ORDER.indexOf(b.id);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name, 'zh-CN');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** 指定年级下所有可用学科及其对应的年级数据 */
export function subjectsForGrade(manifest: VisualManifest, gradeId: string): VisualSubjectOption[] {
  const options: VisualSubjectOption[] = [];
  for (const subject of manifest.subjects) {
    const grade = subject.grades.find((item) => item.id === gradeId);
    if (grade) options.push({ subject, grade });
  }
  return options;
}

export function findSelection(manifest: VisualManifest, route: VisualRoute): VisualSelection | null {
  for (const subject of manifest.subjects) {
    if (route.subjectId && subject.id !== route.subjectId) continue;
    for (const grade of subject.grades) {
      if (route.gradeId && grade.id !== route.gradeId) continue;
      for (const volume of grade.volumes) {
        if (route.volumeId && volume.id !== route.volumeId) continue;
        for (const chapter of volume.chapters) {
          if (route.chapterId && chapter.id !== route.chapterId) continue;
          const lesson = chapter.lessons.find((item) => item.id === route.lessonId);
          if (lesson) return { subject, grade, volume, chapter, lesson };
        }
      }
    }
  }
  return null;
}

export function isVisualHash(hash: string = window.location.hash): boolean {
  return hash === '#visual' || hash.startsWith('#visual/');
}

export function parseVisualHash(hash: string): VisualRoute {
  if (!isVisualHash(hash)) return {};
  const segments = hash.slice('#visual'.length).replace(/^\//, '').split('/');
  const route: VisualRoute = {};
  ROUTE_KEYS.forEach((key, index) => {
    const value = segments[index];
    if (value && value !== EMPTY_SEGMENT) {
      try {
        route[key] = decodeURIComponent(value);
      } catch {
        route[key] = value;
      }
    }
  });
  return route;
}

export function buildVisualHash(route: VisualRoute): string {
  const segments = ROUTE_KEYS.map((key) =>
    route[key] ? encodeURIComponent(route[key] as string) : EMPTY_SEGMENT,
  );
  while (segments.length > 0 && segments[segments.length - 1] === EMPTY_SEGMENT) segments.pop();
  return segments.length > 0 ? `#visual/${segments.join('/')}` : '#visual';
}
