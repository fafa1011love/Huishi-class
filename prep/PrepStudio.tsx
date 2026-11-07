import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Archive, ArrowLeft, ArrowRight, BookOpen, Box, Check, ChevronDown, ClipboardList, Copy, Download,
  FileText, FolderOpen, History, Layers3, Lightbulb, LoaderCircle, MonitorPlay, Plus,
  RefreshCw, Search, Settings2, Sparkles, Target, Trash2, UploadCloud, WandSparkles, X,
  ChevronLeft, ChevronRight, Eye, MoveDown, MoveUp, Maximize2, Minimize2,
} from 'lucide-react'
import type { WarmupQuestion } from '../services/quizData'
import type { DragEvent } from 'react'
import type { ReactNode } from 'react'
import { durationByLessonCount, lessonCountByDuration, normalizeLessonSchedule } from '../services/lessonSchedule'
import { k12GradesByStage, k12StageOptions, normalizeK12Stage, resolveK12TemplateStage, subjectsForK12Stage, textbookOptionsForK12Stage } from '../services/k12Template'
import { prepareCoursewareViews, resolveExportModelUrl } from '../services/coursewareExport'
import { contentFingerprint, normalizeClassroomPlan, persistentClassroomPlan, type ClassroomData, type TeacherReview } from '../services/classroomLibrary'
import type { CoursewareManifest } from '../types/courseware'
import type { ClassroomModelAsset } from '../types/courseware'
import type { DesignStep, LessonDesignWorkflow } from '../types/lessonDesign'
import { getLocalModel, saveUploadedModel, saveGeneratedModel } from '../services/localModelLibrary'
import type { ModelType, ControlRefs } from '../types'
import ModelViewer from '../components/ModelViewer'
import CoursewareStoryboard from './CoursewareStoryboard'
import UndergraduateDesignWorkflow from './UndergraduateDesignWorkflow'
import LessonExportPage from './LessonExportPage'

type FormState = {
  stage: string; grade: string; subject: string; topic: string; lessonType: string
  duration: string; lessonCount: string; classSize: string; learningSituation: string; objectives: string
  keyPoints: string; difficulties: string; methods: string; resources: string
  assessment: string; homework: string; textbookVersion: string; chapter: string
  unitPosition: string; teachingScene: string; priorKnowledge: string; misconceptions: string
  examPoints: string; coreQuestion: string; materialName: string; materialText: string
  materialPolicy: string; pptTheme: string; pptLength: string; visualBalance: string
  teachingRhythm: string; answerReveal: string; speakerNotes: string; highlightExam: string
  use3d: string
  field: string; courseName: string; semester: string; courseType: string; credits: string; courseHours: string
  prerequisites: string; learningOutcomes: string; assessmentMethod: string
  includeCase: string; includeExperiment: string; includeResearch: string
  designMode: 'quick' | 'guided'; abilityLevel: '基础层' | '进阶层'
}
type Reference = { title: string; author: string; year: string; sourceType: string; sourceUrl: string; license: string; usedIn: string[] }
type BioPart = { key: string; name: string; englishName: string; color: string }
type BioModelPlan = { modelKey: string; modelName: string; parts: string[]; partDetails: BioPart[]; observationTasks: string[]; renderMode: string; references: Reference[]; quality?: string }
type BioResult = BioModelPlan & { status: string; editable: boolean; message: string; blendUrl: string; glbUrl: string; previewUrl: string }
type ArtifactState = Partial<Record<'pptx' | 'glb' | 'blend' | 'preview', string>>
type SlidePlan = { type?: string; title: string; subtitle?: string; items?: string[]; purpose?: string; visual?: string; interaction?: string; layout?: string; proof?: string; assetQuery?: string; visualProfile?: string }
type SlidePreview = SlidePlan & { index: number; sourceIndex?: number; previewSvg: string }
type QualityReport = { score: number; blocking: { code: string; slide?: number; message: string }[]; warnings: { code: string; slide?: number; message: string }[]; slideCount: number; layouts: string[] }
type AssetCandidate = { sourceType: string; localPath: string; sourceUrl: string; license: string; altText: string; cropMode: string; subjectTags: string[]; thumbnail?: string }
type LessonPlan = {
  classroomData?: ClassroomData
  id: string; createdAt: string; title: string; overview: string; objectives: string[]
  situation: string; keyPoints: string[]; difficulties: string[]; methods: string[]
  resources: string; assessment: string; homework: string; blackboard: string[]
  phases: { time: number; name: string; teacher: string; student: string; check: string; output?: string }[]
  slides: SlidePlan[]
  request: FormState
  generation?: { engine: 'ollama' | 'builtin-template' | 'unavailable'; model?: string; message: string }
  coreQuestion?: string; priorKnowledge?: string[]; misconceptions?: string[]; examPoints?: string[]; blackboardDesign?: string[]
  courseProfile?: { stage: string; field: string; courseName: string; courseType: string; semester: string; credits: string; courseHours: string }
  learningOutcomes?: string[]; prerequisites?: string[]; knowledgeMap?: string[]; casePrompt?: string; assessmentPlan?: string[]
  professionalOutcomes?: string[]; generalOutcomes?: string[]; contentAnalysis?: Record<string, string[]>; contentAnalysisDetail?: { type?: string; content?: string; worthLearning?: string; focus?: string; breakthrough?: string; evidence?: string; difficulty?: string }[]
  introDesign?: { hookType: string; reason: string; script: string; studentPrediction: string; duration: number }
  questionChain?: { level: string; question: string; followUp: string; studentGain: string }[]
  teacherActions?: { stage: string; actions: string[]; detail: string; board: string }[]
  activities?: { name: string; level: string; type: string; duration: number; student?: string; learn?: string; result?: string; evaluation?: string; role?: string; studentAction?: string; learningContent?: string; visibleOutput?: string; teacherRole?: string; teacherProcess?: string; studentSteps?: string[]; questioning?: string[]; organizationDetail?: string; evidence?: string; remediationPlan?: string; designRationale?: string; teacherScript?: string[]; materials?: string[]; checkpoints?: { time: string; teacherCheck: string; studentEvidence: string }[]; evaluationRubric?: { criterion: string; fullMark: string; support: string }[]; commonErrors?: string[] }[]
  boardDesign?: string[]; abilityDifferentiation?: Record<string, string>; teachingPainPoints?: string[]; designRationale?: string[]; reflectionPrompts?: string[]
  designWorkflow?: LessonDesignWorkflow; alignmentMatrix?: Array<Record<string, unknown>>
  templateStage?: '小学1-3年级' | '小学4-6年级' | '初中' | '高中'
  modelAsset?: Record<string, unknown>
  warmupQuestions?: WarmupQuestion[]
  references?: Reference[]; modelPlan?: BioModelPlan
}
type RecordItem = { id: string; title: string; subject: string; grade: string; updatedAt: string; plan: LessonPlan }
type BusyState = 'preview' | 'ppt' | '3d' | 'warmup' | 'courseware' | null
type ModelOptions = { textureResolution: string; foregroundRatio: string; vertexCount: string; removeBackground: boolean; separationMode: 'geometric' | 'anatomical' }
type ModelMode = 'single' | 'multiview'
type ModelViews = Partial<Record<'front' | 'left' | 'right' | 'back', File>>
type ImageModelResult = { status: string; editable: boolean; message: string; glbUrl: string; modelUrl?: string; exportModelUrl?: string; localPreviewUrl?: string; remoteModelId?: string; fullGlbUrl?: string; appearanceUrl?: string; blendUrl: string; previewUrl: string; viewImageUrls?: { front?: string; left?: string; right?: string; back?: string }; parts: { name: string; partKey: string; source: string }[]; engine?: string; viewsUsed?: string[]; registration?: { status: string; confidence: number; silhouetteIoU?: Record<string, number> }; textureProjection?: { status: string; viewsUsed: number }; source?: 'imported' | 'generated'; localModelId?: string; modelType?: ModelType; assetUrls?: Record<string, string>; fileName?: string }
type WarmupGeneration = { engine: 'ollama' | 'responses' | 'builtin-template'; model?: string; message: string; warnings?: string[] }
type GenerationStatus = { kind: 'success' | 'error'; message: string }
type ModelGenerationQuota = { total: number; used: number; remaining: number }

