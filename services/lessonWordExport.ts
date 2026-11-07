import type { LessonDesignWorkflow } from '../types/lessonDesign'

export type ExportLesson = {
  title: string
  overview?: string
  request: object
  designWorkflow?: LessonDesignWorkflow
}
export type LessonExportSection = { title: string; lines: string[] }
export type TeacherLessonDraft = {
  title: string
  courseName: string
  subject?: string
  stage?: string
  grade?: string
  textbookVersion?: string
  chapter?: string
  lessonType?: string
  duration: number
  overview: string
  objectives: string[]
  keyPoints: string[]
  difficulties: string[]
  teacherPreparation: string[]
  studentPreparation: string[]
  process: Array<{ name: string; minutes: number; teacherActivity: string; studentActivity: string; question: string; check: string }>
  homework: string[]
  blackboardDesign: string[]
  references: string[]
}

export function validateTeacherLessonDraft(draft: TeacherLessonDraft) {
  const blocking: string[] = []
  if (!draft.title.trim() || !draft.overview.trim()) blocking.push('请填写教案标题和课程说明')
  if (!draft.objectives.length || draft.objectives.some(item => !item.trim())) blocking.push('请补全所有教学目标')
  if (!draft.keyPoints.length || draft.keyPoints.some(item => !item.trim())) blocking.push('请补全教学重点')
  if (!draft.difficulties.length || draft.difficulties.some(item => !item.trim())) blocking.push('请补全教学难点')
  if (!draft.teacherPreparation.length || draft.teacherPreparation.some(item => !item.trim())) blocking.push('请补全教师课前准备')
  if (!draft.studentPreparation.length || draft.studentPreparation.some(item => !item.trim())) blocking.push('请补全学生课前准备')
  if (!draft.process.length || draft.process.some(item => !item.name.trim() || !item.teacherActivity.trim() || !item.studentActivity.trim() || !item.question.trim() || !item.check.trim())) blocking.push('教学流程中有环节内容未填写完整')
  if (draft.process.reduce((sum, item) => sum + Number(item.minutes || 0), 0) !== draft.duration) blocking.push('教学流程时间合计必须与本课时长一致')
  if (!draft.homework.length || draft.homework.some(item => !item.trim())) blocking.push('请补全课后作业')
  if (!draft.blackboardDesign.length || draft.blackboardDesign.some(item => !item.trim())) blocking.push('请补全板书设计')
  return { valid: blocking.length === 0, blocking }
}

