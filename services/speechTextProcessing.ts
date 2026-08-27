const MAX_SEGMENT_LENGTH = 72;
const MIN_SEGMENT_LENGTH = 16;
const SENTENCE_BOUNDARY = /[。！？!?；;\n]/;
const SOFT_BOUNDARY = /[，,、]/;
const PROTECTED_TOKEN_CHARACTER = /[A-Za-z0-9.,+%°/_\-₀-₉]/;

const decodeUnicodeEscape = (source: string, slashIndex: number) => {
  const hexStart = slashIndex + 2;
  const hexEnd = hexStart + 4;
  if (source.length < hexEnd) return null;
  const hex = source.slice(hexStart, hexEnd);
  if (!/^[0-9a-fA-F]{4}$/.test(hex)) return { value: '', nextIndex: slashIndex };

  const first = Number.parseInt(hex, 16);
  if (first >= 0xd800 && first <= 0xdbff) {
    const lowSlash = hexEnd;
    if (source.length < lowSlash + 6) return null;
    const lowHex = source.slice(lowSlash + 2, lowSlash + 6);
    if (source.slice(lowSlash, lowSlash + 2) === '\\u' && /^[0-9a-fA-F]{4}$/.test(lowHex)) {
      const second = Number.parseInt(lowHex, 16);
      if (second >= 0xdc00 && second <= 0xdfff) {
        return {
          value: String.fromCodePoint(0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00)),
          nextIndex: lowSlash + 5,
        };
      }
    }
  }

  return { value: String.fromCharCode(first), nextIndex: hexEnd - 1 };
};

/** Decode a JSON string while it is still arriving token by token. */
export const readPartialJsonString = (source: string, key: string) => {
  const match = new RegExp(`"${key}"\\s*:\\s*"`).exec(source);
  if (!match) return '';

  let output = '';
  for (let index = match.index + match[0].length; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') break;
    if (character !== '\\') {
      output += character;
      continue;
    }

    if (index + 1 >= source.length) break;
    const escaped = source[index + 1];
    if (escaped === 'u') {
      const decoded = decodeUnicodeEscape(source, index);
      if (!decoded) break;
      if (!decoded.value) break;
      output += decoded.value;
      index = decoded.nextIndex;
      continue;
    }

    const escapes: Record<string, string> = {
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
      '"': '"',
      '\\': '\\',
      '/': '/',
    };
    if (!(escaped in escapes)) break;
    output += escapes[escaped];
    index += 1;
  }
  return output;
};

const findBoundary = (value: string, from = 0) => {
  const match = SENTENCE_BOUNDARY.exec(value.slice(from));
  return match ? from + match.index : -1;
};

const isProtectedTokenCharacter = (character = '') => PROTECTED_TOKEN_CHARACTER.test(character);

const splitsNumberAndUnit = (value: string, splitAt: number) => {
  let left = splitAt - 1;
  while (left >= 0 && /\s/.test(value[left])) left -= 1;
  let right = splitAt;
  while (right < value.length && /\s/.test(value[right])) right += 1;
  return /[0-9]/.test(value[left] ?? '') && /[A-Za-z%°]/.test(value[right] ?? '');
};

const adjustTokenBoundary = (value: string, splitAt: number) => {
  if (!isProtectedTokenCharacter(value[splitAt - 1]) || !isProtectedTokenCharacter(value[splitAt])) {
    return splitAt;
  }

  let tokenStart = splitAt - 1;
  while (tokenStart > 0 && isProtectedTokenCharacter(value[tokenStart - 1])) tokenStart -= 1;
  if (tokenStart >= MIN_SEGMENT_LENGTH) return tokenStart;

  let tokenEnd = splitAt;
  while (tokenEnd < value.length && isProtectedTokenCharacter(value[tokenEnd])) tokenEnd += 1;
  return tokenEnd;
};

const adjustNumberUnitBoundary = (value: string, splitAt: number) => {
  if (!splitsNumberAndUnit(value, splitAt)) return null;

  let numberEnd = splitAt - 1;
  while (numberEnd >= 0 && /\s/.test(value[numberEnd])) numberEnd -= 1;
  let numberStart = numberEnd;
  while (numberStart > 0 && isProtectedTokenCharacter(value[numberStart - 1])) numberStart -= 1;
  if (numberStart >= MIN_SEGMENT_LENGTH) return numberStart;

  let unitEnd = splitAt;
  while (unitEnd < value.length && /\s/.test(value[unitEnd])) unitEnd += 1;
  while (unitEnd < value.length && isProtectedTokenCharacter(value[unitEnd])) unitEnd += 1;
  return unitEnd;
};

/** Find a natural maximum-length break without cutting an English/scientific token or number-unit pair. */
const findSafeSplitAt = (value: string) => {
  const limit = Math.min(value.length, MAX_SEGMENT_LENGTH);

  for (let index = limit - 1; index >= MIN_SEGMENT_LENGTH - 1; index -= 1) {
    const isNumericComma = /[0-9]/.test(value[index - 1] ?? '') && /[0-9]/.test(value[index + 1] ?? '');
    if (SOFT_BOUNDARY.test(value[index]) && !isNumericComma) return index + 1;
  }

  for (let index = limit - 1; index >= MIN_SEGMENT_LENGTH - 1; index -= 1) {
    if (/\s/.test(value[index]) && !splitsNumberAndUnit(value, index + 1)) return index + 1;
  }

  return adjustNumberUnitBoundary(value, limit) ?? adjustTokenBoundary(value, limit);
};

/** Split streamed narration without emitting tiny fragments when more text is available. */
export const extractSpeechSegments = (value: string, flush = false) => {
  const segments: string[] = [];
  let buffer = value;

  while (buffer.trim()) {
    let punctuation = findBoundary(buffer);
    if (punctuation >= 0) {
      let candidate = buffer.slice(0, punctuation + 1);
      while (candidate.trim().length < MIN_SEGMENT_LENGTH) {
        const nextPunctuation = findBoundary(buffer, punctuation + 1);
        if (nextPunctuation < 0) break;
        punctuation = nextPunctuation;
        candidate = buffer.slice(0, punctuation + 1);
      }

      if (candidate.length > MAX_SEGMENT_LENGTH) {
        candidate = buffer.slice(0, findSafeSplitAt(buffer));
      } else if (candidate.trim().length < MIN_SEGMENT_LENGTH && !flush) {
        if (buffer.length <= MAX_SEGMENT_LENGTH) break;
        candidate = buffer.slice(0, findSafeSplitAt(buffer));
      }
      segments.push(candidate.trim());
      buffer = buffer.slice(candidate.length);
      continue;
    }

    if (buffer.length >= MAX_SEGMENT_LENGTH) {
      const splitAt = findSafeSplitAt(buffer);
      segments.push(buffer.slice(0, splitAt).trim());
      buffer = buffer.slice(splitAt);
      continue;
    }

    if (flush) {
      const tail = buffer.trim();
      if (tail && tail.length < MIN_SEGMENT_LENGTH && segments.length > 0) {
        segments[segments.length - 1] += tail;
      } else if (tail) {
        segments.push(tail);
      }
      buffer = '';
    }
    break;
  }

  return { segments: segments.filter(Boolean), remainder: buffer };
};