const resolveAppearanceModelUrl = (asset: Record<string, unknown> | null | undefined) => {
  if (!asset) return ''
  for (const key of ['appearanceUrl', 'modelUrl', 'glbUrl'] as const) {
    const value = asset[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}
const hasUsableModelAsset = (asset: Record<string, unknown> | null | undefined, currentUrl = '') => Boolean(currentUrl.trim() || resolveAppearanceModelUrl(asset))
type WorkbenchStage = 'model' | 'lesson' | 'output'

// 真实的 AI 生成引擎（云端 responses；ollama 已停用，仅用于识别旧记录）；builtin-template 表示降级到系统模板
const AI_GENERATION_ENGINES = ['ollama', 'responses'] as const
function isAiGeneration(engine?: string): boolean {
  return !!engine && (AI_GENERATION_ENGINES as readonly string[]).includes(engine)
}

const initialForm: FormState = {
  stage: '本科', grade: '', subject: '生物医学', topic: '', lessonType: '新授课', duration: '40', lessonCount: '1', classSize: '40人',
  textbookVersion: '', chapter: '', unitPosition: '结构与功能', teachingScene: '日常课堂',
  learningSituation: '', priorKnowledge: '', misconceptions: '', examPoints: '', coreQuestion: '', objectives: '', keyPoints: '', difficulties: '',
  methods: '', resources: '', assessment: '', homework: '',
  materialName: '', materialText: '', materialPolicy: '教材优先，允许补充', pptTheme: '自动推荐', pptLength: '标准',
  visualBalance: '图文均衡', teachingRhythm: '互动型', answerReveal: '包含', speakerNotes: '包含', highlightExam: '突出', use3d: '按需使用',
  field: '生物医学', courseName: '人体解剖学与生理学', semester: '第一学期', courseType: '专业核心课', credits: '2', courseHours: '32',
  prerequisites: '', learningOutcomes: '', assessmentMethod: '', includeCase: '包含', includeExperiment: '包含', includeResearch: '不包含',
  designMode: 'quick', abilityLevel: '基础层',
}

const undergraduateDefaults: Partial<FormState> = {
  stage: '本科', grade: '', subject: '生物医学', topic: '心脏血流与心脏结构', duration: '40', lessonCount: '1', lessonType: '新授课',
  textbookVersion: '', chapter: '', unitPosition: '结构与功能', learningSituation: '', priorKnowledge: '', misconceptions: '', examPoints: '',
  coreQuestion: '', objectives: '', keyPoints: '', difficulties: '', methods: '', resources: '', assessment: '', homework: '',
  pptTheme: '医学高对比', pptLength: '标准', teachingRhythm: '理论·结构·案例', highlightExam: '不突出', use3d: '按需使用',
  designMode: 'quick', abilityLevel: '基础层',
}

const stageOptions = [...k12StageOptions, '本科']
const gradesByStage: Record<string, string[]> = k12GradesByStage
const k12Defaults: Partial<FormState> = {
  subject: '', field: '', courseName: '', grade: '', unitPosition: '',
  pptTheme: '自动推荐', teachingRhythm: '互动型', highlightExam: '突出',
}

const defaultForm: FormState = { ...initialForm, ...undergraduateDefaults, duration: '40', grade: '' }

const normalizeLoadedForm = (request: Partial<FormState>): FormState => {
  const undergraduate = !request.stage || request.stage === '本科'
  const stage = undergraduate ? '本科' : normalizeK12Stage(request.stage, request.grade)
  const merged = { ...initialForm, ...(undergraduate ? undergraduateDefaults : k12Defaults), ...request, stage }
  return {
    ...merged,
    ...normalizeLessonSchedule(request),
    grade: undergraduate ? '' : gradesByStage[stage]?.includes(request.grade || '') ? request.grade! : '',
    subject: undergraduate || subjectsForK12Stage(stage, merged.grade).includes(request.subject || '') ? merged.subject : '',
  }
}

const splitLines = (value: string) => value.split('\n').map((x) => x.trim()).filter(Boolean)
const slideLayoutOptions = [
  ['hero-stack', '封面叙事'], ['question-split', '核心问题'], ['three-column', '三栏探索'],
  ['source-quote', '教材引文'], ['layer-map', '概念层级'], ['step-flow', '方法步骤'],
  ['compare-duo', '观点对照'], ['task-timer', '练习计时'], ['evidence-list', '迁移检测'],
  ['answer-rail', '答案揭示'], ['exam-map', '考点地图'], ['observation-stage', '观察任务'],
  ['loop-summary', '课堂总结'], ['take-home', '作业任务'],
] as const
const formToPayload = (form: FormState) => { const schedule = normalizeLessonSchedule(form); return { ...form, templateStage: form.stage === '本科' ? undefined : resolveK12TemplateStage(form.stage, form.grade), duration: Number(schedule.duration), lessonCount: Number(schedule.lessonCount), objectives: splitLines(form.objectives), keyPoints: splitLines(form.keyPoints), difficulties: splitLines(form.difficulties), methods: splitLines(form.methods) } }
const recordKey = 'teacher-studio.records.v1'
const fiveStepTitles = ['专业能力目标与课程定位', '学习内容、重点难点与学情诊断', '问题链与教师教学行为', '教学活动、评价与通用能力', '教案定稿与对齐审核']

function normalizePlanToFiveSteps(plan: LessonPlan): LessonPlan {
  if (plan.request?.stage && plan.request.stage !== '本科') return plan
  const workflow = plan.designWorkflow
  if (!workflow || workflow.steps.length !== 7) return plan
  const byId = new Map(workflow.steps.map((step) => [step.id, step]))
  const merge = (firstId: string, secondId: string, id: 'reasoning-teaching' | 'activities-competencies', number: number) => {
    const first = byId.get(firstId as DesignStep['id'])
    const second = byId.get(secondId as DesignStep['id'])
    const stale = first?.status === 'stale' || second?.status === 'stale'
    return {
      id, number, title: fiveStepTitles[number - 1], status: stale ? 'stale' as const : 'ready' as const,
      approved: Boolean(first?.approved && second?.approved && !stale),
      source: first?.source === 'teacher-edited' || second?.source === 'teacher-edited' ? 'teacher-edited' as const : 'generated' as const,
      data: { [firstId]: first?.data || {}, [secondId]: second?.data || {} },
      systemData: { [firstId]: first?.systemData || first?.data || {}, [secondId]: second?.systemData || second?.data || {} },
    }
  }
  const steps = [
    { ...workflow.steps[0], id: 'objectives' as const, number: 1, title: fiveStepTitles[0] },
    { ...workflow.steps[1], id: 'content' as const, number: 2, title: fiveStepTitles[1] },
    merge('path', 'teaching', 'reasoning-teaching', 3),
    merge('activities', 'competencies', 'activities-competencies', 4),
    { ...workflow.steps[6], id: 'final' as const, number: 5, title: fiveStepTitles[4] },
  ].map((step) => ({ ...step, approved: Boolean(step.approved && step.status !== 'stale') }))
  return {
    ...plan,
    designWorkflow: {
      ...workflow, version: 2, standard: 'teacher-ai-five-step-20260625', steps,
      currentStep: Math.min(5, Math.max(1, workflow.currentStep || 1)),
      staleSteps: steps.filter((step) => step.status === 'stale').map((step) => step.id),
      ...(steps.some((step) => step.status === 'stale') ? { status: 'review' as const, qualityPending: true } : {}),
    },
  }
}

type PrepStudioProps = {
  onBack: () => void
  embedded?: boolean
  onApplyLesson?: (lesson: LessonPlan, modelUrl?: string, warmupQuestions?: WarmupQuestion[], courseware?: CoursewareManifest, modelAsset?: ClassroomModelAsset) => void
  userId?: number
  isAdmin?: boolean
}

function PrepStudio({ onBack, embedded = false, onApplyLesson, userId = 0, isAdmin = false }: PrepStudioProps) {
  const unitPositionEdited = useRef(false)
  const [view, setView] = useState<'new' | 'records' | 'knowledge'>('new')
  const [form, setForm] = useState<FormState>(defaultForm)
  const [plan, setPlan] = useState<LessonPlan | null>(null)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [autoSavedAt, setAutoSavedAt] = useState('')
  const [busy, setBusy] = useState<BusyState>(null)
  const [toast, setToast] = useState('')
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus | null>(null)
  const [query, setQuery] = useState('')
  const [modelFile, setModelFile] = useState<File | null>(null)
  const [modelUrl, setModelUrl] = useState('')
  const [bioResult, setBioResult] = useState<BioResult | null>(null)
  const [artifacts, setArtifacts] = useState<ArtifactState>({})
  const [pptArtifact, setPptArtifact] = useState<{ downloadUrl: string; fileName: string } | null>(null)
  const [modelAsset, setModelAsset] = useState<Record<string, unknown> | null>(null)
  const [warmupQuestions, setWarmupQuestions] = useState<WarmupQuestion[]>([])
  const [warmupGeneration, setWarmupGeneration] = useState<WarmupGeneration | null>(null)
  const [coursewareManifest, setCoursewareManifest] = useState<CoursewareManifest | null>(null)
  const [modelOptions, setModelOptions] = useState<ModelOptions>({ textureResolution: '1024', foregroundRatio: '0.85', vertexCount: '-1', removeBackground: true, separationMode: 'anatomical' })
  const [workbenchStage, setWorkbenchStage] = useState<WorkbenchStage>('lesson')
  const [modelRecommendationOpen, setModelRecommendationOpen] = useState(false)
  const [modelModalOpen, setModelModalOpen] = useState(false)
  const [modelRecommendationShown, setModelRecommendationShown] = useState(false)
  const [modelRecommendationReason, setModelRecommendationReason] = useState<'before-lesson' | 'after-approval' | null>(null)
  const importedObjectUrls = useRef<string[]>([])
  const importedFilesRef = useRef<File[]>([])
  const [threeDConfigured, setThreeDConfigured] = useState<boolean | null>(null)
  const [modelGenerationQuota, setModelGenerationQuota] = useState<ModelGenerationQuota | null>(null)
  const [prepStep, setPrepStep] = useState<1 | 2 | 3>(1)
  const [showFullForm, setShowFullForm] = useState(false)
  const refreshModelGenerationQuota = async () => {
    try {
      const response = await fetch('/api/models/generation-quota', { credentials: 'include' })
      if (!response.ok) return
      const data = await response.json()
      if (data.quota && Number.isFinite(data.quota.remaining)) setModelGenerationQuota(data.quota)
    } catch { /* The server remains authoritative when quota status is unavailable. */ }
  }
  const updatePlan = (next: LessonPlan) => {
    const { classroomData: _oldData, ...oldContent } = plan || {} as LessonPlan
    const { classroomData: _newData, ...newContent } = next
    if (contentFingerprint(oldContent) === contentFingerprint(newContent)) { setPlan(next); return }
    const preservedAsset = modelAsset || next.modelAsset || plan?.modelAsset || undefined
    const preservedUrl = resolveAppearanceModelUrl(preservedAsset)
    if (JSON.stringify(next.modelPlan) !== JSON.stringify(plan?.modelPlan)) setBioResult(null)
    if (!modelAsset && preservedAsset) setModelAsset(preservedAsset)
    if (!modelUrl && preservedUrl) setModelUrl(preservedUrl)
    setPptArtifact(null)
    setArtifacts((current) => ({ ...current, pptx: 'pending' }))
    setCoursewareManifest(null)
    setPlan({ ...next, modelAsset: preservedAsset, classroomData: undefined })
  }
  const clearImportedObjectUrls = () => {
    importedObjectUrls.current.forEach((url) => URL.revokeObjectURL(url))
    importedObjectUrls.current = []
  }
  useEffect(() => () => clearImportedObjectUrls(), [])
  const buildImportedAsset = (record: { id: string; ownerId: number; name: string; type: ModelType; blob: Blob; assets?: Array<{ name: string; blob: Blob }> } | null, remote: Record<string, unknown> = {}) => {
    if (!record) throw new Error('模型未找到')
    clearImportedObjectUrls()
    const modelObjectUrl = URL.createObjectURL(record.blob)
    importedObjectUrls.current.push(modelObjectUrl)
    const assetUrls: Record<string, string> = {}
    assetUrls[record.name] = modelObjectUrl
    assetUrls[record.name.toLowerCase()] = modelObjectUrl
    for (const asset of record.assets || []) {
      const url = URL.createObjectURL(asset.blob)
      importedObjectUrls.current.push(url)
      assetUrls[asset.name] = url
      assetUrls[asset.name.toLowerCase()] = url
    }
    const remoteUrl = typeof remote.modelUrl === 'string' ? remote.modelUrl : (typeof remote.glbUrl === 'string' ? remote.glbUrl : '')
    const remoteAssetUrls = remote.assetUrls && typeof remote.assetUrls === 'object' ? remote.assetUrls as Record<string, string> : {}
    return {
      status: 'generated', editable: true, message: '模型已导入', glbUrl: remoteUrl || modelObjectUrl, modelUrl: remoteUrl || modelObjectUrl,
      exportModelUrl: remoteUrl, localPreviewUrl: modelObjectUrl, remoteModelId: typeof remote.id === 'string' ? remote.id : '',
      previewUrl: '', blendUrl: '', parts: [], source: 'imported' as const,
      localModelId: record.id, modelType: record.type, assetUrls: { ...assetUrls, ...remoteAssetUrls }, fileName: record.name,
      anatomyDisplayAvailable: false,
    }
  }
  const uploadImportedModel = async (files: File[]) => {
    const primary = files.find((file) => /\.(glb|gltf|fbx)$/i.test(file.name))
    if (!primary) throw new Error('请选择 GLB、GLTF 或 FBX 模型文件')
    const createBody = () => {
      const body = new FormData()
      files.forEach((file) => body.append('files', file, file.name))
      body.append('primaryFileName', primary.name)
      return body
    }
    const uploadUrls = ['/api/models/import']
    if (typeof window !== 'undefined' && window.location.hostname) {
      uploadUrls.push(`http://${window.location.hostname}:4000/api/models/import`)
    }
    let response: Response
    try {
      response = await fetch(uploadUrls[0], { method: 'POST', credentials: 'include', body: createBody() })
    } catch {
      // A page opened from a secondary local port may not have a Vite proxy.
      try {
        response = await fetch(uploadUrls[1], { method: 'POST', credentials: 'include', body: createBody() })
      } catch {
        throw new Error(`无法连接模型上传服务（${uploadUrls[0]}），请确认后台 API 服务已启动后刷新页面重试`)
      }
    }
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) throw new Error('登录状态已失效，请刷新页面后重新登录')
    if (response.status === 413) throw new Error('模型及附件超过 260 MB，请压缩文件或减少附件后重试')
    if (!response.ok || !data.model?.modelUrl) throw new Error(data.message || data.error || `模型上传失败（HTTP ${response.status}）`)
    return data.model as Record<string, unknown>
  }
  const importModel = async (files: File[]) => {
    if (!userId) throw new Error('当前用户信息未加载，暂时无法保存模型')
    const record = await saveUploadedModel({ ownerId: userId, files })
    importedFilesRef.current = files
    let remote: Record<string, unknown> = {}
    let syncWarning = ''
    try {
      remote = await uploadImportedModel(files)
    } catch (error) {
      syncWarning = `模型已保存并可预览，但同步到课堂模型库失败：${error instanceof Error ? error.message : '后台服务暂不可用'}`
    }
    const imported = buildImportedAsset(record, remote)
    setModelUrl(imported.localPreviewUrl || imported.glbUrl)
    setModelAsset(imported)
    setModelFile(null)
    setCoursewareManifest(null)
    setPlan((current) => current ? { ...current, modelAsset: imported } : current)
    setArtifacts((current) => ({ ...current, glb: 'generated', blend: 'unavailable', preview: 'pending' }))
    setToast(syncWarning || '模型已导入，可直接预览并应用到本课')
    return imported
  }
  const ensureImportedModelExportUrl = async (asset: Record<string, unknown>) => {
    const existing = resolveExportModelUrl(asset)
    if (existing) return asset
    if (asset.source !== 'imported' || importedFilesRef.current.length === 0) return asset
    const remote = await uploadImportedModel(importedFilesRef.current)
    const nextAsset = { ...asset, modelUrl: remote.modelUrl || asset.modelUrl, exportModelUrl: remote.modelUrl || remote.glbUrl, remoteModelId: remote.id || asset.remoteModelId, assetUrls: { ...(asset.assetUrls && typeof asset.assetUrls === 'object' ? asset.assetUrls as Record<string, string> : {}), ...(remote.assetUrls && typeof remote.assetUrls === 'object' ? remote.assetUrls as Record<string, string> : {}) } }
    setModelAsset(nextAsset)
    setPlan((current) => current ? { ...current, modelAsset: nextAsset } : current)
    return nextAsset
  }
  const restoreImportedModel = async (asset: Record<string, unknown>) => {
    const id = typeof asset.localModelId === 'string' ? asset.localModelId : ''
    if (!id || !userId) return false
    const record = await getLocalModel(id, userId)
    if (!record) return false
    const restored = buildImportedAsset(record, asset)
    setModelAsset(restored)
    setModelUrl(restored.localPreviewUrl || restored.glbUrl)
    return true
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      let legacy: RecordItem[] = []
      try { legacy = JSON.parse(localStorage.getItem(recordKey) || '[]') } catch { legacy = [] }
      try {
        if (legacy.length && localStorage.getItem(`${recordKey}.migrated`) !== '1') {
          const migration = await fetch('/api/lesson-plans/import-local', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ records: legacy }) })
          if (migration.ok) localStorage.setItem(`${recordKey}.migrated`, '1')
        }
        const response = await fetch('/api/lesson-plans', { credentials: 'include' })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || '教案记录读取失败')
        if (!cancelled) setRecords((data.records || []).map((record: RecordItem) => ({ ...record, plan: normalizePlanToFiveSteps(record.plan) })))
      } catch { if (!cancelled) setRecords(legacy.map((record) => ({ ...record, plan: normalizePlanToFiveSteps(record.plan) }))) }
    }
    void load()
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    if (isAdmin) setModelGenerationQuota(null)
    else void refreshModelGenerationQuota()
  }, [userId, isAdmin])
  useEffect(() => {
    let cancelled = false
    let retryTimer: number | undefined
    const check = () => fetch('/api/prep/3d/status')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        const available = data.singleImage?.available === true || data.multiview?.available === true
        setThreeDConfigured(available)
        if (!available) retryTimer = window.setTimeout(check, 3000)
      })
      .catch(() => {
        if (cancelled) return
        setThreeDConfigured(false)
        retryTimer = window.setTimeout(check, 3000)
      })
    void check()
    return () => { cancelled = true; if (retryTimer) window.clearTimeout(retryTimer) }
  }, [])
  useEffect(() => { if (toast && !['检查模型图片', '生成四视图', '生成 PPT'].includes(toast)) { const timer = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timer) } }, [toast])
  useEffect(() => {
    if (!modelModalOpen && !modelRecommendationOpen) return
    document.body.classList.add('prep-modal-open')
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setModelModalOpen(false)
        setModelRecommendationOpen(false)
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      window.removeEventListener('keydown', closeOnEscape)
      document.body.classList.remove('prep-modal-open')
    }
  }, [modelModalOpen, modelRecommendationOpen])
  const update = (key: keyof FormState, value: string) => {
    if (key === 'unitPosition') unitPositionEdited.current = true
    setForm((current) => {
    if (key === 'stage') {
      if (value === current.stage) return current
      if (value === '本科') return { ...current, stage: value, grade: '', subject: current.field || initialForm.field, field: current.field || initialForm.field, courseName: current.courseName || initialForm.courseName, unitPosition: unitPositionEdited.current ? current.unitPosition : undergraduateDefaults.unitPosition!, duration: durationByLessonCount[current.lessonCount] || '40', pptTheme: undergraduateDefaults.pptTheme!, teachingRhythm: undergraduateDefaults.teachingRhythm!, highlightExam: undergraduateDefaults.highlightExam! }
      const nextGrade = gradesByStage[value]?.includes(current.grade) ? current.grade : ''
      return { ...current, ...(current.stage === '本科' ? k12Defaults : {}), ...normalizeLessonSchedule(current), stage: value, grade: nextGrade, subject: subjectsForK12Stage(value, nextGrade).includes(current.subject) ? current.subject : '', unitPosition: unitPositionEdited.current ? current.unitPosition : '' }
    }
    if (key === 'grade' && current.stage !== '本科') return { ...current, grade: value, subject: subjectsForK12Stage(current.stage, value).includes(current.subject) ? current.subject : '' }
    if (key === 'field') return { ...current, field: value, subject: value }
    if (key === 'lessonCount' && durationByLessonCount[value]) {
      return { ...current, lessonCount: value, duration: durationByLessonCount[value] }
    }
    if (key === 'duration' && lessonCountByDuration[value]) {
      return { ...current, duration: value, lessonCount: lessonCountByDuration[value] }
    }
    if (current.stage === '本科' && (key === 'objectives' || key === 'learningOutcomes')) return { ...current, objectives: value, learningOutcomes: value }
    return { ...current, [key]: value }
    })
  }
  const sample = () => { setForm({ ...initialForm, ...undergraduateDefaults, duration: '40', grade: '' }); setPlan(null); setGenerationStatus(null); setModelAsset(null); setModelUrl(''); setModelFile(null); setCoursewareManifest(null); setWorkbenchStage('lesson'); setShowFullForm(false); setModelRecommendationOpen(false); setModelModalOpen(false); setModelRecommendationShown(false); setModelRecommendationReason(null); setBioResult(null); setArtifacts({}); setPptArtifact(null); setToast('已载入本科心脏示例') }
  const selectMaterial = async (file: File | null) => {
    if (!file) return
    if (file.size > 15 * 1024 * 1024) { setToast('资料文件不能超过 15 MB'); return }
    const body = new FormData(); body.append('material', file)
    try {
      const response = await fetch('/api/prep/material/parse', { method: 'POST', body })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '资料解析失败')
      setForm((current) => ({ ...current, materialName: file.name, materialText: data.text || '' }))
      setToast(`已提取 ${data.characters || 0} 个字符，可在下方检查和修改`)
    } catch (error) { setToast(error instanceof Error ? error.message : '资料解析失败') }
  }
  const generatePlan = async (skipModelReminder = false) => {
    if (form.stage !== '本科' && !gradesByStage[form.stage]?.includes(form.grade)) { setToast('请先选择本次授课的年级'); return }
    if (!form.subject.trim() || !form.topic.trim()) { setToast(form.stage === '本科' ? '请先填写专业名称和授课计划主题' : '请先填写学科和课题名称'); return }
    const linkedModelAsset = modelAsset || plan?.modelAsset || null
    const hasModel = hasUsableModelAsset(linkedModelAsset, modelUrl)
    if (!skipModelReminder && !hasModel) {
      setModelRecommendationReason('before-lesson')
      setModelRecommendationOpen(true)
      return
    }
    setBusy('preview')
    setGenerationStatus(null)
    try {
      const payload = formToPayload(form)
      const undergraduate = form.stage === '本科'
      const response = await fetch(undergraduate ? '/api/prep/lesson-design/generate-draft' : '/api/prep/lesson/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(undergraduate ? { request: payload, mode: 'quick', model: modelAsset } : payload) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = data.generation?.message || data.error || '生成失败'
        if (!undergraduate) setGenerationStatus({ kind: 'error', message })
        throw new Error(message)
      }
      const generation = data.generation || data.lessonPlan?.generation
      const successMessage = 'AI 已生成教案初稿，可继续编辑'
      if (!undergraduate) setGenerationStatus({ kind: 'success', message: successMessage })
      setPlan({ ...data.lessonPlan, generation, request: { ...form }, modelAsset: modelAsset || undefined, warmupQuestions: warmupQuestions.length ? warmupQuestions : undefined }); setWarmupGeneration(null); setCoursewareManifest(null); setWorkbenchStage('output'); setShowFullForm(false); setModelRecommendationOpen(false); setModelModalOpen(false); setModelRecommendationShown(false); setModelRecommendationReason(null); setBioResult(null); setArtifacts({}); setPptArtifact(null); setToast(undergraduate && generation?.engine !== 'ollama' ? 'AI 生成未成功，请检查本地模型后重试' : successMessage)
    } catch (error) { setToast(error instanceof Error ? error.message : '生成失败，请确认本地 API 已启动'); if (form.stage !== '本科') setShowFullForm(true) } finally { setBusy(null) }
  }
  const saveRecord = async () => {
    if (!plan) return
    const normalized = normalizeClassroomPlan(plan)
    if (normalized.classroomData?.contentKey !== plan.classroomData?.contentKey) { setPlan(normalized); return false }
    const item: RecordItem = { id: plan.id, title: plan.title, subject: plan.request.subject, grade: plan.request.grade, updatedAt: new Date().toISOString(), plan }
    const next = [item, ...records.filter((record) => record.id !== item.id)].slice(0, 30)
    try {
      const response = await fetch('/api/lesson-plans', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan: persistentClassroomPlan(plan) }) })
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.message || '教案保存失败')
      setRecords(next); setAutoSavedAt(new Date().toISOString())
      window.dispatchEvent(new Event('classroom-library-updated'))
      return true
    } catch (error) {
      setToast(error instanceof Error ? error.message : '教案保存失败')
      return false
    }
  }
  // Persist the working lesson so a refresh or restart never loses it.
  useEffect(() => {
    if (!plan) return
    const timer = window.setTimeout(() => { void saveRecord() }, 1500)
    return () => window.clearTimeout(timer)
  }, [plan])
  useEffect(() => {
    if (!plan || !coursewareManifest || coursewareManifest.lessonId !== plan.id) return
    const fingerprint = contentFingerprint(coursewareManifest)
    if (fingerprint === contentFingerprint(plan.classroomData?.courseware || null)) return
    setPlan(current => {
      if (current?.id !== plan.id) return current
      const normalized = normalizeClassroomPlan(current)
      return { ...normalized, classroomData: { ...normalized.classroomData, courseware: coursewareManifest, ppt: normalized.classroomData?.ppt?.fingerprint === fingerprint ? normalized.classroomData.ppt : null } }
    })
    void fetch(`/api/courseware/${encodeURIComponent(plan.id)}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest: coursewareManifest }) })
      .then(response => { if (!response.ok) throw new Error('课件保存失败') })
      .catch(error => setToast(error.message))
  }, [coursewareManifest, plan?.id])
  const triggerDownload = (url: string, fileName: string) => { const link = document.createElement('a'); link.href = url; link.download = fileName; document.body.appendChild(link); link.click(); link.remove() }
  const isHeartCourseware = (currentPlan: LessonPlan) => {
    const request = (currentPlan.request || {}) as Partial<FormState>
    const text = `${currentPlan.title || ''} ${request.subject || ''} ${request.topic || ''}`
    return request.stage === '本科' && /心脏|生物医学|人体解剖/.test(text)
  }
  const requestCoursewareManifest = async (questionsOverride?: WarmupQuestion[], assetOverride?: Record<string, unknown> | null) => {
    if (!plan) throw new Error('还没有可生成的教案')
    const activeModelAsset = assetOverride || modelAsset || plan.modelAsset || null
    const activeModelUrl = resolveExportModelUrl(activeModelAsset, modelUrl)
    const activeViewImages = (activeModelAsset as ImageModelResult | null)?.viewImageUrls || {}
    const manifestHasCurrentViews = Object.entries(activeViewImages).every(([key, url]) => coursewareManifest?.model.viewImageUrls?.[key as keyof typeof activeViewImages] === url)
    if (coursewareManifest && (!activeModelUrl || (coursewareManifest.model.modelUrl === activeModelUrl && Boolean(coursewareManifest.model.previewImageUrl) && manifestHasCurrentViews))) return coursewareManifest
    const coursewareModel = activeModelUrl
      ? { ...(activeModelAsset || {}), modelUrl: activeModelUrl }
      : activeModelAsset
    const response = await fetch('/api/prep/courseware/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonPlan: plan, model: coursewareModel, questions: questionsOverride?.length ? questionsOverride : warmupQuestions.length ? warmupQuestions : plan.warmupQuestions }),
    })
    const data = await response.json()
    if (!response.ok || !data.manifest) throw new Error(data.error || '互动课件生成失败')
    setCoursewareManifest(data.manifest)
    return data.manifest as CoursewareManifest
  }
  const requestPpt = async () => {
    if (!plan) throw new Error('还没有可生成的教案')
    // Every classroom keeps one manifest for playback and repeatable PPT export,
    // including lessons that do not have a model.
    {
      let exportAsset = (modelAsset || plan.modelAsset || {}) as Record<string, unknown>
      if (exportAsset.source === 'imported' && !resolveExportModelUrl(exportAsset)) {
        try {
          setToast('正在同步导入模型，随后生成 PPT…')
          exportAsset = await ensureImportedModelExportUrl(exportAsset)
        } catch (error) {
          throw new Error(`导入模型同步失败，暂时无法生成 PPT：${error instanceof Error ? error.message : '请重新选择模型后重试'}`)
        }
      }
      const exportModelUrl = resolveExportModelUrl(exportAsset)
      if ((exportAsset.source === 'imported' || modelUrl.startsWith('blob:')) && !exportModelUrl) {
        throw new Error('导入模型尚未上传到服务端，无法生成 PPT；请重新导入 GLB 后重试')
      }
      const manifest = await prepareCoursewareViews(await requestCoursewareManifest(undefined, exportAsset), setToast)
      if (manifest.model.viewModelFingerprint) {
        const { viewImageUrls, viewModelFingerprint, viewRenderVersion, viewImageSource } = manifest.model
        const metadata = { viewImageUrls, viewModelFingerprint, viewRenderVersion, viewImageSource }
        setCoursewareManifest(manifest)
        setModelAsset((current) => current ? { ...current, ...metadata } : current)
        setPlan((current) => current?.id === plan.id ? { ...current, modelAsset: { ...(current.modelAsset || modelAsset || {}), ...metadata } } : current)
      }
      const response = await fetch('/api/prep/courseware/export-pptx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ manifest }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '配套 PPT 生成失败')
      const exportedManifest = (data.manifest || manifest) as CoursewareManifest
      const sceneCount = exportedManifest.scenes.filter(scene => scene.enabled !== false).length
      if (data.aligned !== true || data.sceneCount !== sceneCount || data.slideCount !== sceneCount) throw new Error('课件与 PPT 页数不一致，已停止下载')
      setCoursewareManifest(exportedManifest)
      setPptArtifact(data); setArtifacts((current) => ({ ...current, pptx: 'generated' }))
      setPlan(current => {
        if (current?.id !== plan.id) return current
        const normalized = normalizeClassroomPlan(current)
        return { ...normalized, classroomData: { ...normalized.classroomData, courseware: exportedManifest, ppt: { downloadUrl: data.downloadUrl, fileName: data.fileName, fingerprint: contentFingerprint(exportedManifest) } } }
      })
      triggerDownload(data.downloadUrl, data.fileName)
      return data
    }
  }
  const requestImageModel = async (mode: ModelMode, file: File | null, views: ModelViews, options: ModelOptions) => {
    const body = new FormData()
    if (mode === 'single') {
      if (!file) throw new Error('请先上传一张图片')
      body.append('image', file)
    } else {
      for (const view of ['front', 'left', 'right', 'back'] as const) {
        if (!views[view]) throw new Error(`请补齐${view === 'front' ? '正面' : view === 'left' ? '左侧' : view === 'right' ? '右侧' : '背面'}图`)
        body.append(view, views[view]!)
      }
    }
    body.append('texture_resolution', options.textureResolution)
    body.append('foreground_ratio', options.foregroundRatio)
    body.append('vertex_count', options.vertexCount)
    body.append('remove_bg', String(options.removeBackground))
    body.append('remesh', 'none')
    body.append('separationMode', options.separationMode)
    if (options.separationMode === 'anatomical') {
      body.append('organType', 'heart')
      body.append('anatomyProfile', 'heart-v2')
    }
    const response = await fetch(mode === 'single' ? '/api/prep/3d/generate-image' : '/api/prep/3d/generate-multiview-model', { method: 'POST', body })
    if (!response.ok) {
      let message = `3D 生成失败（${response.status}）`
      try { const data = await response.json(); message = data.message || data.error || message } catch { const text = await response.text(); if (text) message = text }
      throw new Error(message)
    }
    const raw = await response.json()
    const engine = String(raw.engine || '').toLowerCase()
    if (!engine.includes('hunyuan3d')) {
      throw new Error('当前返回结果不是可用的高精度模型，已停止加载；不会使用其他引擎或内置模型替代上传图片')
    }
    if (!raw.glbUrl && !raw.appearanceUrl) {
      throw new Error('未返回有效模型文件，任务已停止')
    }
    if (options.separationMode === 'anatomical' && !raw.appearanceUrl) {
      throw new Error('外观模型未返回，任务已停止；不会使用内置心脏模板替代上传图片')
    }
    const data = raw.appearanceUrl
      ? { ...raw, fullGlbUrl: raw.glbUrl, glbUrl: raw.appearanceUrl, parts: [], anatomyDisplayAvailable: false }
      : raw
    if (!data.glbUrl) throw new Error(data.message || '模型文件未生成')
    setModelUrl(data.glbUrl)
    setModelAsset(data)
    return data
  }
  const request3dDemo = async (file: File) => {
    const body = new FormData(); body.append('image', file)
    const response = await fetch('/api/prep/3d/demo', { method: 'POST', body })
    if (!response.ok) throw new Error('本地演示模型生成失败')
    const url = URL.createObjectURL(await response.blob())
    setModelUrl((current) => { if (current) URL.revokeObjectURL(current); return url })
    return url
  }
  const generatePpt = async () => {
    if (!plan) return
    setBusy('ppt')
    try { await requestPpt(); setToast('PPTX 已生成并开始下载') }
    catch (error) { setToast(error instanceof Error ? error.message : 'PPT 生成失败') }
    finally { setBusy(null) }
  }
  const generate3d = async (file: File | null, options: ModelOptions, mode: ModelMode = 'single', views: ModelViews = {}) => {
    if (mode === 'single' && !file) { setToast('请先上传一张用于建模的 PNG 或 JPG 图片'); return }
    if (mode === 'multiview' && ['front', 'left', 'right', 'back'].some((key) => !views[key as keyof ModelViews])) { setToast('请先补齐四个视角图片'); return }
    setBusy('3d')
    setModelUrl('')
    setModelAsset(null)
    setArtifacts((current) => ({ ...current, glb: 'generating', blend: 'generating', preview: 'generating' }))
    try {
      const result = await requestImageModel(mode, file, views, options)
      if (plan?.designWorkflow) {
        const workflow = plan.designWorkflow
        const isFiveStepWorkflow = workflow.version >= 2 || workflow.steps.length === 5
        const steps = workflow.steps.map((step) => step.number >= (isFiveStepWorkflow ? 4 : 5) ? { ...step, status: 'stale' as const, approved: false } : step)
        const nextPlan = {
          ...plan,
          modelAsset: result,
          designWorkflow: {
            ...workflow,
            status: 'review',
            qualityPending: true,
            modelContext: {
              available: result.parts.length > 0,
              appearanceAvailable: Boolean(result.glbUrl),
              partKeys: result.parts.map((part) => part.partKey),
            },
            steps,
            staleSteps: steps.filter((step) => step.status === 'stale').map((step) => step.id),
          } as LessonDesignWorkflow,
        }
        setPlan(nextPlan)
        setCoursewareManifest(null)
        setToast('模型已更新；教学活动、PPT 与系统生成练习题需要复核，现有题目已保留')
      } else setToast(result.editable ? result.message : `${result.message}；当前为本地演示结果`)
      return result as ImageModelResult
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '3D 生成失败'
      setToast(message)
      throw error
    }
    finally { setBusy(null); void refreshModelGenerationQuota() }
  }
  
  const generateWarmup = async (sourceModel = modelAsset) => {
    if (!plan) { setToast('请先完成教案'); return }
    setBusy('warmup')
    try {
      const existingQuestions = warmupQuestions.length ? warmupQuestions : (plan.warmupQuestions || [])
      const response = await fetch('/api/prep/warmup/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: plan, model: sourceModel || null, currentQuestions: existingQuestions }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '练习题生成失败')
      const generated = (data.questions || []) as WarmupQuestion[]
      setWarmupQuestions(generated); setWarmupGeneration(data.generation || null); setPlan((current) => current ? { ...current, warmupQuestions: generated } : current); setToast(isAiGeneration(data.generation?.engine) ? 'AI 已生成 5 道练习题，可编辑后应用到课堂' : 'AI 生成失败，已使用系统模板生成练习题')
      return generated
    } catch (error) { setToast(error instanceof Error ? error.message : '练习题生成失败'); return undefined }
    finally { setBusy(null) }
  }
  const regenerateWarmupQuestion = async (index: number) => {
    if (!plan) return
    setBusy('warmup')
    try {
      const existingQuestions = warmupQuestions.length ? warmupQuestions : (plan.warmupQuestions || [])
      const response = await fetch('/api/prep/warmup/regenerate-question', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: plan, model: modelAsset, index, currentQuestions: existingQuestions }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '题目重做失败')
      setWarmupQuestions((current) => current.map((question, questionIndex) => questionIndex === index ? data.question : question)); setWarmupGeneration(data.generation || null); setPlan((current) => current ? { ...current, warmupQuestions: (current.warmupQuestions || []).map((question, questionIndex) => questionIndex === index ? data.question : question) } : current); setToast(isAiGeneration(data.generation?.engine) ? `AI 已重新生成第 ${index + 1} 题` : `第 ${index + 1} 题生成失败，已保留系统模板题目`)
    } catch (error) { setToast(error instanceof Error ? error.message : '题目重做失败') }
    finally { setBusy(null) }
  }
  const applyToClassroom = async () => {
    if (!plan || !onApplyLesson) return
    let classroomQuestions = warmupQuestions.length ? warmupQuestions : (plan.warmupQuestions || [])
    if (!classroomQuestions.length) {
      const generated = await generateWarmup()
      if (!generated?.length) return
      classroomQuestions = generated
    }
    const enabled = classroomQuestions.filter((question) => question.enabled)
    const invalid = enabled.find((question) => {
      const options = question.options.map((option) => option.trim())
      return !question.question.trim() || !question.explanation.trim() || options.filter(Boolean).length < 2 || question.correctIndex < 0 || question.correctIndex >= options.length || new Set(options.filter(Boolean)).size !== options.filter(Boolean).length
    })
    if (invalid) { setToast('请先修正练习题：题干、选项、正确答案和解析不能为空，选项不能重复'); return }
    let manifest = coursewareManifest
    if (isHeartCourseware(plan)) {
      setBusy('courseware')
      try {
        manifest = await requestCoursewareManifest(classroomQuestions)
      } catch (error) {
        setToast(error instanceof Error ? error.message : '互动课件生成失败')
        setBusy(null)
        return
      }
      setBusy(null)
    }
    const asset = (modelAsset || plan.modelAsset || {}) as Record<string, unknown>
    const appliedModelUrl = [modelUrl, asset.localPreviewUrl, asset.modelUrl, asset.appearanceUrl, asset.glbUrl]
      .find((value) => typeof value === 'string' && value.trim())
    const classroomAsset: ClassroomModelAsset | undefined = typeof appliedModelUrl === 'string' ? {
      source: asset.source === 'imported' ? 'imported' : 'generated',
      localModelId: typeof asset.localModelId === 'string' ? asset.localModelId : undefined,
      modelUrl: appliedModelUrl,
      modelType: (asset.modelType === 'gltf' || asset.modelType === 'fbx' ? asset.modelType : 'glb') as ModelType,
      assetUrls: asset.assetUrls && typeof asset.assetUrls === 'object' ? asset.assetUrls as Record<string, string> : undefined,
      fileName: typeof asset.fileName === 'string' ? asset.fileName : undefined,
      previewImageUrl: typeof asset.previewUrl === 'string' ? asset.previewUrl : undefined,
    } : undefined
    if (classroomAsset && !classroomAsset.localModelId && classroomAsset.source === 'generated') {
      try {
        setBusy('courseware')
        const record = await saveGeneratedModel({ id: `lesson:${plan.id}:${contentFingerprint(appliedModelUrl)}`, ownerId: userId, name: plan.title, url: classroomAsset.modelUrl })
        classroomAsset.localModelId = record.id
      } catch (error) { setToast(error instanceof Error ? error.message : '模型保存失败'); return }
      finally { setBusy(null) }
    }
    const basePlan = normalizeClassroomPlan({ ...plan, modelAsset: classroomAsset ? { ...asset, ...classroomAsset } : plan.modelAsset, warmupQuestions: classroomQuestions })
    const appliedPlan = { ...basePlan, classroomData: { ...basePlan.classroomData, courseware: manifest } }
    setPlan(appliedPlan)
    onApplyLesson(appliedPlan, typeof appliedModelUrl === 'string' ? appliedModelUrl : undefined, classroomQuestions, manifest || undefined, classroomAsset)
  }
  const openRecord = async (item: RecordItem) => {
    const normalizedPlan = normalizeClassroomPlan(normalizePlanToFiveSteps(item.plan))
    const restoredAsset = normalizedPlan.modelAsset || null
    const restoredForm = normalizeLoadedForm(normalizedPlan.request)
    unitPositionEdited.current = Boolean(normalizedPlan.request.unitPosition)
    setForm(restoredForm)
    setGenerationStatus(null)
    setModelAsset(restoredAsset)
    setModelUrl(resolveAppearanceModelUrl(restoredAsset))
    if (restoredAsset?.source === 'imported') {
      try {
        const restored = await restoreImportedModel(restoredAsset)
        if (!restored) setToast('备案已打开，但导入模型不在当前模型库中')
      } catch { setToast('备案已打开，但导入模型恢复失败') }
    }
    setBioResult(null)
    setCoursewareManifest(normalizedPlan.classroomData?.courseware || null)
    setPptArtifact(normalizedPlan.classroomData?.ppt || null)
    setPlan({ ...normalizedPlan, request: restoredForm })
    setWorkbenchStage('output')
    setModelRecommendationOpen(false)
    setModelModalOpen(false)
    setModelRecommendationShown(false)
    setShowFullForm(false)
    setView('new')
    setToast(restoredAsset ? '已打开备案记录并恢复已保存模型' : '已打开备案记录')
  }
  const deleteRecord = async (id: string) => { const response = await fetch(`/api/lesson-plans/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' }); if (!response.ok) { setToast('备案删除失败'); return }; setRecords((current) => current.filter((record) => record.id !== id)); setToast('备案已删除') }
  const filteredRecords = useMemo(() => records.filter((record) => `${record.title}${record.subject}${record.grade}`.toLowerCase().includes(query.toLowerCase())), [records, query])

  const goToWorkbenchStage = (stage: WorkbenchStage) => {
    if (stage === 'output' && !plan) return
    if (stage === 'model') {
      const restoredAsset = modelAsset || plan?.modelAsset || null
      const restoredUrl = resolveAppearanceModelUrl(restoredAsset)
      if (!modelAsset && restoredAsset) setModelAsset(restoredAsset)
      if (!modelUrl && restoredUrl) setModelUrl(restoredUrl)
      setModelModalOpen(true)
      return
    }
    setWorkbenchStage(stage)
    if (stage === 'lesson') setShowFullForm(true)
    if (stage === 'output') setShowFullForm(false)
  }

  const activeModelAsset = modelAsset || plan?.modelAsset || null

  return <div className={`app-shell ${embedded ? 'is-integrated' : ''} ${plan && !showFullForm && workbenchStage === 'output' ? 'has-plan' : 'is-input'}`}>
    {!embedded && <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Layers3 size={18} /></div><div><strong>数智备课</strong><span>教案 · PPT · 3D</span></div></div>
      <div className="side-section-label">工作空间</div>
      <nav className="nav-list">
        <button className={view === 'new' ? 'nav-item active' : 'nav-item'} onClick={() => setView('new')}><Plus size={17} />新建教案</button>
        <button className={view === 'records' ? 'nav-item active' : 'nav-item'} onClick={() => setView('records')}><Archive size={17} />备案记录 <em>{records.length || ''}</em></button>
        <button className={view === 'knowledge' ? 'nav-item active' : 'nav-item'} onClick={() => setView('knowledge')}><BookOpen size={17} />知识库 <span className="soon">后续</span></button>
      </nav>
      <button className="nav-item prep-back" type="button" onClick={onBack}><ArrowLeft size={17} />返回 3D 课堂</button>
      <div className="sidebar-bottom"><div className="status-dot" /><div><strong>本地工作模式</strong><span>内容保存在当前浏览器</span></div></div>
    </aside>}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left">{!embedded && <button className="nav-item integrated-back" type="button" onClick={onBack}><ArrowLeft size={17} />课堂</button>}<div className="topbar-title"><div className="eyebrow">{embedded ? '课程设计工作区' : 'TEACHER WORKSPACE / 01'}</div><h1>{view === 'new' ? '智能备课' : view === 'records' ? '备案记录' : '知识库'}</h1></div></div><div className="top-actions"><span className="saved-state" title={autoSavedAt ? `最近保存：${new Date(autoSavedAt).toLocaleTimeString('zh-CN')}` : '教案生成后会自动保存到当前账户'}><Check size={15} />{autoSavedAt ? `已自动保存 ${new Date(autoSavedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}` : '自动保存'}</span>{plan && onApplyLesson && <button className="primary-btn" onClick={applyToClassroom}><MonitorPlay size={15} />应用到课堂</button>}{!embedded && <button className="avatar">林</button>}</div></header>
      {view === 'new' && <>
        <WorkbenchFlow stage={workbenchStage} hasPlan={Boolean(plan)} onChange={goToWorkbenchStage} />
        {workbenchStage === 'model' ? <div className="workspace-grid unified-model-workspace">
          <section className="form-panel model-course-context">
            <div className="panel-heading"><div><span className="section-kicker">COURSE CONTEXT</span><h2>本课建模任务</h2><p>先确定课程和观察对象，模型会直接进入后续教案、PPT 与练习题。</p></div></div>
            <div className="form-block stage-first"><div className="block-title"><span>课程上下文</span><small>与后续教案共用</small></div><SelectField label="学段" value={form.stage} options={stageOptions} onChange={v => update('stage', v)} /><Field label="课程课题" value={form.topic} onChange={v => update('topic', v)} required />{form.stage === '本科' ? <div className="field-grid two"><Field label="专业方向" value={form.field} onChange={v => update('field', v)} /><Field label="课程名称" value={form.courseName} onChange={v => update('courseName', v)} /></div> : <div className="field-grid two"><SelectField label="年级" value={form.grade} options={gradesByStage[form.stage] || []} onChange={v => update('grade', v)} /><Field label="学科" value={form.subject} onChange={v => update('subject', v)} required /></div>}{form.stage === '本科' ? <SelectField label="课时" value={form.duration} options={['40','80','120']} optionLabels={{40:'40 分钟',80:'80 分钟',120:'120 分钟'}} onChange={v => update('duration', v)} /> : <Field label="课时（分钟）" value={form.duration} onChange={v => update('duration', v)} />}</div>
            <div className="course-link-map"><strong>生成后的联动范围</strong><span>模型部件与观察角度</span><ArrowRight size={14} /><span>AI辅助教案活动</span><ArrowRight size={14} /><span>PPT 与 5 道练习题</span></div>
            {plan && <div className="linked-plan-notice"><Check size={15} /><div><strong>已关联教案：{plan.title}</strong><span>重新生成模型后，教师编辑内容不会被覆盖，只会标记待同步。</span></div></div>}
          </section>
          <aside className="preview-column fused-model-column"><ModelPanel file={modelFile} setFile={setModelFile} modelUrl={modelUrl} options={modelOptions} setOptions={setModelOptions} configured={threeDConfigured} assetResult={activeModelAsset as ImageModelResult | null} quota={modelGenerationQuota} isAdmin={isAdmin} onGenerate={(file, options, mode, views) => generate3d(file, options, mode, views)} onImport={importModel} busy={busy} disabled={false} onSkip={() => goToWorkbenchStage('lesson')} onCompleteAsset={() => goToWorkbenchStage('lesson')} /></aside>
        </div> : <div className={`workspace-grid ${plan && !showFullForm && workbenchStage === 'output' ? 'has-plan' : 'is-input'}`}>
          <section className="form-panel">
            {plan && !showFullForm && <QuickSummary plan={plan} form={form} onEdit={() => setShowFullForm(true)} onStep={(step) => { setShowFullForm(true); setPrepStep(step) }} />}
            <div className="panel-heading"><div><span className="section-kicker">COURSE BLUEPRINT</span><h2>课程蓝图</h2><p>填写下面的信息，AI 生成的教案会更符合你的课程。</p></div><button className="ghost-btn" onClick={sample}><Sparkles size={15} />载入示例</button></div>
            <div className="ai-autofill-note" role="note"><Sparkles size={15} /><span><strong>填写提示</strong>教材内容、学生基础、前置知识、常见错误等类似信息可以不填；留空时，AI 会根据课程主题和已有信息自动补全。</span></div>
            {generationStatus && <div className={`ai-generation-status ${generationStatus.kind === 'error' ? 'is-error' : 'is-success'}`} role={generationStatus.kind === 'error' ? 'alert' : 'status'}><span className="ai-generation-status-icon">{generationStatus.kind === 'error' ? <AlertTriangle size={15} /> : <Check size={15} />}</span><span>{generationStatus.message}</span></div>}
            <div className="prep-nav" aria-label="备课步骤">
              {(form.stage === '本科' ? [[1, '课程信息', '课题与教材'], [2, '教材学情', '资料与基础'], [3, '教学侧重', '目标与考点']] as const : [[1, '上什么课', '课程基本信息'], [2, '学生与教材', '按需补充'], [3, '我的教学要求', '按需补充']] as const).map(([step, title, note]) => <button key={step} className={prepStep === step ? 'prep-step active' : 'prep-step'} onClick={() => setPrepStep(step)}><span>{String(step).padStart(2, '0')}</span><div><strong>{title}</strong><small>{note}</small></div></button>)}
            </div>
            {prepStep === 1 && <div className={`form-stage ${form.stage !== '本科' ? 'k12-stage' : ''}`}>
              <div className="form-block stage-first"><div className="block-title"><span>课程与教材</span><small>按授课计划填写本次课的基本信息</small></div>
                <SelectField label="学段" value={form.stage} options={stageOptions} onChange={(v) => update('stage', v)} />
                {form.stage === '本科' ? <>
                <div className="field-grid two"><Field label="专业名称" value={form.field} onChange={(v) => update('field', v)} required /><Field label="课程名称" value={form.courseName} onChange={(v) => update('courseName', v)} required /></div>
                <Field label="授课计划主题" value={form.topic} onChange={(v) => update('topic', v)} required />
                <div className="field-grid three"><SelectField label="节数" value={form.lessonCount} options={['1','2','3']} optionLabels={{1: '1 节课', 2: '2 节课', 3: '3 节课'}} onChange={(v) => update('lessonCount', v)} /><SelectField label="总时长" value={form.duration} options={['40','80','120']} optionLabels={{40: '40 分钟', 80: '80 分钟', 120: '120 分钟'}} onChange={(v) => update('duration', v)} /><SelectField label="学生能力层次" value={form.abilityLevel} options={['基础层','进阶层']} onChange={(v) => update('abilityLevel', v)} /></div>
                <TextArea label="学生已有基础" value={form.priorKnowledge || form.learningSituation} onChange={(v) => { update('priorKnowledge', v); update('learningSituation', v) }} rows={3} />
                </> : <>
                  <div className="field-grid two"><SelectField label="年级" value={form.grade} options={gradesByStage[form.stage] || []} placeholder="请选择年级" onChange={v => update('grade', v)} /><K12Subject stage={form.stage} grade={form.grade} value={form.subject} onChange={v => update('subject', v)} /></div>
                  <Field label="课题名称" value={form.topic} onChange={v => update('topic', v)} required />
                  <K12TextbookField form={form} update={update} />
                  <LessonScheduleFields form={form} update={update} />
                  <K12Supplement title="更多课程信息" initialOpen={Boolean(form.unitPosition || form.lessonType !== '新授课')}>
                    <SelectField label="课型" value={form.lessonType} options={['新授课', '复习课', '练习课', '实验课', '综合活动课']} onChange={v => update('lessonType', v)} />
                    <Field label="本课在单元中的作用" value={form.unitPosition} placeholder="如单元第一课、知识巩固课或单元总结课" onChange={v => update('unitPosition', v)} />
                  </K12Supplement>
                </>}
              </div>
            </div>}
            {form.stage !== '本科' && prepStep !== 1 && <K12OptionalStage step={prepStep} form={form} update={update} onMaterial={selectMaterial} />}
            {form.stage === '本科' && prepStep === 2 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>教材资料</span><small>上传后提取内容，作为生成依据；不提供也可以</small></div><label className="material-upload"><UploadCloud size={19} /><div><strong>{form.materialName || '选择教材或备课资料'}</strong><span>支持 TXT、Markdown、DOCX、文本型 PDF，单文件不超过 15 MB</span></div><input type="file" accept=".txt,.md,.docx,.pdf" onChange={(event) => selectMaterial(event.target.files?.[0] || null)} /></label><div className="field-grid"><SelectField label="资料使用方式" value={form.materialPolicy} options={['严格依据教材','教材优先，允许补充','仅作为生成参考']} onChange={(v) => update('materialPolicy', v)} /><div className="field"><span>已识别资料</span><div className="material-filename">{form.materialName || '尚未上传'}</div></div></div><TextArea label="提取内容（可检查和修改）" value={form.materialText} onChange={(v) => update('materialText', v)} rows={6} /></div>
              <div className="form-block"><div className="block-title"><span>学生基础</span><small>决定讲解起点与支架；不填写时由 AI 推断</small></div><TextArea label="学情分析" value={form.learningSituation} onChange={(v) => update('learningSituation', v)} rows={3} /><div className="field-grid two"><TextArea label="前置知识" value={form.priorKnowledge} onChange={(v) => update('priorKnowledge', v)} rows={3} /><TextArea label="常见错误与认知障碍" value={form.misconceptions} onChange={(v) => update('misconceptions', v)} rows={3} /></div></div>
            </div>}
            {form.stage === '本科' && prepStep === 3 && <div className="form-stage">
              <div className="form-block stage-first"><div className="block-title"><span>教学主线</span></div><TextArea label="本课核心问题" value={form.coreQuestion} onChange={(v) => update('coreQuestion', v)} rows={2} /><div className="field-grid two"><TextArea label="教学目标" value={form.objectives} onChange={(v) => update('objectives', v)} rows={4} /><TextArea label="教学重点" value={form.keyPoints} onChange={(v) => update('keyPoints', v)} rows={4} /></div><div className="field-grid two"><TextArea label="教学难点" value={form.difficulties} onChange={(v) => update('difficulties', v)} rows={3} /><TextArea label="课程考核目标" value={form.assessmentMethod} onChange={(v) => update('assessmentMethod', v)} rows={3} /></div></div>
              <div className="form-block"><div className="block-title"><span>课堂闭环</span><small>活动、评价与作业</small></div><div className="field-grid two"><TextArea label="教学方法" value={form.methods} onChange={(v) => update('methods', v)} rows={3} /><TextArea label="教学资源" value={form.resources} onChange={(v) => update('resources', v)} rows={3} /></div><div className="field-grid two"><TextArea label="课堂评价" value={form.assessment} onChange={(v) => update('assessment', v)} rows={3} /><TextArea label="课后作业" value={form.homework} onChange={(v) => update('homework', v)} rows={3} /></div></div>
            </div>}
            <div className="stage-controls"><button className="outline-btn" disabled={prepStep === 1} onClick={() => setPrepStep((prepStep - 1) as 1 | 2 | 3)}>上一步</button>{prepStep < 3 && <button className="primary-btn" onClick={() => setPrepStep((prepStep + 1) as 1 | 2 | 3)}>下一步 <ArrowRight size={15} /></button>}</div>
            <div className="form-footer"><span><Lightbulb size={15} />AI 生成 · 可继续编辑</span><div className="form-footer-actions">{plan && <button className="primary-btn" onClick={() => { setShowFullForm(false); setWorkbenchStage('output') }} disabled={busy === 'preview'}>{busy === 'preview' ? <LoaderCircle className="spin" size={17} /> : <ArrowLeft size={17} />}返回教案</button>}{plan && <button className="outline-btn" onClick={() => void generatePlan(true)} disabled={busy === 'preview'}>{busy === 'preview' ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}重新生成教案</button>}{!plan && <button className="primary-btn" onClick={() => void generatePlan()} disabled={busy === 'preview'}>{busy === 'preview' ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}生成教案 <ArrowRight size={16} /></button>}</div></div>
          </section>
          <aside className="preview-column">
            {!plan ? <EmptyPreview form={form} /> : <Fragment key={plan.id}><LessonPreview plan={plan} onUpdate={updatePlan} onSave={saveRecord} onGenerate={generatePpt} onGenerate3d={generate3d} onRegenerate={() => void generatePlan()} busy={busy} modelFile={modelFile} setModelFile={setModelFile} modelUrl={modelUrl} threeDConfigured={threeDConfigured} modelGenerationQuota={modelGenerationQuota} isAdmin={isAdmin} bioResult={bioResult} modelAsset={activeModelAsset} artifacts={artifacts} pptArtifact={pptArtifact} warmupQuestions={warmupQuestions.length ? warmupQuestions : (plan.warmupQuestions || [])} warmupGeneration={warmupGeneration} onGenerateWarmup={() => generateWarmup()} onRegenerateWarmupQuestion={regenerateWarmupQuestion} onWarmupChange={setWarmupQuestions} modelOptions={modelOptions} setModelOptions={setModelOptions} onApplyLesson={applyToClassroom} onImport={importModel} coursewareManifest={coursewareManifest} onCoursewareChange={setCoursewareManifest} onNotice={setToast} onLessonApproved={() => { if (!modelRecommendationShown && !hasUsableModelAsset(modelAsset || plan.modelAsset || null, modelUrl)) { setModelRecommendationShown(true); setModelRecommendationReason('after-approval'); setModelRecommendationOpen(true) } }} /></Fragment>}
          </aside>
        </div>}
      </>}
      {view === 'records' && <RecordsView records={filteredRecords} query={query} setQuery={setQuery} onOpen={openRecord} onDelete={deleteRecord} onNew={() => { setView('new'); setPlan(null); setGenerationStatus(null); setModelAsset(null); setModelUrl(''); setModelFile(null); setWorkbenchStage('lesson'); setModelRecommendationOpen(false); setModelModalOpen(false); setModelRecommendationShown(false); setModelRecommendationReason(null) }} />}
      {view === 'knowledge' && <KnowledgeView />}
    </main>
    {toast && <div className="toast"><Check size={16} />{toast}<button onClick={() => setToast('')}><X size={15} /></button></div>}
    {modelRecommendationOpen && <div className="prep-modal-backdrop" role="presentation" onMouseDown={() => setModelRecommendationOpen(false)}><section className="prep-modal recommendation-modal" role="dialog" aria-modal="true" aria-labelledby="model-recommendation-title" onMouseDown={(event) => event.stopPropagation()}><button className="prep-modal-close" type="button" aria-label="关闭" onClick={() => setModelRecommendationOpen(false)}><X size={18} /></button><div className="recommendation-icon"><Box size={24} /></div><span className="section-kicker">TEACHING SUGGESTION</span><h2 id="model-recommendation-title">建议先添加 3D 教学模型</h2><p>{modelRecommendationReason === 'before-lesson' ? '当前还没有生成 3D 模型。添加模型可以让后续教案中的结构观察、教学活动和课堂课件更贴合实际模型。你也可以暂时跳过，直接生成教案。' : '当前教案已经完成审核。配合 3D 模型进行结构观察和课堂讲解，可以让教学内容更直观，增强学生对结构与功能关系的理解。'}</p><div className="prep-modal-actions"><button type="button" className="outline-btn" onClick={() => { const shouldContinue = modelRecommendationReason === 'before-lesson'; setModelRecommendationOpen(false); setModelRecommendationReason(null); if (shouldContinue) void generatePlan(true) }}>{modelRecommendationReason === 'before-lesson' ? '暂不建模，继续生成' : '暂不建模，继续教案'}</button><button type="button" className="primary-btn" onClick={() => { setModelRecommendationOpen(false); setModelModalOpen(true) }}><Box size={15} />开始建模</button></div></section></div>}
    {modelModalOpen && <div className="prep-modal-backdrop" role="presentation" onMouseDown={() => { if (busy !== '3d') setModelModalOpen(false) }}><section className="prep-modal model-modal" role="dialog" aria-modal="true" aria-labelledby="model-modal-title" onMouseDown={(event) => event.stopPropagation()}><header className="prep-modal-header"><div><span className="section-kicker">3D ASSET</span><h2 id="model-modal-title">添加本课 3D 教学模型</h2><p>提交图片生成模型，或直接导入已有模型；模型会保存在当前课程中。</p></div><button className="prep-modal-close" type="button" aria-label="关闭建模窗口" onClick={() => { if (busy !== '3d') setModelModalOpen(false) }} disabled={busy === '3d'}><X size={18} /></button></header><div className="prep-modal-body"><ModelPanel file={modelFile} setFile={setModelFile} modelUrl={modelUrl} options={modelOptions} setOptions={setModelOptions} configured={threeDConfigured} assetResult={activeModelAsset as ImageModelResult | null} quota={modelGenerationQuota} isAdmin={isAdmin} onGenerate={(file, options, mode, views) => generate3d(file, options, mode, views)} onImport={importModel} onCompleteAsset={modelRecommendationReason === 'before-lesson' ? () => { setModelModalOpen(false); setModelRecommendationReason(null); setToast('模型已生成并完成预览，请点击“生成教案”继续'); } : undefined} busy={busy} disabled={false} /></div><footer className="prep-modal-footer"><span>{modelUrl ? '模型已连接到当前教案' : '可以稍后从课程资产区域再次打开'}</span><button type="button" className="outline-btn" onClick={() => { if (busy !== '3d') setModelModalOpen(false) }} disabled={busy === '3d'}>返回教案</button></footer></section></div>}
  </div>
}

const fieldPlaceholders: Record<string, string> = {
  '课程课题': '请输入这节课要讲的主题',
  '专业名称': '请输入学生所学的专业名称',
  '专业方向': '请输入本课程所属的专业或方向',
  '课程名称': '请输入本次授课所属的课程名称',
  '授课计划主题': '请输入这节课要讲的主题',
  '学科': '请输入本次授课的学科名称',
  '课题名称': '请输入本次授课的课题',
  '教材版本': '请输入教材名称、出版社或版本',
  '册次 / 章节': '请输入本课对应的册次、章节或页码',
  '单元位置': '请说明本课在单元中的位置，如单元第一课或总结课',
  '课时（分钟）': '例如：40',
}

const textAreaPlaceholders: Record<string, string> = {
  '学生已有基础': '请说明学生已经学过什么、会做什么，还有哪些地方不熟悉。',
  '提取内容（可检查和修改）': '上传教材或备课资料后，系统会在此提取文字，也可直接粘贴教学内容。',
  '学情分析': '请说明学生目前的学习情况、学习习惯，以及上这节课可能遇到的困难。',
  '前置知识': '学这节课之前，学生需要先掌握哪些知识或方法？',
  '常见错误与认知障碍': '学生在哪些地方容易弄混、做错或听不懂？',
  '本课核心问题': '这节课最想带学生弄明白或解决的一个问题是什么？',
  '教学目标': '上完这节课，希望学生知道什么、学会什么、能够做什么？可分点填写。',
  '教学重点': '这节课最需要学生掌握的内容是什么？',
  '教学难点': '这节课哪些内容学生最难理解或学会？',
  '课程考核目标': '准备检查学生学会了什么？做到什么程度才算达到要求？',
  '高频考点与典型题型': '请填写本课常考的内容、常见题型，以及学生容易出错的地方。',
  '教学方法': '准备怎样教这节课？如讲解、提问、小组讨论或动手练习。',
  '教学资源': '上课需要用到哪些材料或工具？如教材、图片、视频或练习单。',
  '课堂评价': '怎样了解学生是否学会了？如课堂提问、随堂练习或展示学习成果。',
  '课后作业': '课后让学生完成什么任务？请说明任务内容和完成要求。',
}

function LessonScheduleFields({ form, update }: { form: FormState; update: (key: keyof FormState, value: string) => void }) {
  return <div className="field-grid two"><SelectField label="节数" value={form.lessonCount} options={['1', '2', '3']} optionLabels={{ 1: '1 节课', 2: '2 节课', 3: '3 节课' }} onChange={v => update('lessonCount', v)} /><SelectField label="总时长" value={form.duration} options={['40', '80', '120']} onChange={v => update('duration', v)} /></div>
}

function K12Subject({ stage, grade, value, onChange }: { stage: string; grade: string; value: string; onChange: (value: string) => void }) {
  const subjects = subjectsForK12Stage(stage, grade)
  return <div className="k12-subject"><SelectField label="学科" value={value} placeholder="请选择学科" options={subjects} onChange={onChange} /></div>
}

function K12Supplement({ title, initialOpen, children }: { title: string; initialOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(initialOpen)
  useEffect(() => { if (initialOpen) setOpen(true) }, [initialOpen])
  return <details className="k12-supplement" open={open} onToggle={event => setOpen(event.currentTarget.open)}><summary><span>{title}</span><small>选填</small><ChevronDown size={15} /></summary><div className="k12-supplement-body">{children}</div></details>
}

function K12TextbookField({ form, update }: { form: FormState; update: (key: keyof FormState, value: string) => void }) {
  const options = textbookOptionsForK12Stage(form.stage, form.subject)
  const isHighSchool = normalizeK12Stage(form.stage) === '高中'
  const legacyCustom = isHighSchool && Boolean(form.textbookVersion) && !options.includes(form.textbookVersion)
  const [customSelected, setCustomSelected] = useState(legacyCustom)
  useEffect(() => { if (legacyCustom) setCustomSelected(true) }, [legacyCustom])
  if (!isHighSchool) return <Field label="教材版本" value={form.textbookVersion} onChange={v => update('textbookVersion', v)} />
  return <div className="k12-textbook-fields">
    <SelectField
      label="教材册次 / 模块"
      value={customSelected ? '__custom__' : form.textbookVersion}
      placeholder="请选择教材册次 / 模块"
      options={[...options, '__custom__']}
      optionLabels={{ __custom__: '其他 / 自定义' }}
      onChange={value => { const custom = value === '__custom__'; setCustomSelected(custom); update('textbookVersion', custom ? (customSelected ? form.textbookVersion : '') : value) }}
    />
    {customSelected && <Field label="自定义教材名称" value={form.textbookVersion} placeholder="例如：某出版社高中数学选择性必修" onChange={v => update('textbookVersion', v)} />}
  </div>
}

function K12OptionalStage({ step, form, update, onMaterial }: { step: 2 | 3; form: FormState; update: (key: keyof FormState, value: string) => void; onMaterial: (file: File | null) => void }) {
  if (step === 2) return <div className="form-stage k12-optional-stage">
    <div className="form-block stage-first"><div className="block-title"><span>学生与教材</span><small>选填，留空也可生成</small></div>
      <TextArea label="学生目前的学习情况" value={form.learningSituation} placeholder="学生已经会什么？哪些地方还不熟悉？" onChange={v => update('learningSituation', v)} rows={3} />
      <label className="material-upload"><UploadCloud size={19} /><div><strong>{form.materialName || '上传教材或备课资料（选填）'}</strong><span>支持 TXT、Markdown、DOCX、文本型 PDF，单文件不超过 15 MB</span></div><input type="file" accept=".txt,.md,.docx,.pdf" onChange={event => onMaterial(event.target.files?.[0] || null)} /></label>
      <K12Supplement title="补充教材信息" initialOpen={Boolean(form.textbookVersion || form.chapter || form.materialText || form.materialName || form.materialPolicy !== initialForm.materialPolicy)}>
        <p className="field-hint">已在第一步选择教材册次或模块；这里补充具体单元、章节、页码或课文名称。</p>
        <Field label="册次 / 章节" value={form.chapter} onChange={v => update('chapter', v)} />
        <SelectField label="资料使用方式" value={form.materialPolicy} options={['严格依据教材', '教材优先，允许补充', '仅作为生成参考']} onChange={v => update('materialPolicy', v)} />
        <TextArea label="提取内容（可检查和修改）" value={form.materialText} onChange={v => update('materialText', v)} rows={6} />
      </K12Supplement>
      <K12Supplement title="补充学生情况" initialOpen={Boolean(form.priorKnowledge || form.misconceptions)}>
        <TextArea label="需要提前掌握的知识" value={form.priorKnowledge} placeholder="学这节课之前，学生需要先掌握什么？" onChange={v => update('priorKnowledge', v)} rows={3} />
        <TextArea label="学生容易出错的地方" value={form.misconceptions} placeholder="哪些内容学生容易弄混、做错或听不懂？" onChange={v => update('misconceptions', v)} rows={3} />
      </K12Supplement>
    </div>
  </div>
  return <div className="form-stage k12-optional-stage"><div className="form-block stage-first"><div className="block-title"><span>我的教学要求</span><small>选填，留空也可生成</small></div>
    <TextArea label="这节课希望学生学会什么？" value={form.objectives} placeholder="可以写希望学生了解的内容、学会的方法或能完成的任务。" onChange={v => update('objectives', v)} rows={3} />
    <K12Supplement title="补充教学重点" initialOpen={Boolean(form.coreQuestion || form.keyPoints || form.difficulties || form.examPoints)}>
      <TextArea label="本课要解决的问题" value={form.coreQuestion} placeholder="这节课最想带学生弄明白或解决什么问题？" onChange={v => update('coreQuestion', v)} rows={2} />
      <div className="field-grid two"><TextArea label="教学重点" value={form.keyPoints} onChange={v => update('keyPoints', v)} rows={3} /><TextArea label="教学难点" value={form.difficulties} onChange={v => update('difficulties', v)} rows={3} /></div>
      <TextArea label="常考内容" value={form.examPoints} placeholder="请填写本课常考的内容或常见题型。" onChange={v => update('examPoints', v)} rows={3} />
    </K12Supplement>
    <K12Supplement title="补充课堂安排" initialOpen={Boolean(form.methods || form.resources || form.assessment || form.homework)}>
      <div className="field-grid two"><TextArea label="教学方法" value={form.methods} onChange={v => update('methods', v)} rows={3} /><TextArea label="教学资源" value={form.resources} onChange={v => update('resources', v)} rows={3} /></div>
      <div className="field-grid two"><TextArea label="课堂评价" value={form.assessment} onChange={v => update('assessment', v)} rows={3} /><TextArea label="课后作业" value={form.homework} onChange={v => update('homework', v)} rows={3} /></div>
    </K12Supplement>
  </div></div>
}

function Field({ label, value, onChange, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; placeholder?: string }) { if (label.includes('班级规模')) return null; return <label className="field"><span>{label}{required && <b>*</b>}</span><input value={value} placeholder={placeholder || fieldPlaceholders[label]} onChange={(e) => onChange(e.target.value)} /></label> }
function TextArea({ label, value, onChange, rows, required, placeholder }: { label: string; value: string; onChange: (value: string) => void; rows: number; required?: boolean; placeholder?: string }) { return <label className="field"><span>{label}{required && <b>*</b>}</span><textarea rows={rows} value={value} placeholder={placeholder || textAreaPlaceholders[label]} onChange={(e) => onChange(e.target.value)} /></label> }
function SelectField({ label, value, options, optionLabels, onChange, placeholder }: { label: string; value: string; options: string[]; optionLabels?: Record<string, string>; onChange: (value: string) => void; placeholder?: string }) { const isDuration = label.includes('课时') || label.includes('总时长'); return <label className="field"><span>{label}</span><div className="select-wrap"><select value={value} onChange={(e) => onChange(e.target.value)}>{placeholder && <option value="">{placeholder}</option>}{options.map((option) => <option value={option} key={option}>{isDuration ? `${option} 分钟` : optionLabels?.[option] || option}</option>)}</select><ChevronDown size={15} /></div></label> }

function WorkbenchFlow({ stage, hasPlan, onChange }: { stage: WorkbenchStage; hasPlan: boolean; onChange: (stage: WorkbenchStage) => void }) {
  const steps: Array<{ id: WorkbenchStage; number: string; title: string; note: string; ready: boolean }> = [
    { id: 'lesson', number: '01', title: '教案设计', note: hasPlan ? '已生成，可继续修改' : '先完成课程蓝图与五步设计', ready: hasPlan },
    { id: 'output', number: '02', title: 'PPT 与练习题', note: hasPlan ? '审核后生成并应用课堂' : '完成教案后开放', ready: false },
  ]
  return <nav className="unified-prep-flow" aria-label="智能备课融合流程"><div className="unified-prep-flow-title"><span>工作台</span></div>{steps.map((item, index) => <Fragment key={item.id}><button type="button" className={`${stage === item.id ? 'active' : ''} ${item.ready ? 'ready' : ''}`} disabled={item.id === 'output' && !hasPlan} onClick={() => onChange(item.id)}><em>{item.ready ? <Check size={13} /> : item.number}</em><span><strong>{item.title}</strong><small>{item.note}</small></span></button>{index < steps.length - 1 && <ArrowRight className="flow-arrow" size={15} />}</Fragment>)}</nav>
}

function QuickSummary({ plan, form, onEdit, onStep }: { plan: LessonPlan; form: FormState; onEdit: () => void; onStep: (step: 1 | 2 | 3) => void }) {
  return <div className="quick-summary"><div className="quick-summary-head"><div><span className="section-kicker">LESSON / READY</span><h2>本课已生成</h2><p>{plan.title}</p></div><span className="status-chip"><Check size={13} />已生成</span></div><div className="quick-summary-tags"><span>{form.stage}</span>{form.grade && <span>{form.grade}</span>}<span>{form.subject}</span></div><div className="quick-summary-meta"><div><small>课时</small><strong>{form.duration} 分钟</strong></div><div><small>课型</small><strong>{form.lessonType}</strong></div><div><small>场景</small><strong>{form.teachingScene}</strong></div></div><div className="quick-summary-section"><span>快速修改</span><button type="button" onClick={() => onStep(1)}>课程信息 <ArrowRight size={14} /></button><button type="button" onClick={() => onStep(2)}>教材与学情 <ArrowRight size={14} /></button><button type="button" onClick={() => onStep(3)}>教学主线 <ArrowRight size={14} /></button></div><button type="button" className="primary-btn quick-summary-edit" onClick={onEdit}><FileText size={15} />继续编辑课程蓝图</button></div>
}

function EmptyPreview({ form }: { form: FormState }) {
  const filled = [form.topic, form.objectives, form.keyPoints, form.resources, form.assessment].filter(Boolean).length
  return <div className="empty-preview"><div className="empty-preview-kicker"><div className="empty-icon"><ClipboardList size={22} /></div><span>LIVE COURSE BRIEF</span></div><div className="empty-preview-title"><div><h3>本课蓝图</h3><p>{form.topic || '等待填写课题'}</p></div><span className="draft-state">未生成</span></div><div className="brief-tags"><span>{form.stage}</span>{form.grade && <span>{form.grade}</span>}<span>{form.subject}</span></div><div className="brief-grid"><div><small>课时</small><strong>{form.duration} 分钟</strong></div><div><small>课型</small><strong>{form.lessonType}</strong></div><div><small>场景</small><strong>{form.teachingScene}</strong></div><div><small>已完成</small><strong>{filled} / 5 项</strong></div></div><div className="empty-points"><span><Check size={14} />课堂问题链</span><span><Check size={14} />教学型 PPT 大纲</span><span><Check size={14} />本地备案记录</span></div><p className="empty-preview-note">完成左侧课程蓝图后，这里会切换为可编辑教案与课件工作区。</p></div>
}

function SlideGallery({ draft, previews, quality, selected, setSelected, editing, changeSlide, moveSlide, duplicateSlide, deleteSlide, regenerateSlide, slideBusy }: { draft: LessonPlan; previews: SlidePreview[]; quality: QualityReport | null; selected: number; setSelected: (index: number) => void; editing: boolean; changeSlide: (index: number, key: keyof SlidePlan, value: string) => void; moveSlide: (index: number, direction: -1 | 1) => void; duplicateSlide: (index: number) => void; deleteSlide: (index: number) => void; regenerateSlide: (layout?: string) => void; slideBusy: boolean }) {
  const [assets, setAssets] = useState<AssetCandidate[]>([])
  const [assetBusy, setAssetBusy] = useState(false)
  const planIndex = previews[selected]?.sourceIndex ?? selected
  const slide = draft.slides[planIndex] || draft.slides[0]
  const preview = previews[selected]
  const searchAssets = async () => {
    if (!slide?.assetQuery) return
    setAssetBusy(true)
    try { const response = await fetch('/api/prep/assets/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: slide.assetQuery, limit: 6 }) }); const data = await response.json(); setAssets(data.results || []) }
    catch { setAssets([]) }
    finally { setAssetBusy(false) }
  }
  const cacheAsset = async (asset: AssetCandidate) => {
    try {
      const response = await fetch('/api/prep/assets/cache', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: asset.sourceUrl, metadata: asset }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '缓存失败')
      setAssets((current) => current.map((item) => item.sourceUrl === asset.sourceUrl ? { ...item, localPath: data.asset.localPath, sourceType: 'cached' } : item))
    } catch (error) { window.alert(error instanceof Error ? error.message : '素材缓存失败') }
  }
  return <div className="slide-gallery">
    <div className="outline-head"><MonitorPlay size={16} /><span>{draft.request?.pptTheme || '自动推荐'} · {draft.request?.pptLength || '标准'} · {previews.length || draft.slides.length} 页</span><span className={quality && quality.score >= 80 ? 'quality-score good' : 'quality-score'}>质检 {quality?.score ?? '--'}</span></div>
    {quality && (quality.warnings.length > 0 || quality.blocking.length > 0) && <div className="quality-panel"><strong><Eye size={14} />导出前检查</strong>{quality.blocking.map((issue) => <span className="quality-error" key={issue.code + issue.slide}>第{issue.slide || '-'}页：{issue.message}</span>)}{quality.warnings.slice(0, 4).map((issue) => <span key={issue.code + issue.slide}>第{issue.slide || '-'}页：{issue.message}</span>)}</div>}
    <div className="slide-thumbnails">{previews.map((item, index) => <button type="button" className={selected === index ? 'slide-thumb active' : 'slide-thumb'} key={`${item.index}-${item.title}`} onClick={() => setSelected(index)}><img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.previewSvg)}`} alt={`第${index + 1}页预览`} /><span>{String(index + 1).padStart(2, '0')} · {item.type || '教学页'}</span></button>)}</div>
    <div className="slide-detail">
      <div className="slide-detail-preview">{preview ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(preview.previewSvg)}`} alt="当前幻灯片预览" /> : <div className="model-empty">正在生成预览</div>}</div>
      <div className="slide-detail-content">
        <div className="slide-detail-head"><div><span className="outline-type">{slide?.type || '教学页'} · {slide?.layout || 'content-list'}</span><h3>{slide?.title}</h3></div><div className="slide-tools"><button className="icon-btn" title="上一页" onClick={() => moveSlide(planIndex, -1)} disabled={planIndex === 0}><MoveUp size={15} /></button><button className="icon-btn" title="下一页" onClick={() => moveSlide(planIndex, 1)} disabled={planIndex === draft.slides.length - 1}><MoveDown size={15} /></button><button className="icon-btn" title="复制页面" onClick={() => duplicateSlide(planIndex)}><Copy size={15} /></button><button className="icon-btn danger" title="删除页面" onClick={() => deleteSlide(planIndex)} disabled={draft.slides.length <= 1}><Trash2 size={15} /></button></div></div>
        {editing && slide ? <><InlineEdit label="页面标题" value={slide.title} onChange={(value) => changeSlide(planIndex, 'title', value)} rows={2} /><InlineEdit label="页面内容（每行一条）" value={(slide.items || []).join('\n')} onChange={(value) => changeSlide(planIndex, 'items', value)} rows={4} /></> : <><p className="slide-purpose">{slide?.purpose || '暂无教学意图'}</p><ul className="slide-items">{(slide?.items || []).map((item, index) => <li key={index}>{item}</li>)}</ul><div className="slide-meta"><span>证明对象：{slide?.proof || '课堂内容'}</span><span>视觉表达：{slide?.visual || '结构化内容'}</span></div></>}
        <div className="slide-detail-actions"><button className="outline-btn" onClick={() => regenerateSlide()} disabled={slideBusy || editing}>{slideBusy ? <LoaderCircle className="spin" size={14} /> : <RefreshCw size={14} />}重做此页</button><label className="layout-switch"><span>切换版式</span><select value={slide?.layout || ''} onChange={(event) => regenerateSlide(event.target.value)} disabled={slideBusy || editing}><option value="">自动轮换</option>{slideLayoutOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>{slide?.assetQuery && <button className="outline-btn" onClick={searchAssets} disabled={assetBusy}>{assetBusy ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />}搜索配图建议</button>}</div>
        {assets.length > 0 && <div className="asset-suggestions"><strong>可追溯素材建议</strong><div>{assets.map((asset) => <div className="asset-suggestion-row" key={asset.sourceUrl}><a href={asset.sourceUrl} target="_blank" rel="noreferrer"><img src={asset.thumbnail || asset.sourceUrl} alt={asset.altText} /><span>{asset.altText}<small>{asset.license}</small></span></a><button className="icon-btn" title={asset.localPath ? '已缓存' : '缓存素材'} onClick={() => cacheAsset(asset)} disabled={Boolean(asset.localPath)}><Download size={13} /></button></div>)}</div></div>}
      </div>
    </div>
  </div>
}

function LessonPreview({ plan, onUpdate, onSave, onGenerate, onGenerate3d, onRegenerate, busy, modelFile, setModelFile, modelUrl, threeDConfigured, modelGenerationQuota, isAdmin, bioResult, modelAsset, artifacts, pptArtifact, warmupQuestions, warmupGeneration, onGenerateWarmup, onRegenerateWarmupQuestion, onWarmupChange, modelOptions, setModelOptions, onApplyLesson, onImport, coursewareManifest, onCoursewareChange, onNotice, onLessonApproved }: { plan: LessonPlan; onUpdate: (plan: LessonPlan) => void; onSave: () => void; onGenerate: () => void; onGenerate3d: (file: File | null, options: ModelOptions, mode?: ModelMode, views?: ModelViews) => Promise<ImageModelResult | BioResult | undefined>; onRegenerate: () => void; busy: BusyState; modelFile: File | null; setModelFile: (file: File | null) => void; modelUrl: string; threeDConfigured: boolean | null; modelGenerationQuota: ModelGenerationQuota | null; isAdmin: boolean; bioResult: BioResult | null; modelAsset: Record<string, unknown> | null; artifacts: ArtifactState; pptArtifact: { downloadUrl: string; fileName: string } | null; warmupQuestions: WarmupQuestion[]; warmupGeneration: WarmupGeneration | null; onGenerateWarmup: () => void; onRegenerateWarmupQuestion: (index: number) => void; onWarmupChange: (questions: WarmupQuestion[]) => void; modelOptions: ModelOptions; setModelOptions: (options: ModelOptions) => void; onApplyLesson: () => void; onImport?: (files: File[]) => Promise<ImageModelResult>; coursewareManifest: CoursewareManifest | null; onCoursewareChange: (manifest: CoursewareManifest) => void; onNotice: (message: string) => void; onLessonApproved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<'lesson' | 'export' | 'courseware' | 'slides' | 'materials' | 'model' | 'warmup'>('lesson')
  const [draft, setDraft] = useState(plan)
  const teacherLessonDraft = plan.classroomData?.review || null
  const setTeacherLessonDraft = (review: TeacherReview | null) => onUpdate({ ...plan, classroomData: { ...plan.classroomData, review } })
  const [slidePreviews, setSlidePreviews] = useState<SlidePreview[]>([])
  const [quality, setQuality] = useState<QualityReport | null>(null)
  const [selectedSlide, setSelectedSlide] = useState(0)
  const [slideBusy, setSlideBusy] = useState(false)
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const designReady = !draft.designWorkflow || draft.designWorkflow.status === 'approved'
  useEffect(() => setDraft(plan), [plan])
  useEffect(() => {
    let cancelled = false
    fetch('/api/prep/ppt/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: draft }) })
      .then((response) => response.json())
      .then((data) => { if (!cancelled) { setSlidePreviews(data.slides || []); setQuality(data.quality || null); setSelectedSlide((current) => Math.min(current, Math.max(0, (data.slides || []).length - 1))) } })
      .catch(() => { if (!cancelled) { setSlidePreviews([]); setQuality(null) } })
    return () => { cancelled = true }
  }, [draft])
  const change = (key: keyof LessonPlan, value: string | string[]) => setDraft((current) => current.courseProfile && (key === 'objectives' || key === 'learningOutcomes') ? { ...current, objectives: value as string[], learningOutcomes: value as string[] } : { ...current, [key]: value })
  const changeSlide = (index: number, key: keyof SlidePlan, value: string) => setDraft((current) => ({ ...current, slides: current.slides.map((slide, i) => i === index ? { ...slide, [key]: key === 'items' ? splitLines(value) : value } : slide) }))
  const commit = () => {
    let next = draft
    if (draft.courseProfile) {
      next = { ...draft, slides: draft.slides.map((s) => {
        if (s.type === '学习成果' && (draft.learningOutcomes !== plan.learningOutcomes || draft.prerequisites !== plan.prerequisites)) return { ...s, items: [...(draft.learningOutcomes || []), '先修：'+(draft.prerequisites || []).join('；')] }
        if (s.type === '案例' && draft.casePrompt !== plan.casePrompt) return { ...s, items: [draft.casePrompt || '', ...(s.items || []).slice(1)] }
        if (s.type === '作业' && draft.homework !== plan.homework) return { ...s, items: [draft.homework, ...(s.items || []).slice(1)] }
        return s
      }) }
    }
    setDraft(next); onUpdate(next); setEditing(false)
  }
  const applySlides = (slides: SlidePlan[]) => { const next = { ...draft, slides }; setDraft(next); onUpdate(next) }
  const moveSlide = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction; if (nextIndex < 0 || nextIndex >= draft.slides.length) return
    const slides = [...draft.slides]; [slides[index], slides[nextIndex]] = [slides[nextIndex], slides[index]]; applySlides(slides); setSelectedSlide(nextIndex)
  }
  const duplicateSlide = (index: number) => { const slides = [...draft.slides]; slides.splice(index + 1, 0, { ...slides[index], title: `${slides[index].title}（副本）` }); applySlides(slides); setSelectedSlide(index + 1) }
  const deleteSlide = (index: number) => { if (draft.slides.length <= 1) return; const slides = draft.slides.filter((_, slideIndex) => slideIndex !== index); applySlides(slides); setSelectedSlide(Math.min(index, slides.length - 1)) }
  const togglePreviewExpanded = () => setIsPreviewExpanded((current) => !current)
  const regenerateSlide = async (layout?: string) => {
    setSlideBusy(true)
    try {
      const planIndex = slidePreviews[selectedSlide]?.sourceIndex ?? selectedSlide
      const response = await fetch('/api/prep/ppt/regenerate-slide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lessonPlan: draft, slideIndex: planIndex, layout: layout || undefined }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || '单页重做失败')
      setDraft(data.lessonPlan); onUpdate(data.lessonPlan); setSlidePreviews(data.slides || []); setQuality(data.quality || null)
    } catch (error) { window.alert(error instanceof Error ? error.message : '单页重做失败') }
    finally { setSlideBusy(false) }
  }
  return <div className={`preview-wrap${isPreviewExpanded ? ' is-preview-expanded' : ''}`}>
    <div className="preview-top"><div><span className="section-kicker">PREVIEW / DRAFT</span><h2>{draft.title}</h2><p>{draft.overview}</p></div><div className="preview-top-actions"><span className="status-chip"><Check size={14} />已生成</span><button type="button" className="preview-expand-btn" onClick={togglePreviewExpanded} title={isPreviewExpanded ? '还原预览大小' : '放大预览'} aria-label={isPreviewExpanded ? '还原预览大小' : '放大预览'}>{isPreviewExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></div></div>
    <div className="preview-actions">
      {editing ? <button className="primary-btn compact" onClick={commit}><Check size={15} />保存修改</button> : <button className="outline-btn" onClick={() => { setDraft(plan); setEditing(true) }}><FileText size={15} />编辑教案</button>}
      <button className="outline-btn" onClick={onRegenerate} disabled={busy !== null || editing}><RefreshCw size={15} />重新生成</button>
      <button className="outline-btn action-tooltip" data-tooltip="导出经过审核的可读版教案文档。" title="导出经过审核的可读版教案文档。" onClick={() => setActiveTab('export')} disabled={editing || !designReady}><Download size={15} />导出教案</button>
      <button className="outline-btn action-tooltip" data-tooltip="根据当前教案和课件内容生成可编辑的配套 PPT。" title={designReady ? '根据当前教案和课件内容生成可编辑的配套 PPT。' : '请先确认教案内容'} onClick={onGenerate} disabled={busy !== null || editing || !designReady}><Download size={15} />生成配套 PPT</button>
      <button className="outline-btn action-tooltip" data-tooltip="进入五道练习题编辑页面，可修改题干、选项、答案、解析和启用状态。" title={designReady ? '进入五道练习题编辑页面，可修改题干、选项、答案、解析和启用状态。' : '请先确认教案内容'} onClick={() => { setActiveTab('warmup'); if (!warmupQuestions.length) void onGenerateWarmup() }} disabled={busy !== null || editing || !designReady}>{busy === 'warmup' ? <LoaderCircle className="spin" size={15} /> : <Sparkles size={15} />}{warmupQuestions.length ? '编辑练习题' : '进入练习题编辑'}</button>
      <button className="primary-btn compact action-tooltip" data-tooltip="将当前教案、模型、课件和练习题加载到课堂运行界面。" title={designReady ? '将当前教案、模型、课件和练习题加载到课堂运行界面。' : '请先确认教案内容'} onClick={onApplyLesson} disabled={busy !== null || editing || !designReady}><MonitorPlay size={15} />应用到课堂</button>
    </div>
    {draft.modelPlan && <div className="artifact-status" aria-live="polite">{(['pptx','glb','blend','preview'] as const).map((key) => <span key={key} data-status={artifacts[key] || 'pending'}>{({pptx:'PPTX',glb:'GLB',blend:'Blender 工程',preview:'预览图'})[key]} · {({generated:'已生成',generating:'生成中',fallback:'演示回退',failed:'失败',unavailable:'不可用',pending:'待生成'})[artifacts[key] || 'pending'] || artifacts[key]}</span>)}{pptArtifact && <a href={pptArtifact.downloadUrl} download={pptArtifact.fileName}>下载 PPTX</a>}</div>}
    <div className="preview-tabs" role="tablist" aria-label="生成结果预览"><button role="tab" aria-selected={activeTab === 'lesson'} className={activeTab === 'lesson' ? 'active' : ''} onClick={() => setActiveTab('lesson')}>{editing ? '编辑教案' : '教案预览'}</button><button role="tab" aria-selected={activeTab === 'courseware'} className={activeTab === 'courseware' ? 'active' : ''} onClick={() => setActiveTab('courseware')}>互动课件 <em>{coursewareManifest?.scenes.length || '新'}</em></button><button role="tab" aria-selected={activeTab === 'slides'} className={activeTab === 'slides' ? 'active' : ''} onClick={() => setActiveTab('slides')}>PPT 大纲 <em>{draft.slides.length} 页</em></button><button role="tab" aria-selected={activeTab === 'materials'} className={activeTab === 'materials' ? 'active' : ''} onClick={() => setActiveTab('materials')}>教材素材</button><button role="tab" aria-selected={activeTab === 'model'} className={activeTab === 'model' ? 'active' : ''} onClick={() => setActiveTab('model')}>3D 模型</button><button role="tab" aria-selected={activeTab === 'warmup'} className={activeTab === 'warmup' ? 'active' : ''} onClick={() => setActiveTab('warmup')}>练习题 <em>{warmupQuestions.length}/5</em></button></div>
    <div className="preview-scroll">
      {activeTab === 'export' && <LessonExportPage plan={draft} editing={editing} onBack={() => setActiveTab('lesson')} onNotice={onNotice} review={teacherLessonDraft} onReviewChange={setTeacherLessonDraft} />}
      {activeTab === 'lesson' && draft.courseProfile && <>
        <PreviewSection title="课程定位" items={[`${draft.courseProfile.field} · ${draft.courseProfile.courseName}`, `${draft.courseProfile.semester} · ${draft.courseProfile.courseType} · ${draft.courseProfile.credits} 学分 · ${draft.courseProfile.courseHours} 学时`]} />
        {editing ? <><InlineEdit label="学习成果" value={(draft.learningOutcomes || []).join('\n')} onChange={(value) => { change('learningOutcomes',splitLines(value)); change('objectives',splitLines(value)) }} rows={3} /><InlineEdit label="先修知识" value={(draft.prerequisites || []).join('\n')} onChange={(value) => change('prerequisites',splitLines(value))} rows={3} /><InlineEdit label="案例任务" value={draft.casePrompt || ''} onChange={(value) => change('casePrompt',value)} rows={3} /><InlineEdit label="考核设计" value={(draft.assessmentPlan || []).join('\n')} onChange={(value) => change('assessmentPlan',splitLines(value))} rows={3} /></> : <><PreviewSection title="先修知识" items={draft.prerequisites || []} /><PreviewSection title="学习成果" items={draft.learningOutcomes || []} /><PreviewSection title="知识结构图" items={draft.knowledgeMap || []} /><PreviewSection title="案例任务" items={[draft.casePrompt || '']} /><PreviewSection title="考核设计" items={draft.assessmentPlan || []} /></>}
        <PreviewSection title="推荐 3D 模型" items={[draft.modelPlan?.modelName || '', ...(draft.modelPlan?.observationTasks || [])]} />
        {draft.designWorkflow ? <UndergraduateDesignWorkflow plan={draft as unknown as Record<string, unknown> & { request: Record<string, unknown>; designWorkflow?: LessonDesignWorkflow }} onChange={(next) => { const lesson = next as unknown as LessonPlan; setDraft(lesson); onUpdate(lesson) }} onNotice={onNotice} onComplete={() => { if (!hasUsableModelAsset(modelAsset, modelUrl)) onLessonApproved(); else setActiveTab('export') }} /> : draft.professionalOutcomes && <UndergraduateDesignPreview plan={draft} />}
        <ReferenceList references={draft.references || []} />
      </>}
      {activeTab === 'lesson' && (editing ? <div className="edit-preview"><InlineEdit label="课程概览" value={draft.overview} onChange={(value) => change('overview', value)} rows={3} /><InlineEdit label="课程目标（每行一条）" value={draft.objectives.join('\n')} onChange={(value) => change('objectives', splitLines(value))} rows={4} /><InlineEdit label="教学重点（每行一条）" value={draft.keyPoints.join('\n')} onChange={(value) => change('keyPoints', splitLines(value))} rows={3} /><InlineEdit label="教学难点（每行一条）" value={draft.difficulties.join('\n')} onChange={(value) => change('difficulties', splitLines(value))} rows={3} /><InlineEdit label="课后作业" value={draft.homework} onChange={(value) => change('homework', value)} rows={3} /></div> : <><PreviewSection title="课程目标" items={draft.objectives} /><PreviewSection title="学情分析" items={[draft.situation]} /><PreviewSection title="重点与难点" items={[...draft.keyPoints.map((x) => `重点：${x}`), ...draft.difficulties.map((x) => `难点：${x}`)]} /><div className="preview-section"><div className="section-title"><span>教学流程</span><small>{draft.phases.reduce((sum, phase) => sum + phase.time, 0)} 分钟</small></div><div className="timeline">{draft.phases.map((phase) => <div className="timeline-row" key={phase.name}><div className="time-badge">{phase.time}<small>MIN</small></div><div className="timeline-copy"><strong>{phase.name}</strong><p><b>教师活动</b>{phase.teacher}</p><p><b>学生活动</b>{phase.student}</p>{phase.output && <p><b>学生完成的成果</b>{phase.output}</p>}<span><Check size={12} />检查与评价：{phase.check}</span></div></div>)}</div></div><PreviewSection title="板书设计" items={draft.blackboard} /><PreviewSection title="作业设计" items={[draft.homework]} /></>)}
      {activeTab === 'slides' && <SlideGallery draft={draft} previews={slidePreviews} quality={quality} selected={selectedSlide} setSelected={setSelectedSlide} editing={editing} changeSlide={changeSlide} moveSlide={moveSlide} duplicateSlide={duplicateSlide} deleteSlide={deleteSlide} regenerateSlide={regenerateSlide} slideBusy={slideBusy} />}
      {activeTab === 'courseware' && <CoursewareStoryboard lessonPlan={draft as unknown as Record<string, unknown>} model={modelAsset} questions={warmupQuestions} manifest={coursewareManifest} onChange={onCoursewareChange} onNotice={onNotice} />}
      {activeTab === 'materials' && <div className="material-preview"><PreviewSection title="教材依据" items={[draft.request.textbookVersion ? `教材册次 / 模块：${draft.request.textbookVersion}` : '', draft.request.chapter ? `章节：${draft.request.chapter}` : '', draft.request.materialName ? `已使用：${draft.request.materialName}` : '未上传教材资料，依据教师填写内容生成', draft.request.materialPolicy].filter(Boolean)} /><PreviewSection title="课堂知识线索" items={[draft.request.priorKnowledge, draft.request.coreQuestion, ...splitLines(draft.request.examPoints || '')].filter(Boolean)} /><div className="preview-section"><div className="section-title"><span>资料摘录</span></div><p className="material-excerpt">{draft.request.materialText?.slice(0, 1000) || '暂无资料摘录。可返回“教材学情”步骤上传或粘贴内容。'}</p></div></div>}
      {activeTab === 'model' && <ModelPanel file={modelFile} setFile={setModelFile} modelUrl={modelUrl} options={modelOptions} setOptions={setModelOptions} configured={threeDConfigured} assetResult={modelAsset as ImageModelResult | null} quota={modelGenerationQuota} isAdmin={isAdmin} onGenerate={(file, options, mode, views) => onGenerate3d(file, options, mode, views)} onImport={onImport} busy={busy} disabled={editing} />}
      {activeTab === 'warmup' && <WarmupEditor questions={warmupQuestions} generation={warmupGeneration} onChange={(questions) => { setDraft({ ...draft, warmupQuestions: questions }); onUpdate({ ...draft, warmupQuestions: questions }); onWarmupChange(questions); }} onRegenerate={onRegenerateWarmupQuestion} busy={busy === 'warmup'} />}
    </div>
    <div className="preview-foot"><span><FileText size={14} />{draft.generation?.engine === 'ollama' || isAiGeneration(draft.designWorkflow?.generation.engine) ? 'AI 已生成教案初稿，可继续编辑' : draft.generation?.engine === 'unavailable' ? 'AI 未连接' : draft.designWorkflow ? 'AI 辅助个性化调优' : '教案内容'} · 可继续修改</span><span>更新于 {draft.createdAt.replace('T', ' ')}</span></div>
  </div>
}

function ReferenceList({ references }: { references: Reference[] }) {
  return <section className="preview-section"><div className="section-title"><span>参考资料</span></div><ol className="bio-references">{references.map((r,i) => <li key={i}>{r.sourceUrl ? <a href={r.sourceUrl} target="_blank" rel="noreferrer">{r.title}</a> : <strong>{r.title}</strong>}<small>{r.author} · {r.year} · {r.sourceType === 'user-material' ? '用户资料' : r.sourceType === 'builtin-template' ? '内置教学模板' : '公开教育资料'}<br />{r.license}</small></li>)}</ol></section>
}

function WarmupEditor({ questions, generation, onChange, onRegenerate, busy }: { questions: WarmupQuestion[]; generation: WarmupGeneration | null; onChange: (questions: WarmupQuestion[]) => void; onRegenerate: (index: number) => void; busy: boolean }) {
  if (!questions.length) return <section className="preview-section"><div className="section-title"><span>练习题编辑器</span></div><p className="model-empty">正在准备 5 道可编辑练习题…</p></section>
  const update = (index: number, patch: Partial<WarmupQuestion>) => onChange(questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch, source: 'teacher-edited' } : question))
  return <section className="warmup-editor"><div className="section-title"><span>练习题编辑器</span><small>{questions.filter((question) => question.enabled).length}/5 道启用</small></div><div className={`warmup-generation ${generation?.engine === 'builtin-template' ? 'is-fallback' : ''}`}><Sparkles size={14} /><span><strong>{isAiGeneration(generation?.engine) ? 'AI 生成' : 'AI 生成失败，模板回退'}</strong><small>{isAiGeneration(generation?.engine) ? '题目可以继续编辑，教师修改内容不会被覆盖。' : '已使用系统模板生成，题目仍可继续编辑。'}</small></span></div><p className="warmup-note">应用到课堂后沿用摄像头手势选择、语音播题和错题记录。教师修改内容不会被模型同步覆盖。</p>{questions.map((question, index) => <article className={`warmup-question ${question.enabled ? '' : 'is-disabled'}`} key={question.id}><div className="warmup-question-head"><strong>第 {index + 1} 题</strong><label><input type="checkbox" checked={question.enabled} onChange={(event) => update(index, { enabled: event.target.checked })} />启用</label><button type="button" className="outline-btn" onClick={() => onRegenerate(index)} disabled={busy}>重新生成本题</button></div><label className="inline-edit"><span>题干</span><textarea rows={2} value={question.question} onChange={(event) => update(index, { question: event.target.value })} /></label><div className="warmup-options">{question.options.map((option, optionIndex) => <label className="inline-edit" key={`${question.id}-${optionIndex}`}><span>选项 {String.fromCharCode(65 + optionIndex)}{question.correctIndex === optionIndex ? ' · 正确' : ''}</span><input value={option} onChange={(event) => { const options = [...question.options]; options[optionIndex] = event.target.value; update(index, { options }) }} /><input aria-label={`第${index + 1}题选项${String.fromCharCode(65 + optionIndex)}为正确答案`} type="radio" name={`warmup-correct-${question.id}`} checked={question.correctIndex === optionIndex} onChange={() => update(index, { correctIndex: optionIndex })} /></label>)}</div><label className="inline-edit"><span>答案解析</span><textarea rows={2} value={question.explanation} onChange={(event) => update(index, { explanation: event.target.value })} /></label></article>)}</section>
}

function UndergraduateDesignPreview({ plan }: { plan: LessonPlan }) {
  const analysis = plan.contentAnalysis || {}
  const chain = plan.questionChain || []
  const activities = plan.activities || []
  const detail = plan.contentAnalysisDetail || []
  const activityText = (item: NonNullable<LessonPlan['activities']>[number]) => [
    `${item.name}（${item.level} · ${item.duration}分钟）`,
    `学生任务：${item.studentAction || item.student || ''}`,
    `学习内容：${item.learningContent || item.learn || ''}`,
    `教师过程：${item.teacherProcess || item.teacherRole || item.role || ''}`,
    `操作步骤：${(item.studentSteps || []).join('；')}`,
    `教师追问：${(item.questioning || []).join('；')}`,
    `组织方式：${item.organizationDetail || ''}`,
    `教师授课话术：${(item.teacherScript || []).join('；')}`,
    `课堂材料：${(item.materials || []).join('、')}`,
    `过程检查：${(item.checkpoints || []).map((checkpoint: Record<string, string>) => `${checkpoint.time}：${checkpoint.teacherCheck} / 学生证据：${checkpoint.studentEvidence}`).join('；')}`,
    `可见产出：${item.evidence || item.visibleOutput || item.result || ''}`,
    `评价：${item.evaluation || ''}`,
    `评价量规：${(item.evaluationRubric || []).map((rubric: Record<string, string>) => `${rubric.criterion}：达成—${rubric.fullMark}；支架—${rubric.support}`).join('；')}`,
    `补救：${item.remediationPlan || ''}`,
    `常见错误：${(item.commonErrors || []).join('；')}`,
    `设计意图：${item.designRationale || ''}`,
  ].filter((value) => !value.endsWith('：')).join('\n')
  const expandedSections = <>
    <PreviewSection title="教学痛点与设计依据" items={[...(plan.teachingPainPoints || []), ...(plan.designRationale || [])]} />
    <PreviewSection title="内容取舍与突破方法" items={detail.map((item) => `${item.type}｜${item.content}\n值得学习：${item.worthLearning}\n教学侧重：${item.focus}\n突破方法：${item.breakthrough}\n评价证据：${item.evidence}\n可能困难：${item.difficulty}`)} />
    <PreviewSection title="活动详细脚本" items={activities.map(activityText)} />
    <PreviewSection title="课后反思提示" items={plan.reflectionPrompts || []} />
  </>
  return <div className="undergraduate-design-preview">
    {expandedSections}
    <PreviewSection title="专业能力目标（ABCD）" items={plan.professionalOutcomes || []} />
    <PreviewSection title="通用能力目标" items={plan.generalOutcomes || []} />
    <PreviewSection title="导入设计" items={plan.introDesign ? [`钩子类型：${plan.introDesign.hookType}`, plan.introDesign.reason, `课堂话术：${plan.introDesign.script}`, `学生反应预判：${plan.introDesign.studentPrediction}`, `时长：${plan.introDesign.duration} 分钟`] : []} />
    <PreviewSection title="学习内容分类" items={Object.entries(analysis).flatMap(([key, values]) => values.map((value) => `${key}：${value}`))} />
    <PreviewSection title="问题链" items={chain.map((item) => `${item.level}｜${item.question} 追问：${item.followUp} 学生所得：${item.studentGain}`)} />
    <PreviewSection title="学生活动设计" items={activities.map((item) => `${item.name}（${item.level} · ${item.duration}分钟）｜${item.student} 学习：${item.learn} 结果：${item.result} 评价：${item.evaluation}`)} />
    <PreviewSection title="教师行为与板书配合" items={(plan.teacherActions || []).map((item) => `${item.stage}｜${item.actions.join(' + ')}：${item.detail} 板书：${item.board}`)} />
    <PreviewSection title="能力分层" items={Object.entries(plan.abilityDifferentiation || {}).map(([key, value]) => `${key}：${value}`)} />
  </div>
}

function BioModelPanel({ plan, onUpdate, result, onGenerate, busy }: { plan: LessonPlan; onUpdate: (plan: LessonPlan) => void; result: BioResult | null; onGenerate: () => void; busy: boolean }) {
  const model = plan.modelPlan!
  const [catalog, setCatalog] = useState<{ modelKey: string; parts: BioPart[] }[]>([])
  const [hidden, setHidden] = useState<string[]>([])
  const viewer = useRef<HTMLElement | null>(null)
  const [viewerState, setViewerState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => { fetch('/api/prep/biomed/models').then((r) => r.json()).then((data) => setCatalog(data.models || [])).catch(() => setCatalog([])) }, [])
  useEffect(() => { setHidden([]) }, [result])
  useEffect(() => {
    setViewerState('loading')
    const element = viewer.current
    if (!element) return
    const loaded = () => setViewerState('ready')
    const failed = () => setViewerState('error')
    element.addEventListener('load', loaded)
    element.addEventListener('error', failed)
    return () => { element.removeEventListener('load', loaded); element.removeEventListener('error', failed) }
  }, [result])
  const available = catalog.find((m) => m.modelKey === model.modelKey)?.parts || model.partDetails
  const changeParts = (key: string, selected: boolean) => {
    const parts = selected ? [...model.parts,key] : model.parts.filter((p) => p !== key)
    if (!parts.length) return
    const partDetails = available.filter((p) => parts.includes(p.key))
    onUpdate({ ...plan, modelPlan: { ...model, parts, partDetails }, slides: plan.slides.map((s) => s.type === '观察' ? { ...s, items: ['部件：'+partDetails.map((p) => p.name).join('、'), ...(s.items || []).slice(1)] } : s) })
  }
  const toggleVisible = (part: BioPart) => {
    const next = hidden.includes(part.key) ? hidden.filter((k) => k !== part.key) : [...hidden,part.key]
    const el = viewer.current as (HTMLElement & { model?: { materials: { name: string; setAlphaMode: (value: string) => void; pbrMetallicRoughness: { setBaseColorFactor: (value: number[]) => void; baseColorFactor: number[] } }[] } }) | null
    // The GLB uses a unique material for every named anatomical part.
    el?.model?.materials.filter((m) => m.name === part.key).forEach((m) => { const rgba = [...m.pbrMetallicRoughness.baseColorFactor]; rgba[3] = next.includes(part.key) ? 0 : 1; m.setAlphaMode('BLEND'); m.pbrMetallicRoughness.setBaseColorFactor(rgba) })
    setHidden(next)
  }
  return <section className="model-panel biomed-panel"><div className="model-panel-head"><div><span className="section-kicker">BIOMEDICAL / 3D</span><h3>{model.modelName}</h3><p>{result?.message || '可编辑教学结构示意'}</p></div></div>
    <p className="bio-scope">{model.quality || '教学结构示意，非解剖扫描；不按真实比例，不用于诊断或治疗。'}</p>
    <label className="field"><span>结构显示</span><select disabled={busy} value={model.renderMode} onChange={(e) => onUpdate({ ...plan, modelPlan: { ...model, renderMode: e.target.value } })}><option value="assembled">组合结构</option><option value="exploded">拆解观察</option></select></label>
    <fieldset className="bio-parts" disabled={busy}><legend>生成部件</legend>{available.map((part) => <label key={part.key}><input type="checkbox" checked={model.parts.includes(part.key)} onChange={(e) => changeParts(part.key,e.target.checked)} />{part.name}<small>{part.englishName}</small></label>)}</fieldset>
    <PreviewSection title="结构观察任务" items={model.observationTasks} />
    <button className="primary-btn" disabled={busy} onClick={onGenerate}>{busy ? <LoaderCircle size={16} className="spin" /> : <Box size={16} />}生成模型与 Blender 工程</button>
    {result && <><div className="artifact-downloads">{result.glbUrl && <a href={result.glbUrl} download><Download size={15} />GLB</a>}{result.blendUrl && <a href={result.blendUrl} download><Download size={15} />Blender 工程</a>}{result.previewUrl && <a href={result.previewUrl} download><Download size={15} />预览图</a>}</div>
      {result.glbUrl && <><div className="model-result"><model-viewer ref={(el: HTMLElement | null) => { viewer.current = el }} src={result.glbUrl} loading="eager" camera-controls shadow-intensity="1" exposure="1" environment-image="neutral" /></div>{viewerState !== 'ready' && <p role="status">{viewerState === 'error' ? '模型预览加载失败，可下载 GLB 或 Blender 工程查看。' : '模型加载中…'}</p>}</>}
      {result.status === 'generated' && <div className="bio-visibility">{result.partDetails.map((part) => <button className="outline-btn" key={part.key} onClick={() => toggleVisible(part)} aria-pressed={!hidden.includes(part.key)}><Eye size={14} />{part.name} · {hidden.includes(part.key) ? '已隐藏' : '显示'}</button>)}</div>}
      {result.previewUrl && <img className="bio-render" src={result.previewUrl} alt={`${result.modelName}渲染预览`} />}
    </>}
    <ReferenceList references={plan.references || model.references} />
  </section>
}

function ModelPanel({ file, setFile, modelUrl, options, setOptions, configured, assetResult, quota, isAdmin = false, onGenerate, onImport, busy, disabled, onSkip, onCompleteAsset }: { file: File | null; setFile: (file: File | null) => void; modelUrl: string; options: ModelOptions; setOptions: (options: ModelOptions) => void; configured: boolean | null; assetResult?: ImageModelResult | null; quota?: ModelGenerationQuota | null; isAdmin?: boolean; onGenerate: (file: File | null, options: ModelOptions, mode: ModelMode, views: ModelViews) => Promise<ImageModelResult | BioResult | undefined>; onImport?: (files: File[]) => Promise<ImageModelResult>; busy: BusyState; disabled: boolean; onSkip?: () => void; onCompleteAsset?: () => void }) {
  const [mode, setMode] = useState<ModelMode>('single')
  const [views, setViews] = useState<ModelViews>({})
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [result, setResult] = useState<ImageModelResult | null>(assetResult || null)
  const [singleModelWarningOpen, setSingleModelWarningOpen] = useState(false)
  const [generationError, setGenerationError] = useState('')
  const [importing, setImporting] = useState(false)
  const [importInputKey, setImportInputKey] = useState(0)
  const generatingRef = useRef(false)
  const warningDialogRef = useRef<HTMLElement>(null)
  const warningCancelRef = useRef<HTMLButtonElement>(null)
  const singleModelWarningText = '单张图片缺少侧面和背面信息，生成结果的结构完整度和纹理质量可能不如四视图。建议尽量使用主体清晰、背景简单的图片。'
  useEffect(() => { setResult(assetResult || null) }, [assetResult])
  useEffect(() => {
    if (!singleModelWarningOpen) return
    const previousFocus = document.activeElement as HTMLElement | null
    warningCancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setSingleModelWarningOpen(false)
      }
      if (event.key === 'Tab') {
        const buttons = Array.from(warningDialogRef.current?.querySelectorAll('button:not(:disabled)') || []) as HTMLButtonElement[]
        if (!buttons.length) return
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault()
        buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus()
    }
  }, [singleModelWarningOpen])
  const update = (key: keyof ModelOptions, value: string | boolean) => setOptions({ ...options, [key]: value })
  const viewLabels = { front: '正面图', left: '左侧图', right: '右侧图', back: '背面图' } as const
  const viewKeys = Object.keys(viewLabels) as (keyof ModelViews)[]
  const chooseImage = (nextFile: File | undefined, target: 'single' | keyof ModelViews) => {
    if (!nextFile) return
    if (!/^image\/(png|jpeg|webp)$/.test(nextFile.type) && !/\.(png|jpe?g|webp)$/i.test(nextFile.name)) {
      return
    }
    if (nextFile.size > 12 * 1024 * 1024) return
    if (target === 'single') setFile(nextFile)
    else setViews((current) => ({ ...current, [target]: nextFile }))
  }
  const dragProps = (target: 'single' | keyof ModelViews) => ({
    onDragOver: (event: DragEvent<HTMLElement>) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' },
    onDragEnter: () => setDragTarget(target),
    onDragLeave: (event: DragEvent<HTMLElement>) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragTarget(null) },
    onDrop: (event: DragEvent<HTMLElement>) => { event.preventDefault(); setDragTarget(null); chooseImage(event.dataTransfer.files?.[0], target) },
  })
  const generate = async () => {
    if (generatingRef.current || busy !== null || disabled || (mode === 'single' ? !file : viewKeys.some((key) => !views[key]))) return
    generatingRef.current = true
    setGenerationError('')
    try {
      const generated = await onGenerate(file, options, mode, views)
      if (generated && 'parts' in generated) {
        setResult(generated as ImageModelResult)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '3D 生成失败'
      setGenerationError(message)
    } finally {
      generatingRef.current = false
    }
  }
  const submit = async () => {
    if (generatingRef.current || busy !== null || disabled) return
    if (mode === 'single') {
      if (!file) return
      setSingleModelWarningOpen(true)
      return
    }
    await generate()
  }
  const importFiles = async (files: File[]) => {
    if (!onImport || importing || busy !== null || disabled) return
    setImporting(true)
    setGenerationError('')
    try {
      await onImport(files)
      setImportInputKey((value) => value + 1)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : '模型导入失败')
    } finally { setImporting(false) }
  }
  const isDualLayerAnatomy = Boolean(result && 'modelKind' in result && (result as ImageModelResult & { modelKind?: string }).modelKind === 'dual-layer-anatomy')
  const previewModelUrl = isDualLayerAnatomy ? (result?.appearanceUrl || '') : modelUrl
  return <section className="model-panel">
    <div className="model-panel-head"><div><span className="section-kicker">CLASSROOM ASSET</span><h3><Box size={16} />本课教学资产</h3><p>提交图片生成模型，或直接导入已有模型，用于本课教案、课件和课堂活动。</p></div><span className={configured ? 'model-status ready' : 'model-status'}>{configured === null ? '配置检测中' : configured ? '配置已加载' : '图生 3D 不可用'}</span></div>
    {configured === false && <div className="model-warning"><Settings2 size={15} />图生 3D 服务暂不可用（未配置混元 3D Key 或服务未启动），正在自动重试；仍可直接导入已有模型。</div>}
    {onImport && <div className="model-import-row"><label className="outline-btn model-import-button"><UploadCloud size={15} />直接导入模型<input key={importInputKey} type="file" multiple accept=".glb,.gltf,.fbx,.bin,.ktx,.ktx2,.dds,.tga,.bmp,image/*" onChange={(event) => { void importFiles(Array.from(event.target.files || [])); event.currentTarget.value = '' }} /></label><span>支持 GLB、GLTF、FBX 及同批纹理附件，导入后直接预览</span></div>}
    <div className="model-mode-switch" role="tablist" aria-label="3D生成模式"><button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}><span className="model-mode-label">单张图片生成</span><span className="model-mode-tip" role="tooltip">{singleModelWarningText}</span></button><button type="button" className={mode === 'multiview' ? 'active' : ''} onClick={() => setMode('multiview')}>四视角生成</button></div>
    {mode === 'single' ? <label className={`upload-box ${dragTarget === 'single' ? 'dragging' : ''}`} {...dragProps('single')}><UploadCloud size={18} /><span>{file ? file.name : '提交一张 PNG、JPG 或 WebP 图片'}</span><small>{file ? `${Math.ceil(file.size / 1024)} KB · 已就绪` : '点击选择，或直接拖入图片'}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseImage(event.target.files?.[0], 'single')} /></label> : <div className="multiview-grid">{viewKeys.map((key) => <label className={`${views[key] ? 'view-upload ready' : 'view-upload'} ${dragTarget === key ? 'dragging' : ''}`} key={key} {...dragProps(key)}><UploadCloud size={15} /><strong>{viewLabels[key]}</strong><small>{views[key]?.name || '点击选择或拖入图片'}</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseImage(event.target.files?.[0], key)} /></label>)}</div>}
    {mode === 'multiview' && <p className="model-hint">提交正面、左侧、右侧和背面四张图片。</p>}
    <div className="model-controls"><label className="field"><span>拆解方式</span><select value={options.separationMode} onChange={(event) => update('separationMode', event.target.value)}><option value="anatomical">心脏医学语义拆解</option><option value="geometric">普通几何拆件</option></select></label><label className="field"><span>贴图分辨率</span><select value={options.textureResolution} onChange={(event) => update('textureResolution', event.target.value)}><option>512</option><option>768</option><option>1024</option><option>1536</option><option>2048</option></select></label><label className="field"><span>前景占比</span><input type="number" min="0.5" max="1" step="0.05" value={options.foregroundRatio} onChange={(event) => update('foregroundRatio', event.target.value)} /></label><label className="field"><span>目标顶点数</span><input type="number" step="1" value={options.vertexCount} onChange={(event) => update('vertexCount', event.target.value)} /></label><label className="model-check"><input type="checkbox" checked={options.removeBackground} onChange={(event) => update('removeBackground', event.target.checked)} />自动移除背景</label></div>
    {!isAdmin && <div className={`model-quota-notice${quota?.remaining === 0 ? ' exhausted' : ''}`} aria-live="polite"><AlertTriangle size={19} aria-hidden="true" /><span><strong>{quota?.remaining === 0 ? '免费生成次数已用完' : '免费模型生成额度'}</strong><small>{quota?.remaining === 0 ? '请联系管理员' : quota ? '单图、四视图和重新处理各计 1 次' : '额度状态暂不可用，提交时由服务端校验'}</small></span><b className="model-quota-count">{quota ? <>{quota.remaining}<i>/{quota.total} 次</i></> : <>--<i> 次</i></>}</b></div>}
    <div className="model-actions"><button className="primary-btn model-generate" onClick={submit} disabled={busy !== null || importing || disabled || (!isAdmin && quota?.remaining === 0) || (mode === 'single' ? !file : viewKeys.some((key) => !views[key]))}>{busy === '3d' ? <LoaderCircle className="spin" size={15} /> : <ArrowRight size={15} />}{busy === '3d' ? '正在生成模型' : mode === 'single' ? '下一步：生成单图模型' : '下一步：生成四视角模型'}</button>{onSkip && <button type="button" className="outline-btn" onClick={onSkip} disabled={busy !== null || importing}>跳过建模，直接设计教案</button>}</div>
    {generationError && <div className="model-warning model-generation-error"><AlertTriangle size={15} /><span>{generationError}</span></div>}
    {previewModelUrl ? (<><div className="model-result">{result?.source === 'imported' ? <ImportedModelPreview url={previewModelUrl} modelType={result.modelType || 'glb'} assetUrls={result.assetUrls} /> : <model-viewer src={previewModelUrl} camera-controls auto-rotate shadow-intensity="1" exposure="1" environment-image="neutral" />}<div className="image-model-downloads"><a className="model-download" href={result?.fullGlbUrl || modelUrl} download="lesson-model.glb"><Download size={15} />下载模型</a>{result?.blendUrl && <a className="model-download" href={result.blendUrl} download><Download size={15} />Blender 工程</a>}{result?.previewUrl && <a className="model-download" href={result.previewUrl} download><Download size={15} />预览图</a>}</div></div>{result && <div className="part-summary"><strong>{result.source === 'imported' ? '已导入模型' : '生成模型完整外观'}</strong><small>{result.source === 'imported' ? `${result.fileName || '本地模型'} · ${result.modelType?.toUpperCase() || '模型'} · 不含语义部件` : `${result.engine || '来源未知'} · ${result.viewsUsed?.length || 1}/4 视图已使用`}</small><div><span>{result.source === 'imported' ? '按外观模型用于观察，不自动生成拆解部件。' : '保留生成模型原始外观，不附加模板结构。'}</span></div></div>}{result?.status === 'needs_review' && <div className="model-warning"><AlertTriangle size={15} />四视图配准置信度偏低，请检查预览或重新上传；当前不会自动进入教案。</div>}{onCompleteAsset && result?.status === 'generated' && <button type="button" className="primary-btn" onClick={onCompleteAsset}><ArrowRight size={15} />完成建模，进入教案设计</button>}</>) : isDualLayerAnatomy ? <div className="model-warning"><AlertTriangle size={15} />当前记录缺少可用外观文件，请重新导入或提交图片生成。</div> : <div className="model-empty"><Box size={22} /><span>{busy === '3d' ? '正在生成模型…' : importing ? '正在导入模型…' : '导入或生成后将在这里预览模型'}</span></div>}
    {singleModelWarningOpen && <div className="prep-modal-backdrop single-model-warning-backdrop" role="presentation" onMouseDown={(event) => { event.stopPropagation(); setSingleModelWarningOpen(false) }}>
      <section ref={warningDialogRef} className="prep-modal recommendation-modal single-model-warning-modal" role="dialog" aria-modal="true" aria-labelledby="single-model-warning-title" aria-describedby="single-model-warning-copy" onMouseDown={(event) => event.stopPropagation()}>
        <button className="prep-modal-close" type="button" aria-label="关闭提醒" onClick={() => setSingleModelWarningOpen(false)}><X size={18} /></button>
        <div className="recommendation-icon"><AlertTriangle size={24} /></div>
        <h2 id="single-model-warning-title">单图建模提醒</h2>
        <p id="single-model-warning-copy">{singleModelWarningText}</p>
        <div className="prep-modal-actions">
          <button ref={warningCancelRef} type="button" className="outline-btn" onClick={() => setSingleModelWarningOpen(false)}>返回修改</button>
          <button type="button" className="primary-btn" onClick={() => { setSingleModelWarningOpen(false); void generate() }} disabled={busy !== null || disabled || !file}><ArrowRight size={15} />继续生成</button>
        </div>
      </section>
    </div>}
  </section>
}