const labels: Record<string, string> = {
  basic: '基础层作业', advanced: '进阶层作业', criteria: '评价标准', modelAvailable: '模型可用', sourceActivityId: '来源活动',
  impactOnTeaching: '对教学的影响', diagnosticEvidence: '诊断证据', likelyMisconceptions: '常见误区', scopeDecision: '内容范围', focus: '教学聚焦', defer: '暂缓内容', pathLabel: '推理路径', reason: '选择理由', abilityLevel: '能力层次', studentOutcome: '学生成果', basicVariant: '基础层问题', advancedVariant: '进阶层问题', questionId: '对应问题', questionIds: '对应问题', slideIds: '配套课件', warmupQuestionIds: '配套练习', whyWorthLearning: '学习价值', teachingFocus: '教学聚焦', breakthroughMethod: '突破方法', assessmentEvidence: '评价证据', submission: '提交要求', assessment: '评价标准', alignment: '目标对齐', learningValue: '学习价值', integration: '融入方式', feedback: '反馈',
  id: '编号', text: '目标表述', audience: '学习者', condition: '学习条件', behavior: '可观察行为', degree: '达成标准', bloomLevel: '布鲁姆层级',
  coursePosition: '课程定位', items: '内容', content: '学习内容', knowledgeType: '知识类型', proceduralSubtype: '程序性知识类型', worthLearning: '学习价值', priority: '重点难点', studentDifficulty: '学生可能错误', breakthrough: '突破方法', objectiveIds: '对应目标',
  learningProfile: '学情分析', dimension: '维度', description: '描述', strategy: '教学对策', diagnosticTask: '诊断任务',
  path: '推理路径', pathType: '路径类型', rationale: '设计依据', questions: '问题链', question: '问题', followUp: '追问', studentGain: '学习收获', level: '层级', contentIds: '对应内容',
  teaching: '教师教学设计', rows: '教学程序', primaryActions: '教学行为', procedure: '教学程序', board: '板书', type: '类型', timing: '时机', organization: '课堂组织', mode: '组织形式', instruction: '课堂指令', duration: '时长（分钟）', standard: '完成标准', maxContinuousExplanation: '连续讲解上限（分钟）', lectureLimit: '讲解时长要求',
  activities: '学习活动', competencies: '通用能力', name: '名称', studentAction: '学生行动', learningContent: '学习内容', visibleOutput: '可见产出', evaluation: '评价', method: '评价方式', evidence: '评价证据', remediation: '未达标补救', teacherRole: '教师角色', basicAdaptation: '基础层调整', advancedAdaptation: '进阶层调整', resourceMode: '资源形式', modelPartKeys: '模型部件',
  teacherProcess: '教师过程', studentSteps: '学生操作步骤', questioning: '关键追问', organizationDetail: '组织安排', designRationale: '设计依据', teacherPrompts: '教师追问', studentOutput: '学生产出', remediationPlan: '补救方案', teacherScript: '教师话术', materials: '学习材料', checkpoints: '检查节点', time: '时间', teacherCheck: '教师检查', studentEvidence: '学生证据', evaluationRubric: '评价量规', criterion: '评价维度', fullMark: '达标表现', support: '支持要求', commonErrors: '常见错误',
  intro: '课堂导入', hookType: '导入类型', selectionReason: '选择理由', inclusiveness: '核心问题覆盖', advance: '先行组织', nonArbitrary: '已有知识联系', script: '导入话术', studentPrediction: '学生初始判断', summary: '课堂总结', design: '设计', homework: '课后作业', task: '任务', requirements: '要求',
  indicator: '能力指标', objective: '能力目标', cultivation: '培养方式', awarenessFeedback: '观察与反馈', activityIds: '对应活动', evidenceIds: '评价证据', objectiveId: '目标编号',
  structure: '教案结构', professionalOutcomes: '专业能力目标', generalOutcomes: '通用能力目标', keyPoints: '教学重点', difficulties: '教学难点', breakthroughMethods: '突破方法', learningPreparation: '学习准备', blackboardDesign: '板书设计', differentiation: '能力分层', references: '参考资料', homeworkDetail: '作业详情',
  title: '标题', author: '作者', year: '年份', sourceType: '来源类型', sourceUrl: '来源链接', license: '使用许可', usedIn: '使用环节', teacher: '教师活动', student: '学生活动', check: '评价检查',
}
labels.output = '学生完成的成果'
const hidden = new Set(['candidateGroups', 'selectedGroupId', 'hookOptions', 'systemData', 'generationBasis'])

function k12ProcessLines(value: unknown): string[] {
  if (!Array.isArray(value)) return contentLines(value)
  return value.flatMap((phase, index) => {
    if (!phase || typeof phase !== 'object') return contentLines(phase, `第${index + 1}个环节：`)
    const item = phase as Record<string, unknown>
    const name = String(item.name || `第${index + 1}个环节`).trim()
    const time = item.time == null || item.time === '' ? '' : `（${item.time}分钟）`
    const lines = [
      `${name}${time}`,
      item.teacher ? `教师活动：${item.teacher}` : '',
      item.student ? `学生活动：${item.student}` : '',
      item.check ? `检查与评价：${item.check}` : '',
      item.output || item.visibleOutput || item.studentOutput
        ? `学生完成的成果：${item.output || item.visibleOutput || item.studentOutput}`
        : '',
    ]
    return lines.filter(Boolean).map(String)
  })
}

// Read only teaching content; engine metadata and unselected objective candidates are excluded.
export function contentLines(value: unknown, prefix = ''): string[] {
  if (value == null || value === '') return []
  if (Array.isArray(value)) return value.flatMap((item, index) => contentLines(item, typeof item === 'object' ? `${prefix}${index + 1}` : prefix))
  if (typeof value === 'object') {
    const lines = Object.entries(value).flatMap(([key, item]) => hidden.has(key) ? [] : contentLines(item, `${labels[key] || key}：`))
    return lines.length && prefix ? [prefix.replace(/：$/, ''), ...lines] : lines
  }
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value)
  return display.split(/\r?\n/).filter(Boolean).map(line => `${prefix}${line}`)
}

