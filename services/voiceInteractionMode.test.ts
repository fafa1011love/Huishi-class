import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVoiceInteractionMode } from './voiceInteractionMode.ts';

test('recognizes common single-hand mode commands', () => {
  for (const text of ['切换到单手模式', '开启单手控制', '用一只手操作', '单手模式']) {
    assert.equal(parseVoiceInteractionMode(text), 'single', text);
  }
});

test('recognizes common dual-hand mode commands', () => {
  for (const text of ['切换到双手模式', '开启双手控制', '用两只手操作', '双手模式']) {
    assert.equal(parseVoiceInteractionMode(text), 'dual', text);
  }
});

test('uses the final mode in a transition phrase and ignores unrelated speech', () => {
  assert.equal(parseVoiceInteractionMode('从双手模式切换到单手模式'), 'single');
  assert.equal(parseVoiceInteractionMode('从单手模式换成双手模式'), 'dual');
  assert.equal(parseVoiceInteractionMode('把心脏模型放大一点'), null);
});