function ImportedModelPreview({ url, modelType, assetUrls }: { url: string; modelType: ModelType; assetUrls?: Record<string, string> }) {
  const controlRef = useRef<ControlRefs>({
    rotationVelocity: { x: 0, y: 0 }, rotationGestureActive: false, rotationLocked: false,
    voiceRotationActive: false, zoomSpeed: 0, panPosition: { x: 0, y: 0 }, isDragging: false,
    handLandmarks: { left: null, right: null }, interactionHandLandmarks: null, handNDCPosition: null,
    interactionSettings: { zoomSpeed: 0.8, rotationSpeed: 5 },
    agentDisassembly: { enabled: false, strength: 0, spacing: 1.1, avoidOverlap: true, actionId: 0, label: '' },
  })
  return <div className="imported-model-preview"><ModelViewer modelUrl={url} modelType={modelType} assetUrls={assetUrls} controlRef={controlRef} /></div>
}
function PreviewSection({ title, items }: { title: string; items: string[] }) { return <div className="preview-section"><div className="section-title"><span>{title}</span></div><ul className="preview-list">{items.map((item) => <li key={item}><i />{item}</li>)}</ul></div> }
function InlineEdit({ label, value, onChange, rows }: { label: string; value: string; onChange: (value: string) => void; rows: number }) { return <label className="inline-edit"><span>{label}</span><textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} /></label> }