export function lessonExportSections(plan: ExportLesson): LessonExportSection[] {
  const data = plan as ExportLesson & Record<string, any>
  const workflow = plan.designWorkflow
  const sections: LessonExportSection[] = []
  const add = (title: string, value: unknown) => { const lines = contentLines(value); if (lines.length) sections.push({ title, lines }) }
  const request = plan.request as Record<string, unknown>
  add('课程信息', [request.courseName || request.subject, request.stage, request.grade || request.semester, request.textbookVersion ? `教材册次 / 模块：${request.textbookVersion}` : '', request.chapter ? `章节：${request.chapter}` : '', `${workflow?.duration || request.duration || ''} 分钟`, workflow?.abilityLevel, plan.overview].filter(Boolean))
  if (workflow) {
    for (const step of workflow.steps) {
      if (step.id === 'objectives') add(`${step.number} ${step.title}`, { coursePosition: step.data.coursePosition, professionalOutcomes: workflow.selectedObjectives })
      else if (step.id === 'final') {
        const final = data.finalLesson || {}
        add(`${step.number} ${step.title}`, {
          learningPreparation: final.learningPreparation || data.prerequisites,
          keyPoints: final.keyPoints || data.keyPoints,
          difficulties: final.difficulties || data.difficulties,
          breakthroughMethods: final.breakthroughMethods,
          blackboardDesign: final.blackboardDesign || data.boardDesign || data.blackboard,
          differentiation: final.differentiation || data.abilityDifferentiation,
          homeworkDetail: final.homeworkDetail || data.homework,
        })
      } else add(`${step.number} ${step.title}`, step.data)
    }
    add('教学进程', workflow.phases)
    add('目标对齐矩阵', workflow.alignmentMatrix)
  } else {
    for (const [title, value] of Object.entries({ '教学目标': data.objectives, '学情分析': data.situation, '教学重点': data.keyPoints, '教学难点': data.difficulties, '教学方法': data.methods, '教学资源': data.resources, '教学进程': k12ProcessLines(data.phases), '教学评价': data.assessment, '板书设计': data.blackboard, '课后作业': data.homework })) add(title, value)
  }
  add('参考资料', data.finalLesson?.references || data.references)
  return sections
}

export function canExportLesson(plan: ExportLesson) {
  const w = plan.designWorkflow
  return !w || (w.status === 'approved' && !w.qualityPending && !w.quality?.blocking?.length && !w.staleSteps.length && w.steps.every(step => step.approved && step.status !== 'stale'))
}

type UnifiedLessonPhase = {
  name: string
  minutes: number
  teacher: string
  student: string
  question: string
  check: string
  output?: string
}

type UnifiedLessonContent = {
  title: string
  subject: string
  stageGrade: string
  textbook: string
  duration: number
  lessonType: string
  scope: string
  overview: string
  objectives: string[]
  keyPoints: string[]
  difficulties: string[]
  teacherPreparation: string[]
  studentPreparation: string[]
  phases: UnifiedLessonPhase[]
  homework: string[]
  blackboard: string[]
  references: string[]
}

const exportLines = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(item => exportLines(item))
  if (value == null) return []
  return String(value).split(/\r?\n/).map(item => item.trim()).filter(Boolean)
}

