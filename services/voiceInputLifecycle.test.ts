import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getVoiceActivationDisposition,
  getAssistantStateAfterKnowledgeClose,
  isVoiceInputLockedByAssistantState,
  shouldCloseVoiceInputAfterFinalUtterance,
  shouldFinishVoiceTurnAfterKnowledgeClose,
  shouldInterruptTeachingPresentationForFinalUtterance,
} from './voiceInputLifecycle.ts';

test('closes voice input before a final utterance is handed to an Agent', () => {
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('讲解地球内部结构'), true);
});

test('a direct final teaching request replaces the active presentation without requiring barge-in', () => {
  assert.equal(shouldInterruptTeachingPresentationForFinalUtterance('讲解心脏模型'), true);
  assert.equal(shouldInterruptTeachingPresentationForFinalUtterance('   '), false);
  assert.equal(shouldInterruptTeachingPresentationForFinalUtterance('A', { answerOnly: true }), false);
});

test('closes input only for a valid final follow-up answer before feedback starts', () => {
  const context = { answerOnly: true, answerOptions: ['A. 地核', 'B. 地幔'] };
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('A', context), true);
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('地核', context), true);
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('我选右边', context), true);
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('不知道', context), false);
  assert.equal(shouldCloseVoiceInputAfterFinalUtterance('   ', context), false);
});

test('re-evaluates the same current follow-up auto-listen request after speech has released', () => {
  const request = { id: 7, scope: 'follow_up' as const, questionId: 'question-7' };
  const ready = { answerOnly: true, activeAnswerQuestionId: 'question-7', disabled: false, listeningAllowed: true, speechActive: false };
  assert.equal(getVoiceActivationDisposition(request, { ...ready, speechActive: true }), 'wait');
  assert.equal(getVoiceActivationDisposition(request, ready), 'start');
  assert.equal(getVoiceActivationDisposition(request, { ...ready, activeAnswerQuestionId: 'question-8' }), 'drop');
  assert.equal(getVoiceActivationDisposition({ id: 8, scope: 'continuous' }, { ...ready, disabled: true }), 'drop');
});

test('keeps voice input locked while a simple answer is being prepared or narrated', () => {
  assert.equal(isVoiceInputLockedByAssistantState('planning'), true);
  assert.equal(isVoiceInputLockedByAssistantState('executing'), true);
  assert.equal(isVoiceInputLockedByAssistantState('explaining'), true);
  assert.equal(isVoiceInputLockedByAssistantState('idle'), false);
  assert.equal(isVoiceInputLockedByAssistantState('questioning'), false);
});

test('returns the assistant to idle when knowledge narration is closed', () => {
  assert.equal(getAssistantStateAfterKnowledgeClose('explaining'), 'idle');
  assert.equal(getAssistantStateAfterKnowledgeClose('complete'), 'idle');
  assert.equal(getAssistantStateAfterKnowledgeClose('planning'), 'planning');
});

test('finishes only an active unfinished knowledge voice turn when its panel closes', () => {
  assert.equal(shouldFinishVoiceTurnAfterKnowledgeClose(true, true, false), true);
  assert.equal(shouldFinishVoiceTurnAfterKnowledgeClose(true, true, true), false);
  assert.equal(shouldFinishVoiceTurnAfterKnowledgeClose(true, false, false), false);
  assert.equal(shouldFinishVoiceTurnAfterKnowledgeClose(false, true, false), false);
});
