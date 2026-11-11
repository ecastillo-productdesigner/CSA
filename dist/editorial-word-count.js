export const INITIAL_DRAFT_WORD_LIMIT = 500;

const smallNumbers = {
  a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
  fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const numberWord = `(?:${Object.keys(smallNumbers).filter(word => word !== 'a').join('|')}|hundred|thousand)`;
const spelledNumber = `${numberWord}(?:[\\s-]+(?:and[\\s-]+)?${numberWord}){0,10}`;
const numericNumber = '(?:\\d{1,3}(?:,\\d{3})+|\\d+(?:\\.\\d+)?)(?:\\s*k)?';
const number = `(?:${numericNumber}|${spelledNumber})`;
const wordCountPattern = new RegExp(`\\b(${number})(?:\\s*(?:[-–—]|to|through|and)\\s*(${number}))?\\s*(\\+)?\\s*-?\\s*words?\\b`, 'gi');
const intentWords = /\b(?:write|draft|generate|create|produce|make|aim|target|expand|extend|shorten|reduce|trim|keep|limit|set|need|want|should|must|requested|desired)\b/g;
const sourceWords = /\b(?:sources?|original|input|reference|transcript|quotes?|quotations?|excerpts?|notes)\b/g;

function parseNumber(value) {
  const numeric = value.replace(/[,\s]/g, '');
  if (/^\d+(?:\.\d+)?k?$/.test(numeric)) {
    const amount = Number(numeric.replace(/k$/, '')) * (numeric.endsWith('k') ? 1000 : 1);
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
  let total = 0;
  let current = 0;
  for (const word of value.split(/[\s-]+/)) {
    if (word === 'and') continue;
    if (word === 'hundred') current = (current || 1) * 100;
    else if (word === 'thousand') { total += (current || 1) * 1000; current = 0; }
    else if (Object.hasOwn(smallNumbers, word)) current += smallNumbers[word];
    else return null;
  }
  return total + current > 0 ? total + current : null;
}

function lastMatchIndex(text, expression) {
  let index = -1;
  for (const match of text.matchAll(expression)) index = match.index;
  return index;
}

function clausePrefix(text) {
  // Isolate the nearby instruction while leaving decimal points intact.
  return text.split(/[,;!?\n]|\.(?!\d)/).at(-1).trim();
}

/**
 * Recognize explicit draft-length instructions, not the length of the direction
 * field itself. This bounded English parser deliberately ignores source-length
 * descriptions, negated requests, and upper bounds used without a target.
 */
export function requestedEditorialWordCount(text) {
  if (typeof text !== 'string' || !text.trim()) return null;
  const input = text.slice(0, 8000).normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'");
  let requested = null;
  let maximum = Infinity;
  let previousEnd = 0;
  for (const match of input.matchAll(wordCountPattern)) {
    const first = parseNumber(match[1]);
    const second = match[2] ? parseNumber(match[2]) : null;
    if (first === null || (match[2] && second === null)) continue;
    const prefix = clausePrefix(input.slice(previousEnd, match.index));
    const suffix = input.slice(match.index + match[0].length, match.index + match[0].length + 60);
    previousEnd = match.index + match[0].length;
    const intent = lastMatchIndex(prefix, intentWords);
    const source = lastMatchIndex(prefix, sourceWords);
    // “Expand a 1,000-word source into a 300-word draft” describes two different
    // lengths; only the output target belongs to this setting.
    const outputAfterSource = /\b(?:into|to)\b/.test(prefix)
      && /^\s*(?:draft|article|story|summary|piece|post|report)\b/.test(suffix);
    if ((source >= 0 && source > intent && !outputAfterSource)
      || /^\s*(?:[-–—]\s*)?(?:sources?|original|input|reference|transcript|quotes?|quotations?|excerpts?|notes)\b/.test(suffix)
      || /^\s+of\s+(?:(?:the|a|an)\s+)?(?:source|input|reference|transcript|quotes?|notes)\b/.test(suffix)) continue;
    const lowerBound = /\b(?:at least|minimum(?: of)?|no fewer than|not less than)\s*$/.test(prefix);
    const cap = /\b(?:at most|no more than|not more than|not over|up to|maximum(?: of)?|max(?:imum)? length(?: of)?|do not exceed|don't exceed|not exceed|limit(?:ed)? to|under|below|less than|fewer than)\s*$/.test(prefix);
    if (cap && !lowerBound) {
      const exclusive = /\b(?:under|below|less than|fewer than)\s*$/.test(prefix);
      maximum = Math.min(maximum, Math.max(0, (second ?? first) - Number(exclusive)));
      continue;
    }
    if (!lowerBound && /\b(?:do not|don't|never|avoid|not|instead of|rather than)\b/.test(prefix)) continue;
    if (intent < 0 && /\b(?:is|are|was|were|has|have|contains?|totals?|currently|existing|published)\b/.test(prefix)) continue;
    const over = /\b(?:over|more than|greater than|exceeding)\s*$/.test(prefix);
    requested = second !== null ? Math.max(first, second) : first + Number(over);
  }
  return requested === null ? null : Math.min(requested, maximum);
}