function k12UnifiedContent(plan: ExportLesson): UnifiedLessonContent {
  const data = plan as ExportLesson & Record<string, any>
  const request = plan.request as Record<string, any>
  const phases = Array.isArray(data.phases) ? data.phases : []
  const duration = Number(request.duration || phases.reduce((sum: number, item: any) => sum + Number(item?.time || 0), 0) || 40)
  return {
    title: plan.title,
    subject: String(request.subject || request.courseName || ''),
    stageGrade: [request.stage, request.grade].filter(Boolean).join(' · '),
    textbook: String(request.textbookVersion || ''),
    duration,
    lessonType: String(request.lessonType || '新授课'),
    scope: String(request.chapter || request.topic || ''),
    overview: String(plan.overview || ''),
    objectives: exportLines(data.objectives),
    keyPoints: exportLines(data.keyPoints),
    difficulties: exportLines(data.difficulties),
    teacherPreparation: exportLines(data.resources),
    studentPreparation: exportLines(data.priorKnowledge || request.learningSituation),
    phases: phases.map((phase: any, index: number) => ({
      name: String(phase?.name || `第${index + 1}个环节`),
      minutes: Number(phase?.time || 0),
      teacher: String(phase?.teacher || ''),
      student: String(phase?.student || ''),
      question: String(phase?.question || request.coreQuestion || ''),
      check: String(phase?.check || ''),
      output: String(phase?.output || phase?.visibleOutput || phase?.studentOutput || ''),
    })),
    homework: exportLines(data.homework),
    blackboard: exportLines(data.blackboard || data.blackboardDesign),
    references: exportLines(data.references),
  }
}

function undergraduateUnifiedContent(draft: TeacherLessonDraft): UnifiedLessonContent {
  return {
    title: draft.title,
    subject: draft.subject || draft.courseName,
    stageGrade: [draft.stage || '本科', draft.grade].filter(Boolean).join(' · '),
    textbook: draft.textbookVersion || '',
    duration: draft.duration,
    lessonType: draft.lessonType || '新授课',
    scope: draft.chapter || draft.title,
    overview: draft.overview,
    objectives: draft.objectives,
    keyPoints: draft.keyPoints,
    difficulties: draft.difficulties,
    teacherPreparation: draft.teacherPreparation,
    studentPreparation: draft.studentPreparation,
    phases: draft.process.map(item => ({ name: item.name, minutes: item.minutes, teacher: item.teacherActivity, student: item.studentActivity, question: item.question, check: item.check, output: '' })),
    homework: draft.homework,
    blackboard: draft.blackboardDesign,
    references: draft.references,
  }
}

function readableValue(value: unknown): string {
  if (value == null || value === '') return ''
  if (Array.isArray(value)) return value.map(item => readableValue(item)).filter(Boolean).join('；')
  if (typeof value === 'object') return Object.values(value as Record<string, unknown>).map(item => readableValue(item)).filter(Boolean).join('；')
  return String(value).trim()
}

function workflowActivityItems(workflow: LessonDesignWorkflow): Array<Record<string, any>> {
  const items: Array<Record<string, any>> = []
  for (const step of workflow.steps || []) {
    const data = step.data || {}
    const candidates = [data.activities, data.activity, data.teaching, data]
    for (const candidate of candidates) {
      const values = candidate && typeof candidate === 'object'
        ? ((candidate as Record<string, unknown>).activities || (candidate as Record<string, unknown>).items || candidate)
        : []
      if (!Array.isArray(values)) continue
      for (const item of values) if (item && typeof item === 'object' && (
        'studentAction' in item || 'teacherScript' in item || 'visibleOutput' in item || 'evaluation' in item
      )) items.push(item as Record<string, any>)
    }
  }
  return items
}

