import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowLeft, Atom, ChevronLeft, ChevronRight, Expand, ExternalLink,
  GraduationCap, Layers, Loader2, Maximize2, Minimize2, Play, RefreshCw, Search,
  Sigma, Sparkles, Wifi, X,
} from 'lucide-react';
import {
  allLessons, buildVisualHash, countLessons, findSelection, listGrades,
  loadVisualManifest, parseVisualHash, subjectAccent, subjectsForGrade,
  type VisualChapter, type VisualLesson, type VisualManifest,
  type VisualRoute, type VisualVolume,
} from './services/visualClassroom';

type Step = 'grade' | 'subject' | 'chapters' | 'viewer';

type LessonEntry = { volume: VisualVolume; chapter: VisualChapter; lesson: VisualLesson };

function stepOf(route: VisualRoute): Step {
  if (!route.gradeId) return 'grade';
  if (!route.subjectId) return 'subject';
  if (!route.lessonId) return 'chapters';
  return 'viewer';
}

const ICON_BUTTON = 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs font-semibold text-slate-200 transition hover:border-cyan-300/40 hover:bg-cyan-300/10 hover:text-white';

function LessonCard({ entry, onOpen }: { entry: LessonEntry; onOpen: () => void }) {
  const { lesson, chapter } = entry;
  return (
    <button
      type="button"
      onClick={onOpen}
      title={lesson.name}
      className="group flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left transition hover:-translate-y-0.5 hover:border-cyan-300/45 hover:bg-cyan-300/[0.09] hover:shadow-[0_10px_30px_rgba(34,211,238,0.12)]"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200 transition group-hover:bg-cyan-300/20">
        <Play size={15} fill="currentColor" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-slate-100">{lesson.name}</span>
        <span className="mt-1 block truncate text-[11px] text-slate-500">{chapter.name}</span>
        {(lesson.needsNetwork || lesson.missingAssets) && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {lesson.needsNetwork && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-400/10 px-1.5 py-0.5 text-[10px] font-medium text-sky-300">
                <Wifi size={10} />需联网
              </span>
            )}
            {lesson.missingAssets && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                <AlertTriangle size={10} />部分资源缺失
              </span>
            )}
          </span>
        )}
      </span>
      <ChevronRight size={15} className="mt-2 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-300" />
    </button>
  );
}

