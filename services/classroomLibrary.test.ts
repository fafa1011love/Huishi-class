import assert from 'node:assert/strict';
import test from 'node:test';
import { classroomCourseware, contentFingerprint, listClassrooms, normalizeClassroomPlan, persistentClassroomPlan, saveClassroom, type ClassroomPlan } from './classroomLibrary.ts';
import type { CoursewareManifest } from '../types/courseware.ts';

function fixture(): ClassroomPlan {
  return { id: 'lesson-a', title: '教师修改的心脏课', request: { duration: '40' },
    classroomData: { courseware: { lessonId: 'lesson-a', title: '本课课件', model: { modelUrl: '' }, scenes: [{ title: '教师编辑场景', enabled: true }], assets: [] } as unknown as CoursewareManifest } };
}

test('a classroom without a model retains its own edited courseware after reload', () => {
  const plan = normalizeClassroomPlan(fixture());
  const restored = JSON.parse(JSON.stringify(persistentClassroomPlan(plan)));
  assert.equal(classroomCourseware(restored)?.scenes[0].title, '教师编辑场景');
  assert.equal(restored.modelAsset, undefined);
});

test('a different lesson cannot reuse another classroom manifest', () => {
  const plan = fixture();
  plan.classroomData!.courseware!.lessonId = 'lesson-b';
  assert.equal(classroomCourseware(plan), null);
});

test('teaching edits invalidate the confirmed draft, PPT and courseware without losing the lesson', () => {
  const plan = normalizeClassroomPlan(fixture());
  plan.classroomData!.review = { draft: { title: '已审核成稿' } as never, quality: { valid: true, blocking: [] }, confirmed: true };
  plan.classroomData!.ppt = { downloadUrl: '/api/prep/courseware/download/a.pptx', fileName: 'a.pptx' };
  const changed = normalizeClassroomPlan({ ...plan, title: '修改后的课题' });
  assert.equal(changed.title, '修改后的课题');
  assert.equal(changed.classroomData?.review, null);
  assert.equal(changed.classroomData?.ppt, null);
  assert.equal(changed.classroomData?.courseware, null);
});

test('review confirmation and model object URL refresh do not invalidate the same lesson', () => {
  let plan = normalizeClassroomPlan({ ...fixture(), modelAsset: { source: 'generated', glbUrl: '/api/3d/download/one.glb', modelUrl: 'blob:old' } });
  plan.classroomData!.review = { draft: { title: '已审核' } as never, quality: { valid: true, blocking: [] }, confirmed: true };
  plan = normalizeClassroomPlan({ ...plan, modelAsset: { ...plan.modelAsset, modelUrl: 'blob:new', localModelId: 'local-1' } });
  const restored = normalizeClassroomPlan(JSON.parse(JSON.stringify(persistentClassroomPlan(plan))));
  assert.equal(restored.classroomData?.review?.confirmed, true);
  assert.equal(restored.classroomData?.review?.draft.title, '已审核');
});

test('storage preserves local model IDs but never saves temporary object addresses', () => {
  const plan = fixture();
  plan.modelAsset = { source: 'imported', localModelId: 'local-1', modelUrl: 'blob:temporary', assetUrls: { 'texture.png': 'blob:texture' } };
  plan.classroomData!.courseware!.model.modelUrl = 'blob:temporary';
  const saved = persistentClassroomPlan(plan);
  assert.equal(saved.modelAsset?.localModelId, 'local-1');
  assert.doesNotMatch(JSON.stringify(saved), /blob:/);
  assert.equal(saved.classroomData?.courseware?.model.modelUrl, '');
});

test('replacing an imported model with a different same-named file invalidates its courseware', () => {
  const plan = normalizeClassroomPlan({ ...fixture(), modelAsset: { source: 'imported', localModelId: 'old-file', fileName: 'model.glb' } });
  const replaced = normalizeClassroomPlan({ ...plan, modelAsset: { ...plan.modelAsset, localModelId: 'new-file' } });
  assert.equal(replaced.classroomData?.courseware, null);
});

test('PPT cache fingerprint changes when enabled scenes, text or order changes', () => {
  const manifest = fixture().classroomData!.courseware!;
  const fingerprint = contentFingerprint(manifest);
  assert.notEqual(contentFingerprint({ ...manifest, scenes: [{ ...manifest.scenes[0], title: '新内容' }] }), fingerprint);
  assert.notEqual(contentFingerprint({ ...manifest, scenes: [{ ...manifest.scenes[0], enabled: false }] }), fingerprint);
  assert.equal(contentFingerprint(JSON.parse(JSON.stringify(manifest))), fingerprint);
});

test('account records are loaded through the authenticated endpoint and saving reuses lesson ID', async t => {
  const events: string[] = [];
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { dispatchEvent: (event: Event) => { events.push(event.type); } } });
  t.after(() => { if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window'); });
  t.mock.method(globalThis, 'fetch', async (url: unknown, options?: RequestInit) => {
    assert.equal(url, '/api/lesson-plans');
    assert.equal(options?.credentials, 'include');
    if (options?.method === 'POST') {
      const { plan } = JSON.parse(String(options.body));
      assert.equal(plan.id, 'lesson-a');
      return Response.json({ id: plan.id });
    }
    return Response.json({ records: [{ id: 'lesson-a', title: fixture().title, plan: fixture() }] });
  });
  assert.equal((await listClassrooms())[0].id, 'lesson-a');
  await saveClassroom(fixture());
  assert.deepEqual(events, ['classroom-library-updated']);
});