function undergraduateWorkflowUnifiedContent(plan: ExportLesson): UnifiedLessonContent {
  const data = plan as ExportLesson & Record<string, any>
  const workflow = plan.designWorkflow!
  const request = plan.request as Record<string, any>
  const final = data.finalLesson || {}
  const activities = workflowActivityItems(workflow)
  const workflowPhases = Array.isArray(workflow.phases) ? workflow.phases : []
  const phaseSource = workflowPhases.length ? workflowPhases : activities
  const phases = phaseSource.map((phase: any, index: number) => {
    const activity = activities[index] || {}
    const evaluation = activity.evaluation
    const rubric = activity.evaluationRubric
    return {
      name: String(phase?.name || activity.name || `教学环节${index + 1}`),
      minutes: Number(phase?.time || phase?.minutes || activity.duration || 0),
      teacher: readableValue(phase?.teacher || phase?.teacherActivity || activity.teacherProcess || activity.teacherRole || activity.teacherScript),
      student: readableValue(phase?.student || phase?.studentActivity || activity.studentAction || activity.studentSteps),
      question: readableValue(phase?.question || phase?.questioning || activity.questioning || activity.teacherPrompts),
      check: [
        readableValue(phase?.check || phase?.evaluation || activity.evidence),
        readableValue(typeof evaluation === 'object' ? evaluation?.standard : evaluation),
        readableValue(rubric),
        readableValue(activity.remediation || activity.remediationPlan),
      ].filter(Boolean).join('；'),
      output: readableValue(phase?.output || phase?.visibleOutput || activity.visibleOutput || activity.studentOutput),
    }
  })
  if (activities.length > phaseSource.length) {
    phases.push(...activities.slice(phaseSource.length).map((activity, offset) => ({
      name: String(activity.name || `教学活动${phaseSource.length + offset + 1}`),
      minutes: Number(activity.duration || 0),
      teacher: readableValue(activity.teacherProcess || activity.teacherRole || activity.teacherScript),
      student: readableValue(activity.studentAction || activity.studentSteps),
      question: readableValue(activity.questioning || activity.teacherPrompts),
      check: [
        readableValue(activity.evidence),
        readableValue(typeof activity.evaluation === 'object' ? activity.evaluation?.standard : activity.evaluation),
        readableValue(activity.evaluationRubric),
        readableValue(activity.remediation || activity.remediationPlan),
      ].filter(Boolean).join('；'),
      output: readableValue(activity.visibleOutput || activity.studentOutput),
    })))
  }
  const duration = Number(workflow.duration || request.duration || phases.reduce((sum, item) => sum + item.minutes, 0) || 40)
  return {
    title: plan.title,
    subject: String(request.subject || request.courseName || ''),
    stageGrade: [request.stage || '本科', request.grade].filter(Boolean).join(' · '),
    textbook: String(request.textbookVersion || ''),
    duration,
    lessonType: String(request.lessonType || '新授课'),
    scope: String(request.chapter || request.topic || plan.title || ''),
    overview: String(plan.overview || final.overview || ''),
    objectives: (workflow.selectedObjectives || []).map(item => String(item.text || '')).filter(Boolean),
    keyPoints: exportLines(final.keyPoints || data.keyPoints || request.keyPoints),
    difficulties: exportLines(final.difficulties || data.difficulties || request.difficulties),
    teacherPreparation: exportLines(final.teacherPreparation || final.learningPreparation || data.prerequisites),
    studentPreparation: exportLines(final.studentPreparation || data.studentPreparation),
    phases,
    homework: exportLines(final.homeworkDetail || final.homework || data.homework),
    blackboard: exportLines(final.blackboardDesign || data.boardDesign || data.blackboard),
    references: exportLines(final.references || data.references),
  }
}

