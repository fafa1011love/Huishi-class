export type K12TemplateStage = '小学1-3年级' | '小学4-6年级' | '初中' | '高中'
export type K12VisibleStage = '小学' | '初中' | '高中'

export const k12StageOptions: K12VisibleStage[] = ['小学', '初中', '高中']

export const k12GradesByStage: Record<K12VisibleStage, string[]> = {
  小学: ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'],
  初中: ['七年级', '八年级', '九年级'],
  高中: ['高一', '高二', '高三'],
}

// These are the subjects covered by the supplied teaching-plan template sets.
// Keep user-facing names here even when the source folders use shorter names.
export const k12SubjectsByStage: Record<K12VisibleStage, string[]> = {
  小学: ['语文', '数学', '英语'],
  初中: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
  高中: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育'],
}

/** Common high-school textbook volumes/modules. Custom publisher names remain supported in the form. */
export const highSchoolTextbookOptions: Record<string, string[]> = {
  语文: ['必修上册', '必修下册', '选择性必修上册', '选择性必修中册', '选择性必修下册', '选修'],
  数学: ['必修第一册', '必修第二册', '选择性必修第一册', '选择性必修第二册', '选择性必修第三册', '选修'],
  英语: ['必修第一册', '必修第二册', '必修第三册', '选择性必修第一册', '选择性必修第二册', '选择性必修第三册', '选择性必修第四册', '选修'],
  物理: ['必修第一册', '必修第二册', '必修第三册', '选择性必修第一册', '选择性必修第二册', '选择性必修第三册', '选修'],
  化学: ['必修第一册', '必修第二册'],
  生物: ['必修 1《分子与细胞》', '必修 2《遗传与进化》', '选择性必修 1《稳态与调节》', '选择性必修 2《生物与环境》', '选择性必修 3《生物技术与工程》'],
  历史: ['必修《中外历史纲要（上）》', '必修《中外历史纲要（下）》', '选择性必修 1《国家制度与社会治理》', '选择性必修 2《经济与社会生活》', '选择性必修 3《文化交流与传播》'],
  地理: ['必修第一册', '必修第二册', '选择性必修 1《自然地理基础》', '选择性必修 2《区域发展》', '选择性必修 3《资源、环境与国家安全》'],
  政治: ['必修 1《中国特色社会主义》', '必修 2《经济与社会》', '必修 3《政治与法治》', '必修 4《哲学与文化》', '选择性必修 1《当代国际政治与经济》', '选择性必修 2《法律与生活》', '选择性必修 3《逻辑与思维》'],
  体育: ['必修：全一册', '选择性必修：球类、体操、武术等专项模块'],
}

/** Grade-level subjects drive the K12 selectors and keep imported records consistent. */
export const k12SubjectsByGrade: Record<string, string[]> = {
  一年级: ['语文', '数学'],
  二年级: ['语文', '数学'],
  三年级: ['语文', '数学', '英语'],
  四年级: ['语文', '数学', '英语'],
  五年级: ['语文', '数学', '英语'],
  六年级: ['语文', '数学', '英语'],
  七年级: ['语文', '数学', '英语', '政治', '历史', '地理', '生物', '体育'],
  八年级: ['语文', '数学', '英语', '政治', '历史', '地理', '生物', '物理', '体育'],
  九年级: ['语文', '数学', '英语', '政治', '历史', '物理', '化学', '体育'],
  高一: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育'],
  高二: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育'],
  高三: ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育'],
}

const legacyPrimaryGrades = new Set(['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'])

export function resolveK12TemplateStage(stage?: string | null, grade?: string | null): K12TemplateStage {
  const normalizedStage = String(stage || '').trim()
  const normalizedGrade = String(grade || '').trim()
  if (normalizedStage === '小学1-3年级' || normalizedStage === '小学4-6年级') return normalizedStage as K12TemplateStage
  if (normalizedStage === '小学1-3' || normalizedStage === '小学低段') return '小学1-3年级'
  if (normalizedStage === '小学4-6' || normalizedStage === '小学高段') return '小学4-6年级'
  if (normalizedStage === '小学' || normalizedStage.startsWith('小学')) {
    return ['一年级', '二年级', '三年级'].includes(normalizedGrade) ? '小学1-3年级' : '小学4-6年级'
  }
  if (normalizedStage.startsWith('初中') || ['七年级', '八年级', '九年级'].includes(normalizedGrade)) return '初中'
  return '高中'
}

export function normalizeK12Stage(stage?: string | null, grade?: string | null): K12VisibleStage {
  const normalizedStage = String(stage || '').trim()
  if (normalizedStage === '小学' || normalizedStage.startsWith('小学')) return '小学'
  if (normalizedStage === '初中' || normalizedStage.startsWith('初中')) return '初中'
  return '高中'
}

export function gradesForK12Stage(stage?: string | null, grade?: string | null): string[] {
  return k12GradesByStage[normalizeK12Stage(stage, grade)]
}

export function subjectsForK12Stage(stage?: string | null, grade?: string | null): string[] {
  const normalizedGrade = String(grade || '').trim()
  return k12SubjectsByGrade[normalizedGrade] || k12SubjectsByStage[normalizeK12Stage(stage)]
}

export function textbookOptionsForK12Stage(stage?: string | null, subject?: string | null): string[] {
  if (normalizeK12Stage(stage) !== '高中') return []
  return highSchoolTextbookOptions[String(subject || '').trim()] || []
}

export function isK12Stage(stage?: string | null): boolean {
  const normalizedStage = String(stage || '').trim()
  return normalizedStage === '小学' || normalizedStage === '初中' || normalizedStage === '高中' || normalizedStage.startsWith('小学') || normalizedStage.startsWith('初中') || normalizedStage.startsWith('高中')
}

export function isLegacyPrimaryGrade(grade?: string | null): boolean {
  return legacyPrimaryGrades.has(String(grade || '').trim())
}
