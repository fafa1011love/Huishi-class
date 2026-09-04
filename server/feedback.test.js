import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_FEEDBACK_ATTACHMENT_SIZE,
  hasFeedbackContent,
  normalizeFeedback,
  validateFeedbackAttachments,
} from './feedback.js';

test('keeps the feedback JSON contract and structured fields', () => {
  const feedback = normalizeFeedback({ content: ' 建议 ', rating: 5, features: ['3d'] });
  assert.equal(feedback.open, '建议');
  assert.equal(feedback.rating, 5);
  assert.deepEqual(feedback.features, ['3d']);
  assert.equal(hasFeedbackContent(feedback), true);
});

test('allows image attachments as the only feedback content', () => {
  const feedback = normalizeFeedback({});
  assert.equal(hasFeedbackContent(feedback), false);
  assert.equal(hasFeedbackContent(feedback, 1), true);
});

test('rejects unsupported, oversized, or excessive attachments', () => {
  assert.throws(() => validateFeedbackAttachments(Array(4).fill({ type: 'image/png', size: 1 })), /最多上传 3 张/);
  assert.throws(() => validateFeedbackAttachments([{ type: 'image/gif', size: 1 }]), /仅支持/);
  assert.throws(() => validateFeedbackAttachments([{ type: 'image/png', size: MAX_FEEDBACK_ATTACHMENT_SIZE + 1 }]), /不能超过 5MB/);
  assert.doesNotThrow(() => validateFeedbackAttachments([{ type: 'image/webp', size: 1024 }]));
});