async function buildUnifiedLessonWord(content: UnifiedLessonContent, description: string): Promise<Blob> {
  const {
    Document, Packer, Paragraph, TextRun, Header, Footer, Table, TableRow, TableCell,
    AlignmentType, HeadingLevel, PageNumber, WidthType, BorderStyle, VerticalAlign,
  } = await import('docx')
  const font = { ascii: 'Times New Roman', eastAsia: '宋体', hAnsi: 'Times New Roman' }
  const body = (text: string) => new Paragraph({ children: [new TextRun({ text, font, size: 21 })], spacing: { after: 100, line: 300 } })
  const heading = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 180, after: 100 } })
  const bullet = (items: string[]) => items.map(item => new Paragraph({ children: [new TextRun({ text: item, font, size: 21 })], bullet: { level: 0 }, spacing: { after: 60, line: 300 } }))
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' }, bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
    left: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' }, insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'D9D9D9' },
  }
  const cell = (text: string, width: number, header = false) => new TableCell({
    width: { size: width, type: WidthType.DXA }, margins: { top: 100, bottom: 100, left: 110, right: 110 },
    verticalAlign: VerticalAlign.CENTER,
    ...(header ? { shading: { fill: '2F5D73' } } : {}),
    children: [new Paragraph({ children: [new TextRun({ text, font, bold: header, size: header ? 20 : 21, color: header ? 'FFFFFF' : '000000' })], spacing: { after: 0, line: 280 } })],
  })
  const infoRows = [
    ['学科', content.subject, '学段年级', content.stageGrade],
    ['教材册次 / 模块', content.textbook, '本课时长', content.duration ? `${content.duration} 分钟` : ''],
    ['课题类型', content.lessonType, '内容范围', content.scope],
  ].filter(row => Boolean(row[1] || row[3]))
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1700, 2600, 1700, 2600], borders,
    rows: [
      new TableRow({ tableHeader: true, children: [cell('课程信息', 1700, true), cell('内容', 2600, true), cell('课程信息', 1700, true), cell('内容', 2600, true)] }),
      ...infoRows.map(row => new TableRow({ children: [cell(row[0], 1700), cell(row[1], 2600), cell(row[2], 1700), cell(row[3], 2600)] })),
    ],
  })
  const processRows = [
    new TableRow({ tableHeader: true, children: [cell('教学环节与时间', 1450, true), cell('教师活动', 2600, true), cell('学生活动', 2600, true), cell('提问与检查', 2400, true)] }),
    ...content.phases.map(phase => new TableRow({ children: [
      cell(`${phase.name}\n${phase.minutes ? `${phase.minutes}分钟` : ''}`, 1450),
      cell(phase.teacher, 2600),
      cell(phase.student, 2600),
      cell([phase.question ? `提问：${phase.question}` : '', phase.check ? `检查：${phase.check}` : '', phase.output ? `学生完成的成果：${phase.output}` : ''].filter(Boolean).join('\n'), 2400),
    ] })),
  ]
  const processTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [1450, 2600, 2600, 2400], rows: processRows, borders })
  const children = [
    new Paragraph({ text: `${content.title} 教案`, heading: HeadingLevel.TITLE }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${content.subject || content.stageGrade}    本课时长：${content.duration}分钟`, font, size: 21, color: '52636C' })], spacing: { after: 180 } }),
    infoTable,
    heading('课程概览'), body(content.overview),
    heading('教学目标'), ...bullet(content.objectives),
    heading('教学重点'), ...bullet(content.keyPoints),
    heading('教学难点'), ...bullet(content.difficulties),
    ...(content.teacherPreparation.length || content.studentPreparation.length ? [heading('课前准备'), ...(content.teacherPreparation.length ? [body(`教师：${content.teacherPreparation.join('；')}`)] : []), ...(content.studentPreparation.length ? [body(`学生：${content.studentPreparation.join('；')}`)] : [])] : []),
    heading('教学过程'), processTable,
    heading('课后作业'), ...bullet(content.homework),
    heading('板书设计'), ...bullet(content.blackboard),
    ...(content.references.length ? [heading('参考资料'), ...bullet(content.references)] : []),
  ]
  const document = new Document({
    creator: '数智课堂', title: content.title, description,
    styles: { default: { document: { run: { font, size: 21, color: '000000' } } }, paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { font: '黑体', size: 36, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 160 }, keepNext: true } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', run: { font: '黑体', size: 26, bold: true }, paragraph: { spacing: { before: 180, after: 100 }, keepNext: true } },
    ] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1275, bottom: 1275, left: 1134, right: 1134 } } },
      headers: { default: new Header({ children: [new Paragraph({ text: '数智课堂 · 教学设计', alignment: AlignmentType.RIGHT })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: ['第 ', PageNumber.CURRENT, ' 页'], font })] })] }) },
      children,
    }],
  })
  return Packer.toBlob(document)
}

export async function buildLessonWord(plan: ExportLesson): Promise<Blob> {
  if (!canExportLesson(plan)) throw new Error('请先重新校验并确认整套教案')
  const content = plan.designWorkflow ? undergraduateWorkflowUnifiedContent(plan) : k12UnifiedContent(plan)
  return buildUnifiedLessonWord(content, '数智课堂教学设计')
}

export async function buildTeacherLessonWord(draft: TeacherLessonDraft): Promise<Blob> {
  const review = validateTeacherLessonDraft(draft)
  if (!review.valid) throw new Error(review.blocking[0])
  return buildUnifiedLessonWord(undergraduateUnifiedContent(draft), '教师审核后的课堂教案')
}

export function lessonWordFilename(title: string) {
  return `${title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 100) || '数智课堂'}_教案.docx`
}
