import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLessonSchedule } from './lessonSchedule.ts';

test('valid lesson count takes precedence over inconsistent duration', () => {
  assert.deepEqual(normalizeLessonSchedule({ lessonCount: '2', duration: '40' }), { lessonCount: '2', duration: '80' });
  assert.deepEqual(normalizeLessonSchedule({ lessonCount: 3, duration: 80 }), { lessonCount: '3', duration: '120' });
});
test('legacy records without valid count derive it from duration', () => {
  assert.deepEqual(normalizeLessonSchedule({ duration: 120 }), { lessonCount: '3', duration: '120' });
  assert.deepEqual(normalizeLessonSchedule({ lessonCount: '0', duration: '80' }), { lessonCount: '2', duration: '80' });
});
test('missing or unsupported schedule uses one 40 minute lesson', () => {
  for (const value of [{}, { duration: 45 }, { lessonCount: '4', duration: 0 }]) {
    assert.deepEqual(normalizeLessonSchedule(value), { lessonCount: '1', duration: '40' });
  }
});
