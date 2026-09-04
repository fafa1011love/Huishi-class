export const MAX_FEEDBACK_ATTACHMENTS = 3;
export const MAX_FEEDBACK_ATTACHMENT_SIZE = 5 * 1024 * 1024;
export const FEEDBACK_ATTACHMENT_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export function normalizeFeedback(body = {}) {
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (Array.from(content).length > 2000) {
    throw Object.assign(new Error('自由反馈需为 0-2000 个字符'), { status: 400 });
  }

  return {
    rating: typeof body.rating === 'number' && body.rating >= 1 && body.rating <= 5 ? body.rating : null,
    scene: typeof body.scene === 'string' && body.scene ? body.scene : null,
    sceneOther: typeof body.sceneOther === 'string' && body.sceneOther.trim() ? body.sceneOther.trim() : null,
    features: Array.isArray(body.features) ? body.features.filter((item) => typeof item === 'string').slice(0, 20) : [],
    voiceAccuracy: typeof body.voiceAccuracy === 'string' && body.voiceAccuracy ? body.voiceAccuracy : null,
    modelClarity: typeof body.modelClarity === 'string' && body.modelClarity ? body.modelClarity : null,
    open: content || null,
  };
}

export function validateFeedbackAttachments(files = []) {
  if (files.length > MAX_FEEDBACK_ATTACHMENTS) {
    throw Object.assign(new Error(`每条反馈最多上传 ${MAX_FEEDBACK_ATTACHMENTS} 张图片`), { status: 400 });
  }

  for (const file of files) {
    if (!FEEDBACK_ATTACHMENT_MIME_TYPES.has(file.type)) {
      throw Object.assign(new Error('反馈附件仅支持 PNG、JPEG 和 WebP 图片'), { status: 415 });
    }
    if (file.size <= 0 || file.size > MAX_FEEDBACK_ATTACHMENT_SIZE) {
      throw Object.assign(new Error('单张反馈图片不能超过 5MB'), { status: 413 });
    }
  }
}

export function hasFeedbackContent(feedback, attachmentCount = 0) {
  return feedback.rating !== null
    || feedback.scene !== null
    || feedback.sceneOther !== null
    || feedback.features.length > 0
    || feedback.voiceAccuracy !== null
    || feedback.modelClarity !== null
    || feedback.open !== null
    || attachmentCount > 0;
}