export default function VisualClassroom({ onBack }: { onBack: () => void }) {
  const [manifest, setManifest] = useState<VisualManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [route, setRoute] = useState<VisualRoute>(() => parseVisualHash(window.location.hash));
  const [query, setQuery] = useState('');
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeReady, setIframeReady] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = '可视化课堂 · 数智课堂';
    return () => { document.title = previousTitle; };
  }, []);

  useEffect(() => {
    let alive = true;
    setError(null);
    loadVisualManifest()
      .then((data) => { if (alive) setManifest(data); })
      .catch((cause: unknown) => {
        if (alive) setError(cause instanceof Error ? cause.message : '课件资源加载失败');
      });
    return () => { alive = false; };
  }, [reloadToken]);

  useEffect(() => {
    const nextHash = buildVisualHash(route);
    if (window.location.hash !== nextHash) {
      window.history.replaceState(
        window.history.state, '',
        `${window.location.pathname}${window.location.search}${nextHash}`,
      );
    }
  }, [route]);

  useEffect(() => {
    const handlePopState = () => setRoute(parseVisualHash(window.location.hash));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => { setIframeReady(false); }, [route.lessonId, iframeKey]);

  const subjects = manifest?.subjects ?? [];
  const gradeOptions = useMemo(() => (manifest ? listGrades(manifest) : []), [manifest]);
  const gradeOption = gradeOptions.find((item) => item.id === route.gradeId) ?? null;
  const subjectOptions = useMemo(
    () => (manifest && route.gradeId ? subjectsForGrade(manifest, route.gradeId) : []),
    [manifest, route.gradeId],
  );
  const subject = route.subjectId ? subjects.find((item) => item.id === route.subjectId) ?? null : null;
  const grade = subject?.grades.find((item) => item.id === route.gradeId)
    ?? subjectOptions[0]?.grade
    ?? null;
  const volume = grade?.volumes.find((item) => item.id === route.volumeId) ?? grade?.volumes[0] ?? null;
  const step = stepOf(route);
  const selection = useMemo(
    () => (manifest && step === 'viewer' ? findSelection(manifest, route) : null),
    [manifest, route, step],
  );

  const totalLessons = useMemo(
    () => subjects.reduce((total, item) => total + item.grades.reduce((sum, g) => sum + countLessons(g), 0), 0),
    [subjects],
  );

  const searchTerm = query.trim().toLowerCase();
  const searchResults = useMemo(
    () => (grade && searchTerm ? allLessons(grade).filter((entry) => entry.lesson.name.toLowerCase().includes(searchTerm)) : []),
    [grade, searchTerm],
  );

  const openLesson = useCallback((entry: LessonEntry) => {
    setRoute((current) => ({
      ...current,
      volumeId: entry.volume.id,
      chapterId: entry.chapter.id,
      lessonId: entry.lesson.id,
    }));
  }, []);

  const backOneStep = () => {
    if (step === 'viewer') {
      setRoute({ gradeId: route.gradeId, subjectId: route.subjectId, volumeId: route.volumeId, chapterId: route.chapterId });
    } else if (step === 'chapters') {
      setRoute({ gradeId: route.gradeId });
    } else {
      setRoute({});
    }
    setQuery('');
  };

  const toggleFullscreen = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const request = document.fullscreenElement
      ? document.exitFullscreen?.()
      : stage.requestFullscreen?.();
    if (request && typeof request.catch === 'function') request.catch(() => undefined);
  };

  const crumbs: Array<{ label: string; onClick?: () => void }> = [
    { label: '可视化课堂', onClick: () => setRoute({}) },
  ];
  const gradeLabel = gradeOption?.name ?? grade?.name;
  if (gradeLabel) crumbs.push({ label: gradeLabel, onClick: () => setRoute({ gradeId: route.gradeId }) });
  if (step === 'chapters' || step === 'viewer') crumbs.push({ label: subject?.name ?? '学科' });
  if (step === 'viewer' && selection) {
    crumbs.push({ label: selection.chapter.name });
    crumbs.push({ label: selection.lesson.name });
  }

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#050914] text-slate-100">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-40 -top-40 h-[42vw] w-[42vw] rounded-full bg-cyan-500/10 blur-[140px]" />
        <div className="absolute -bottom-52 right-[-10%] h-[40vw] w-[40vw] rounded-full bg-indigo-500/10 blur-[150px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(15,40,70,0.55),transparent_70%)]" />
      </div>

      <header className={`relative z-20 flex shrink-0 items-center justify-between gap-4 px-7 ${step === 'viewer' ? 'h-[64px]' : 'h-[84px]'}`}>
        <div className="flex min-w-0 items-center gap-4">
          <img src="/brand/smart-cube-tech/mark.svg" alt="数智课堂" className="h-10 w-10 shrink-0 drop-shadow-[0_0_16px_rgba(56,189,248,0.45)]" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight">可视化课堂</h1>
            <p className="truncate text-xs font-semibold text-slate-400">{subjects.map((item) => item.name).join(' · ')} · 互动可视化课件库</p>
          </div>
          {totalLessons > 0 && (
            <span className="hidden shrink-0 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200 sm:inline-flex">
              {totalLessons} 个互动课件
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {step !== 'grade' && (
            <button type="button" onClick={backOneStep} className={ICON_BUTTON}>
              <ChevronLeft size={14} />返回上一级
            </button>
          )}
          <button type="button" onClick={onBack} className={ICON_BUTTON}>
            <ArrowLeft size={14} />返回数智课堂
          </button>
        </div>
      </header>

      {step !== 'grade' && (
        <nav className={`relative z-10 flex shrink-0 flex-wrap items-center gap-1.5 px-7 text-xs text-slate-400 ${step === 'viewer' ? 'pb-3' : 'pb-4'}`} aria-label="面包屑">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={`${crumb.label}-${index}`}>
              {index > 0 && <ChevronRight size={12} className="text-slate-600" />}
              {crumb.onClick ? (
                <button type="button" onClick={crumb.onClick} className="max-w-[220px] truncate transition hover:text-cyan-300">{crumb.label}</button>
              ) : (
                <span className="max-w-[220px] truncate font-semibold text-slate-200">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
          {step === 'viewer' && selection && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {selection.lesson.needsNetwork && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-sky-400/10 px-2 py-1 text-[11px] text-sky-300">
                  <Wifi size={12} />需联网加载 3D 组件
                </span>
              )}
              {selection.lesson.missingAssets && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/10 px-2 py-1 text-[11px] text-amber-300">
                  <AlertTriangle size={12} />部分子模型未提供
                </span>
              )}
              <button type="button" onClick={() => setIframeKey((value) => value + 1)} className={ICON_BUTTON} title="重新加载课件">
                <RefreshCw size={14} />刷新
              </button>
              <button
                type="button"
                onClick={() => setCompactMode((value) => !value)}
                className={ICON_BUTTON}
                title={compactMode ? '恢复为铺满窗口播放' : '切换为居中卡片播放'}
              >
                {compactMode ? <Expand size={14} /> : <Minimize2 size={14} />}
                {compactMode ? '铺满播放' : '居中播放'}
              </button>
              <button type="button" onClick={toggleFullscreen} className={ICON_BUTTON} title="全屏播放">
                <Maximize2 size={14} />全屏
              </button>
              <a href={selection.lesson.url} target="_blank" rel="noopener noreferrer" className={ICON_BUTTON} title="在新窗口打开">
                <ExternalLink size={14} />新窗口
              </a>
            </div>
          )}
        </nav>
      )}

      {error ? (
        <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-7 pb-8">
          <div className="max-w-md rounded-2xl border border-rose-400/25 bg-rose-400/[0.07] p-8 text-center">
            <AlertTriangle size={28} className="mx-auto mb-3 text-rose-300" />
            <h2 className="text-base font-bold text-rose-100">课件资源加载失败</h2>
            <p className="mt-2 text-sm text-slate-400">{error}</p>
            <button type="button" onClick={() => setReloadToken((value) => value + 1)} className={`mt-5 ${ICON_BUTTON}`}>
              <RefreshCw size={14} />重新加载
            </button>
          </div>
        </main>
      ) : !manifest ? (
        <main className="relative z-10 flex min-h-0 flex-1 items-center justify-center">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin text-cyan-300" />正在加载课件资源…
          </div>
        </main>
      ) : step === 'viewer' ? (
        <div className={`relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto ${compactMode ? 'px-7 pb-6' : 'px-4 pb-4'}`}>
          {selection ? (
            <>
              <div
                ref={stageRef}
                className={`relative mx-auto w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.45)] ${compactMode ? 'max-w-[1200px]' : 'min-h-0 flex-1 max-w-none'}`}
                style={compactMode ? { height: 'min(66vh, 820px)', minHeight: 360 } : undefined}
              >
                {!iframeReady && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#050914] text-sm text-slate-400">
                    <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin text-cyan-300" />课件加载中…</span>
                  </div>
                )}
                <iframe
                  key={`${selection.lesson.url}-${iframeKey}`}
                  src={selection.lesson.url}
                  title={selection.lesson.name}
                  className="h-full w-full border-0"
                  onLoad={() => setIframeReady(true)}
                  allow="fullscreen; autoplay; clipboard-write"
                  allowFullScreen
                />
              </div>
              {compactMode && (
                <p className="mx-auto mt-3 w-full max-w-[1200px] text-center text-[11px] text-slate-500">
                  当前为居中卡片模式，点「铺满播放」可让课件扩展到整个页面
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle size={28} className="text-amber-300" />
              <p className="text-sm text-slate-300">未找到该课件，可能资源清单已更新。</p>
              <button type="button" onClick={backOneStep} className={ICON_BUTTON}>返回章节列表</button>
            </div>
          )}
        </div>
      ) : (
        <main className="relative z-10 min-h-0 flex-1 overflow-y-auto px-7 pb-10">
          {step === 'grade' && (
            <section className="mx-auto max-w-6xl">
              <div className="mb-8">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  <Sparkles size={13} />选择年级开始探索
                </div>
                <h2 className="text-2xl font-black tracking-tight">今天想看哪一册？</h2>
                <p className="mt-2 text-sm text-slate-400">按教材章节整理的 {subjects.map((item) => item.name).join('、')} 互动课件，选择年级与学科后即可直接播放。</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {gradeOptions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRoute({ gradeId: item.id })}
                    className="group relative overflow-hidden rounded-3xl border border-white/10 p-6 text-left transition hover:-translate-y-1 hover:border-cyan-300/40 hover:shadow-[0_18px_50px_rgba(34,211,238,0.14)]"
                    style={{ background: `linear-gradient(140deg, ${item.accent}1f, rgba(255,255,255,0.025) 60%)` }}
                  >
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]" style={{ color: item.accent }}>
                      <GraduationCap size={24} />
                    </span>
                    <h3 className="mt-5 text-2xl font-black">{item.name}</h3>
                    <p className="mt-1 text-sm text-slate-400">{item.subtitle}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {item.subjectIds.map((subjectId) => (
                        <span key={subjectId} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[11px] text-slate-300">
                          {subjects.find((entry) => entry.id === subjectId)?.name ?? subjectId}
                        </span>
                      ))}
                    </div>
                    <div className="mt-6 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-400">
                      <span>{item.volumeCount} 册教材</span>
                      <span>{item.chapterCount} 个章节</span>
                      <span>{item.lessonCount} 个课件</span>
                    </div>
                    <ChevronRight size={20} className="absolute right-5 top-5 text-slate-600 transition group-hover:translate-x-1" style={{ color: item.accent }} />
                  </button>
                ))}
              </div>
              <p className="mt-8 text-xs text-slate-500">资源来源：人教版 {subjects.map((item) => item.name).join(' / ')} 可视化 HTML 课件包 · 当前共 {totalLessons} 个课件</p>
            </section>
          )}

          {step === 'subject' && gradeOption && (
            <section className="mx-auto max-w-6xl">
              <div className="mb-8">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                  <Layers size={13} />{gradeOption.name}
                </div>
                <h2 className="text-2xl font-black tracking-tight">选择学科</h2>
                <p className="mt-2 text-sm text-slate-400">{gradeOption.name} 已收录 {subjectOptions.length} 个学科，选择后即可查看按章节整理的互动课件。</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {subjectOptions.map(({ subject: item, grade: itemGrade }) => {
                  const accent = subjectAccent(item.id);
                  const SubjectIcon = item.id === 'physics' ? Atom : item.id === 'math' ? Sigma : Sparkles;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRoute({ gradeId: gradeOption.id, subjectId: item.id })}
                      className="group rounded-3xl border border-white/10 p-6 text-left transition hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_18px_50px_rgba(34,211,238,0.16)]"
                      style={{ background: `linear-gradient(140deg, ${accent}1f, rgba(255,255,255,0.025) 65%)` }}
                    >
                      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.06]" style={{ color: accent }}>
                        <SubjectIcon size={24} />
                      </span>
                      <h3 className="mt-5 text-2xl font-black">{item.name}</h3>
                      <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      <p className="mt-6 text-xs font-semibold" style={{ color: accent }}>
                        {countLessons(itemGrade)} 个课件 · {itemGrade.volumes.length} 册教材 · 点击进入
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {step === 'subject' && !gradeOption && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle size={26} className="text-amber-300" />
              <p className="text-sm text-slate-300">未找到该年级，可能资源清单已更新。</p>
              <button type="button" onClick={() => setRoute({})} className={ICON_BUTTON}>返回年级选择</button>
            </div>
          )}

          {step === 'chapters' && grade && subject && (
            <section className="mx-auto max-w-6xl">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-200">
                    {subject.id === 'physics' ? <Atom size={13} /> : <Sigma size={13} />}{grade.name} · {subject.name}
                  </div>
                  <h2 className="text-2xl font-black tracking-tight">章节课件</h2>
                  <p className="mt-2 text-sm text-slate-400">点击任意课件即可在站内直接播放，无需跳转外部网站。</p>
                </div>
                <label className="relative flex h-10 w-full items-center sm:w-64">
                  <Search size={15} className="pointer-events-none absolute left-3 text-slate-500" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="搜索课件名称"
                    className="h-full w-full rounded-xl border border-white/10 bg-white/[0.05] pl-9 pr-9 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/50"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} aria-label="清空搜索" className="absolute right-2 text-slate-500 transition hover:text-slate-200">
                      <X size={14} />
                    </button>
                  )}
                </label>
              </div>

              {searchTerm ? (
                <>
                  <p className="mb-4 text-xs text-slate-500">找到 {searchResults.length} 个匹配课件</p>
                  {searchResults.length > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      {searchResults.map((entry) => (
                        <LessonCard key={entry.lesson.id} entry={entry} onOpen={() => openLesson(entry)} />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center text-sm text-slate-500">没有匹配的课件，换个关键词试试。</div>
                  )}
                </>
              ) : (
                <>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {grade.volumes.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setRoute((current) => ({ ...current, volumeId: item.id }))}
                        className={`rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                          volume?.id === item.id
                            ? 'border-cyan-300/50 bg-cyan-300/15 text-cyan-200'
                            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:border-white/25 hover:text-slate-200'
                        }`}
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                  {volume && (
                    <div className="space-y-8">
                      {volume.chapters.map((chapter, chapterIndex) => (
                        <div key={chapter.id}>
                          <div className="mb-3 flex items-center gap-3">
                            <span title="册内序号" className="grid h-8 w-8 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-xs font-bold text-cyan-200">{chapterIndex + 1}</span>
                            <h3 className="text-base font-bold">{chapter.name}</h3>
                            <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] text-slate-400">{chapter.lessons.length} 个课件</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {chapter.lessons.map((lesson) => (
                              <LessonCard
                                key={lesson.id}
                                entry={{ volume, chapter, lesson }}
                                onOpen={() => openLesson({ volume, chapter, lesson })}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {step === 'chapters' && !(grade && subject) && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 text-center">
              <AlertTriangle size={26} className="text-amber-300" />
              <p className="text-sm text-slate-300">未找到该学科的章节，可能资源清单已更新。</p>
              <button type="button" onClick={() => setRoute({ gradeId: route.gradeId })} className={ICON_BUTTON}>返回学科选择</button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}
