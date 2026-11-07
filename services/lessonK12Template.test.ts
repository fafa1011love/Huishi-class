import test from 'node:test'
import assert from 'node:assert/strict'
import { highSchoolTextbookOptions, k12GradesByStage, k12StageOptions, resolveK12TemplateStage, subjectsForK12Stage, textbookOptionsForK12Stage } from './k12Template.ts'

test('keeps the visible K12 stages broad while routing primary grades internally', () => {
  assert.deepEqual(k12StageOptions, ['小学', '初中', '高中'])
  assert.deepEqual(k12GradesByStage.小学, ['一年级', '二年级', '三年级', '四年级', '五年级', '六年级'])
})

test('shows the subjects required by each grade', () => {
  assert.deepEqual(subjectsForK12Stage('小学', '一年级'), ['语文', '数学'])
  assert.deepEqual(subjectsForK12Stage('小学', '三年级'), ['语文', '数学', '英语'])
  assert.deepEqual(subjectsForK12Stage('初中', '七年级'), ['语文', '数学', '英语', '政治', '历史', '地理', '生物', '体育'])
  assert.deepEqual(subjectsForK12Stage('初中', '八年级'), ['语文', '数学', '英语', '政治', '历史', '地理', '生物', '物理', '体育'])
  assert.deepEqual(subjectsForK12Stage('初中', '九年级'), ['语文', '数学', '英语', '政治', '历史', '物理', '化学', '体育'])
  assert.deepEqual(subjectsForK12Stage('高中', '高一'), ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '政治', '体育'])
  assert.deepEqual(subjectsForK12Stage('高中', '高三'), subjectsForK12Stage('高中', '高一'))
})

test('maps legacy primary records by grade', () => {
  assert.equal(resolveK12TemplateStage('小学', '二年级'), '小学1-3年级')
  assert.equal(resolveK12TemplateStage('小学', '五年级'), '小学4-6年级')
  assert.equal(resolveK12TemplateStage('小学4-6', '四年级'), '小学4-6年级')
  assert.equal(resolveK12TemplateStage('初中', '八年级'), '初中')
  assert.equal(resolveK12TemplateStage('高中', '高二'), '高中')
})

test('provides textbook modules by high-school subject without changing visible stages', () => {
  assert.ok(highSchoolTextbookOptions.数学.includes('必修第一册'))
  assert.ok(highSchoolTextbookOptions.数学.includes('选择性必修第一册'))
  assert.ok(highSchoolTextbookOptions.生物.includes('必修 1《分子与细胞》'))
  assert.ok(textbookOptionsForK12Stage('高中', '历史').includes('选择性必修 1《国家制度与社会治理》'))
  assert.deepEqual(textbookOptionsForK12Stage('高中', '化学'), ['必修第一册', '必修第二册'])
  assert.deepEqual(textbookOptionsForK12Stage('初中', '数学'), [])
  assert.deepEqual(textbookOptionsForK12Stage('小学', '语文'), [])
})
