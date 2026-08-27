import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFollowUpVoiceAnswer, shouldNarrateKnowledgeAfterFollowUp } from './followUpAnswer.ts';

test('accepts literal A/B and punctuation from speech recognition', () => {
  assert.equal(parseFollowUpVoiceAnswer('A。'), 0);
  assert.equal(parseFollowUpVoiceAnswer('b！'), 1);
  assert.equal(parseFollowUpVoiceAnswer('选择 A 选项'), 0);
  assert.equal(parseFollowUpVoiceAnswer('答案是B'), 1);
});

test('accepts common Chinese transcriptions of spoken A/B', () => {
  for (const text of ['诶', '欸。', '哎', '我选诶', '选一']) {
    assert.equal(parseFollowUpVoiceAnswer(text), 0, text);
  }
  for (const text of ['比', '笔。', '逼', '我选比', '选二']) {
    assert.equal(parseFollowUpVoiceAnswer(text), 1, text);
  }
});

test('accepts position words and the spoken option content', () => {
  const options = ['A. 左心室', 'B. 右心房'];
  assert.equal(parseFollowUpVoiceAnswer('第一个', options), 0);
  assert.equal(parseFollowUpVoiceAnswer('右边', options), 1);
  assert.equal(parseFollowUpVoiceAnswer('左心室', options), 0);
  assert.equal(parseFollowUpVoiceAnswer('我选右心房', options), 1);
});

test('accepts an unambiguous option initial when speech recognition misses the rest', () => {
  const options = ['A. 左心室', 'B. 右心室'];
  assert.equal(parseFollowUpVoiceAnswer('左', options), 0);
  assert.equal(parseFollowUpVoiceAnswer('左心事', options), 0);
  assert.equal(parseFollowUpVoiceAnswer('我选右', options), 1);
});

test('does not use an option initial when both options start with the same character', () => {
  const options = ['A. 左心室', 'B. 左心房'];
  assert.equal(parseFollowUpVoiceAnswer('左', options), null);
  assert.equal(parseFollowUpVoiceAnswer('左心室', options), 0);
  assert.equal(parseFollowUpVoiceAnswer('左心房', options), 1);
});

test('does not guess unrelated classroom speech', () => {
  assert.equal(parseFollowUpVoiceAnswer('请继续讲解心脏模型'), null);
  assert.equal(parseFollowUpVoiceAnswer('不知道'), null);
});

test('releases deferred knowledge narration only after its follow-up is answered', () => {
  const pending = { questionId: 'question-1', text: '这是知识讲解。' };
  assert.equal(shouldNarrateKnowledgeAfterFollowUp(pending, 'question-1', false), true);
  assert.equal(shouldNarrateKnowledgeAfterFollowUp(pending, null, false), false);
  assert.equal(shouldNarrateKnowledgeAfterFollowUp(pending, 'question-2', false), false);
  assert.equal(shouldNarrateKnowledgeAfterFollowUp(pending, 'question-1', true), false);
});
