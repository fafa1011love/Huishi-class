import test from 'node:test'
import assert from 'node:assert/strict'
import { getCoursewareContentBlocks } from './coursewareSceneContent.ts'

test('renders only the content assigned to an automatically generated continuation page', () => {
  const scene = {
    id: 'scene-11-cont-02', type: 'activity', title: '观察结构（续 2）', claim: '继续学习',
    teacherCue: '', studentAction: '', expectedOutput: '', enabled: true,
    detail: {
      learningContent: '完整原始长内容'.repeat(100),
      pageBlocks: [{ key: 'learningContent-2', label: '学习内容', value: '本页续接内容' }],
    },
  } as never
  assert.deepEqual(getCoursewareContentBlocks(scene), [{ key: 'learningContent-2', label: '学习内容', value: '本页续接内容' }])
})