function RecordsView({ records, query, setQuery, onOpen, onDelete, onNew }: { records: RecordItem[]; query: string; setQuery: (v: string) => void; onOpen: (item: RecordItem) => void; onDelete: (id: string) => void; onNew: () => void }) { return <section className="records-view"><div className="records-head"><div><span className="section-kicker">ARCHIVE / LOCAL</span><h2>教案备案记录</h2><p>已保存的各学段教案草稿和生成记录。</p></div><button className="primary-btn" onClick={onNew}><Plus size={17} />新建教案</button></div><div className="record-toolbar"><div className="search-box"><Search size={16} /><input placeholder="搜索课题、学科、专业或课程" value={query} onChange={(e) => setQuery(e.target.value)} /></div><span>{records.length} 条记录</span></div><div className="record-list">{records.length ? records.map((record) => <div className="record-row" key={record.id}><div className="record-icon"><FileText size={18} /></div><div className="record-main"><strong>{record.title}</strong><span>{record.subject} · {new Date(record.updatedAt).toLocaleString('zh-CN')}</span></div><span className="record-tag">已备案</span><button className="icon-btn" title="打开" onClick={() => onOpen(record)}><FolderOpen size={16} /></button><button className="icon-btn danger" title="删除" onClick={() => onDelete(record.id)}><Trash2 size={16} /></button></div>) : <div className="no-records"><History size={28} /><h3>还没有教案备案记录</h3><p>教案会自动保存，生成后可在这里继续编辑。</p></div>}</div></section> }
function KnowledgeView() { return <section className="knowledge-view"><div className="knowledge-hero"><div className="knowledge-symbol"><BookOpen size={27} /></div><span className="section-kicker">KNOWLEDGE BASE / COMING SOON</span><h2>让教案更懂你的课堂</h2><p>后续可以添加教材笔记、教研资料和校本资源，生成时优先引用你自己的内容。</p><div className="future-grid"><div><UploadCloud size={19} /><strong>添加资料</strong><span>Word、PDF、图片与课堂笔记</span></div><div><Layers3 size={19} /><strong>建立分类</strong><span>按专业、课程、章节和标签整理</span></div><div><Sparkles size={19} /><strong>精准生成</strong><span>减少泛化内容，保留校本表达</span></div></div></div></section> }

export default PrepStudio
