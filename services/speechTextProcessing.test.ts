import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSpeechSegments, readPartialJsonString } from './speechTextProcessing.ts';

test('decodes streamed JSON escapes without leaking partial unicode text', () => {
  assert.equal(readPartialJsonString('{"response":"\\u4f', 'response'), '');
  assert.equal(readPartialJsonString('{"response":"\\u4f60\\u597d', 'response'), '你好');
  assert.equal(readPartialJsonString('{"response":"第一行\\n第二行\\"重点\\"', 'response'), '第一行\n第二行"重点"');
});

test('decodes surrogate pairs only after the complete pair arrives', () => {
  assert.equal(readPartialJsonString('{"response":"开始\\ud83d', 'response'), '开始');
  assert.equal(readPartialJsonString('{"response":"开始\\ud83d\\ude0a', 'response'), '开始😊');
});

test('combines short clauses before emitting a speech segment', () => {
  const result = extractSpeechSegments('好。HIV 病毒模型展示免疫过程。');
  assert.deepEqual(result.segments, ['好。HIV 病毒模型展示免疫过程。']);
  assert.equal(result.remainder, '');
});

test('merges a short flushed tail into the preceding segment', () => {
  const result = extractSpeechSegments('这是一个完整的中文讲解句子。谢谢', true);
  assert.deepEqual(result.segments, ['这是一个完整的中文讲解句子。谢谢']);
  assert.equal(result.remainder, '');
});

test('does not emit a tiny leading clause when a long continuation is available', () => {
  const text = `好。${'这是一段尚未出现第二个句号的连续中文讲解'.repeat(4)}`;
  const result = extractSpeechSegments(text);
  assert.equal(result.segments[0].startsWith('好。'), true);
  assert.equal(result.segments[0].length, 72);
});

test('keeps scientific terms and numbers in normal sentence segments', () => {
  const result = extractSpeechSegments('第 2 题。HIV、NaCl 和 SiO₂ 的正确率是 95%。', true);
  assert.deepEqual(result.segments, ['第 2 题。HIV、NaCl 和 SiO₂ 的正确率是 95%。']);
});

test('combines several short clauses until the balanced minimum is reached', () => {
  const result = extractSpeechSegments('好。可以。接下来我们一起了解人工智能模型。');
  assert.deepEqual(result.segments, ['好。可以。接下来我们一起了解人工智能模型。']);
});

test('keeps long narration segments near the balanced maximum', () => {
  const text = '这是一段没有提前出现句号的连续课堂讲解内容'.repeat(8);
  const result = extractSpeechSegments(text, true);
  assert.equal(result.segments.length > 1, true);
  assert.equal(result.segments.every((segment) => segment.length <= 72), true);
});

test('never cuts English abbreviations, scientific terms, or number-unit pairs', () => {
  for (const term of ['AI', '3D', 'NaCl', 'SiO₂', '95 km']) {
    for (const prefixLength of [70, 71, 72]) {
      const text = `${'课'.repeat(prefixLength)}${term} 都应保持完整。`;
      const result = extractSpeechSegments(text, true);
      assert.equal(result.segments.some((segment) => segment.includes(term)), true, `${term} was split`);
    }
  }
});

test('does not treat a thousands separator as a safe sentence break', () => {
  const term = '95,000km';
  const result = extractSpeechSegments(`${'课'.repeat(70)}${term} 是本次示例数据。`, true);
  assert.equal(result.segments.some((segment) => segment.includes(term)), true);
});
