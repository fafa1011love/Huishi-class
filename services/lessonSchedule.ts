export const durationByLessonCount: Record<string, string> = { '1': '40', '2': '80', '3': '120' };
export const lessonCountByDuration: Record<string, string> = { '40': '1', '80': '2', '120': '3' };

export function normalizeLessonSchedule(request: { lessonCount?: string | number; duration?: string | number }) {
  const count = String(request.lessonCount ?? '');
  const lessonCount = Object.hasOwn(durationByLessonCount, count)
    ? count
    : lessonCountByDuration[String(request.duration ?? '')] || '1';
  return { lessonCount, duration: durationByLessonCount[lessonCount] };
}
