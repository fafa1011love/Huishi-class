import assert from 'node:assert/strict'
import test from 'node:test'
import JSZip from 'jszip'
import { buildLessonWord, buildTeacherLessonWord, canExportLesson, lessonExportSections, lessonWordFilename } from './lessonWordExport.ts'
import type { LessonDesignWorkflow } from '../types/lessonDesign.ts'

const fixture = () => ({
  title: '心脏结构与功能', request: { stage: '本科', duration: '40', courseName: '解剖学' },
  designWorkflow: {
    version: 2, status: 'approved', duration: 40, abilityLevel: '基础层', qualityPending: false,
    quality: { blocking: [], warnings: [], score: 100, valid: true }, staleSteps: [],
    selectedObjectives: [{ id: 'obj-1', text: '教师修改后的目标：判断血流方向' }],
    steps: [
      { id: 'objectives', number: 1, title: '教学目标', approved: true, status: 'ready', data: { candidateGroups: [{ text: '未选择的候选目标' }] } },
      { id: 'activities-competencies', number: 4, title: '活动与能力', approved: true, status: 'ready', data: { activities: { activities: [{ name: '观察任务', studentAction: '标注瓣膜', evaluation: { standard: '方向全部正确' }, remediation: '使用箭头卡重做', teacherScript: ['请解释依据'] }] } } },
    ], phases: [{ name: '课堂导入', time: 5 }], alignmentMatrix: [{ objectiveId: 'obj-1', activityIds: ['activity-1'] }],
  } as unknown as LessonDesignWorkflow,
})

test('exports confirmed content including activity details without candidate objectives', async () => {
  const plan = fixture()
  const text = lessonExportSections(plan).flatMap(s => s.lines).join('\n')
  assert.match(text, /教师修改后的目标/)
  assert.match(text, /方向全部正确/)
  assert.match(text, /使用箭头卡重做/)
  assert.doesNotMatch(text, /未选择的候选目标/)
  const blob = await buildLessonWord(plan)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /心脏结构与功能/)
  assert.match(xml, /课程信息/)
  assert.match(xml, /教学环节与时间/)
  assert.match(xml, /教学过程/)
  assert.match(xml, /请解释依据/)
  assert.ok((xml.match(/<w:tbl>/g) || []).length >= 2)
  assert.match(xml, /w:w="11906"/)
  assert.match(await zip.file('word/styles.xml')!.async('string'), /宋体/)
  assert.match(await zip.file('word/footer1.xml')!.async('string'), /PAGE/)
})

test('uses the same readable course table and process table for confirmed undergraduate lesson', async () => {
  const blob = await buildTeacherLessonWord({
    title: '心脏血流与心脏结构', courseName: '人体解剖学与生理学', duration: 40,
    overview: '本课围绕心脏结构和血流方向展开。', objectives: ['能够依据结构图说明血流方向。'],
    keyPoints: ['四腔结构与血流方向'], difficulties: ['把结构关系和机制证据对应'],
    teacherPreparation: ['心脏结构图和任务单'], studentPreparation: ['回顾循环系统基本组成'],
    process: [{ name: '问题导入', minutes: 40, teacherActivity: '提出问题并组织观察。', studentActivity: '完成初步判断并说明依据。', question: '你的判断依据是什么？', check: '检查判断和依据是否一致。' }],
    homework: ['完成结构标注图。'], blackboardDesign: ['结构 → 血流方向 → 功能'], references: ['教材相关章节'],
  })
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /课程信息/)
  assert.match(xml, /学科/)
  assert.match(xml, /教学环节与时间/)
  assert.ok((xml.match(/<w:tbl>/g) || []).length >= 2)
})

test('blocks export after edits, stale content, failed quality or missing approval', async () => {
  for (const patch of [{ status: 'review' }, { qualityPending: true }, { staleSteps: ['content'] }, { quality: { blocking: [{ message: '缺少目标' }] } }, { steps: [{ approved: false, status: 'ready' }] }]) {
    const plan = fixture()
    Object.assign(plan.designWorkflow, patch)
    assert.equal(canExportLesson(plan), false)
    await assert.rejects(buildLessonWord(plan), /确认整套教案/)
  }
})

test('supports legacy lessons and safe Word filenames', () => {
  const sections = lessonExportSections({ title: '旧教案', request: {}, objectives: ['理解概念'], homework: '完成练习' } as any)
  assert.ok(sections.some(s => s.title === '课后作业' && s.lines.includes('完成练习')))
  assert.equal(lessonWordFilename('心脏/结构:*?'), '心脏_结构____教案.docx')
})

test('formats K12 teaching phases for teachers instead of exposing output field names', async () => {
  const plan = {
    title: '区域发展',
    request: { stage: '初中', grade: '八年级', subject: '地理', duration: 40 },
    objectives: ['能够根据材料说明区域发展的影响'],
    situation: '学生已有地图阅读经验。',
    keyPoints: ['从数据和地图中提取信息'],
    difficulties: ['用证据说明原因'],
    methods: '读图、讨论和表达',
    resources: '教材和学习单',
    phases: [{ name: '观察资料', time: 8, teacher: '出示地图并提出问题。', student: '小组圈画关键信息。', check: '能指出两条有效信息。', output: '小组完成区域信息分析表。' }],
    assessment: '根据分析表检查证据是否充分。',
    blackboard: ['区域特征 → 原因 → 影响'],
    homework: '完成一份区域分析练习。',
  } as any
  const sections = lessonExportSections(plan)
  const process = sections.find(section => section.title === '教学进程')
  assert.ok(process)
  const text = process!.lines.join('\n')
  assert.match(text, /学生完成的成果：小组完成区域信息分析表/)
  assert.doesNotMatch(text, /output:/)
  assert.doesNotMatch(text, /teacher:/)
  assert.doesNotMatch(text, /student:/)
  const blob = await buildLessonWord(plan)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const xml = await zip.file('word/document.xml')!.async('string')
  assert.match(xml, /学生完成的成果/)
  assert.doesNotMatch(xml, /output:/)
})

test('exports readable high-school textbook context in course information', () => {
  const sections = lessonExportSections({
    title: '函数的概念',
    request: { stage: '高中', grade: '高一', subject: '数学', duration: 40, textbookVersion: '必修第一册', chapter: '函数的概念' },
    overview: '围绕函数概念开展观察和表达。',
  })
  const course = sections.find(section => section.title === '课程信息')
  assert.ok(course)
  assert.ok(course!.lines.includes('教材册次 / 模块：必修第一册'))
  assert.ok(course!.lines.includes('章节：函数的概念'))
})
