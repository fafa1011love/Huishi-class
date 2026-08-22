const compactVoiceText = (value: string) => value
  .normalize('NFKC')
  .toLowerCase()
  .replace(/[\s，。！？、,.!?；;：“”"'‘’（）()【】\[\]]/g, '');

const normalizedOptionText = (option: string) =>
  compactVoiceText(option).replace(/^[ab][.、:：]?/, '');

const optionMatches = (spoken: string, option: string) => {
  const normalizedOption = normalizedOptionText(option);
  return Boolean(normalizedOption) && (
    spoken === normalizedOption
    || spoken === `选${normalizedOption}`
    || spoken === `我选${normalizedOption}`
    || spoken === `答案是${normalizedOption}`
  );
};

const stripAnswerPrefix = (spoken: string) =>
  spoken.replace(/^(?:选择|我选|答案是|答案|选)/, '');

export type PendingKnowledgeNarration = {
  questionId: string;
  text: string;
};

/** Only release deferred knowledge speech after the same follow-up was answered and the panel remains open. */
export const shouldNarrateKnowledgeAfterFollowUp = (
  pending: PendingKnowledgeNarration | null,
  answeredQuestionId: string | null,
  knowledgePanelClosed: boolean,
) => Boolean(pending && answeredQuestionId === pending.questionId && !knowledgePanelClosed);

/** Map common zh-CN speech-recognition results for A/B choices. */
export const parseFollowUpVoiceAnswer = (text: string, options: string[] = []): 0 | 1 | null => {
  const spoken = compactVoiceText(text);
  if (!spoken) return null;

  const prefix = '(?:选|选择|我选|答案|答案是)?';
  if (new RegExp(`^${prefix}(?:a|诶|欸|哎|唉|一|第一个|左边|左侧)(?:选项)?$`).test(spoken)) return 0;
  if (new RegExp(`^${prefix}(?:b|比|笔|逼|必|币|二|第二个|右边|右侧)(?:选项)?$`).test(spoken)) return 1;

  if (options[0] && optionMatches(spoken, options[0])) return 0;
  if (options[1] && optionMatches(spoken, options[1])) return 1;

  const normalizedOptions = options.slice(0, 2).map(normalizedOptionText);
  const [firstOption, secondOption] = normalizedOptions;
  const firstOptionInitial = Array.from(firstOption || '')[0];
  const secondOptionInitial = Array.from(secondOption || '')[0];
  const spokenAnswer = stripAnswerPrefix(spoken);

  // ASR often gets the tail of a Chinese option wrong (for example “左心事”).
  // A one-character answer is only unambiguous when the two options start differently.
  if (firstOptionInitial && secondOptionInitial && firstOptionInitial !== secondOptionInitial) {
    if (spokenAnswer.startsWith(firstOptionInitial)) return 0;
    if (spokenAnswer.startsWith(secondOptionInitial)) return 1;
  }
  return null;
};
