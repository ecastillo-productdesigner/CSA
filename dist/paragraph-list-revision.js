const ordinals = new Map([
  ['first', 1], ['opening', 1], ['introductory', 1], ['second', 2], ['third', 3],
  ['fourth', 4], ['fifth', 5], ['sixth', 6], ['seventh', 7], ['eighth', 8],
  ['ninth', 9], ['tenth', 10], ['eleventh', 11], ['twelfth', 12],
  ['thirteenth', 13], ['fourteenth', 14], ['fifteenth', 15], ['sixteenth', 16],
  ['seventeenth', 17], ['eighteenth', 18], ['nineteenth', 19], ['twentieth', 20],
  ['one', 1], ['two', 2], ['three', 3], ['four', 4], ['five', 5],
  ['six', 6], ['seven', 7], ['eight', 8], ['nine', 9], ['ten', 10],
]);
const ordinalPattern = `(?:${[...ordinals.keys()].join('|')}|[1-9]\\d*(?:st|nd|rd|th)?)`;

function requestDetails(instructions) {
  if (typeof instructions !== 'string') return null;
  const text = instructions.toLowerCase();
  const bulleted = /\bbullet(?:ed|s)?(?:\s+points?)?\b/.test(text);
  const numbered = /\b(?:numbered|ordered)\s+list\b/.test(text);
  if (bulleted === numbered) return null;
  const negative = /\b(?:do\s+not|don['’]t|never|avoid|without|remove)\b[^.!?;]*(?:bullet|numbered\s+list|ordered\s+list)/.test(text);
  if (!negative && !/\b(?:add|convert|turn|make|format|change|use|put|rewrite|split|break)\b/.test(text)) return null;
  const targetPattern = new RegExp(`\\b(${ordinalPattern})\\s+paragraph\\b|\\bparagraph\\s+(?:number\\s+)?(${ordinalPattern})\\b`, 'g');
  const targets = [...text.matchAll(targetPattern)].map(match => ordinals.get(match[1] || match[2]) || Number.parseInt(match[1] || match[2], 10));
  const multiple = new RegExp(`\\b${ordinalPattern}\\s*(?:,|and|or|through|to|-)\\s*(?:the\\s+)?${ordinalPattern}\\s+paragraphs?\\b`);
  if (!targets.length || new Set(targets).size !== 1 || multiple.test(text)) return null;
  return { index: targets[0] - 1, list: numbered ? 'ordered' : 'bullet', negative };
}

export function revisionDocumentBlocks(ops) {
  const blocks = [];
  let offset = 0, start = 0, text = '', embedded = false;
  for (const op of ops) {
    if (!op || !Object.hasOwn(op, 'insert')) return null;
    if (typeof op.insert !== 'string') {
      if (!op.insert || typeof op.insert !== 'object') return null;
      text += '\ufffc';
      embedded = true;
      offset++;
      continue;
    }
    for (const part of op.insert.split(/(\n)/)) {
      if (part === '\n') {
        blocks.push({ start, end: offset, text, embedded, attributes: op.attributes || {}, terminated: true });
        start = ++offset;
        text = '';
        embedded = false;
      } else {
        text += part;
        offset += part.length;
      }
    }
  }
  if (text) blocks.push({ start, end: offset, text, embedded, attributes: {}, terminated: false });
  return blocks;
}

function sliceOps(ops, start, end) {
  const result = [];
  let offset = 0;
  for (const op of ops) {
    const length = typeof op.insert === 'string' ? op.insert.length : 1;
    const from = Math.max(start, offset), to = Math.min(end, offset + length);
    if (from < to) result.push(from === offset && to === offset + length ? op : { ...op, insert: op.insert.slice(from - offset, to - offset) });
    offset += length;
    if (offset >= end) break;
  }
  return result;
}

function sentenceRanges(text) {
  const segments = typeof Intl.Segmenter === 'function'
    ? [...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
    : [{ segment: text, index: 0 }];
  const ranges = [];
  for (let index = 0; index < segments.length; index++) {
    const first = segments[index];
    let segment = first.segment;
    // A short title or initial is not a useful standalone list item.
    while (index + 1 < segments.length && /(?:\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)|(?:^|\s)[A-Z])\.\s*$/.test(segment)) segment += segments[++index].segment;
    const leading = segment.length - segment.trimStart().length;
    const trailing = segment.trimEnd().length;
    if (trailing > leading) ranges.push([first.index + leading, first.index + trailing]);
  }
  return ranges;
}

export function revisionParagraphBlocks(blocks) {
  const paragraphs = [];
  let lastList = null;
  for (const block of blocks) {
    if (!block.text.trim() || block.attributes.header || block.attributes['code-block']) { lastList = null; continue; }
    if (block.attributes.list) {
      if (lastList !== block.attributes.list) paragraphs.push(block);
      lastList = block.attributes.list;
    } else { paragraphs.push(block); lastList = null; }
  }
  return paragraphs;
}

// Returns a handled no-op when the requested paragraph cannot safely be converted.
// Existing list groups occupy one paragraph slot so repeating a conversion is harmless.
export function applyParagraphListRevision(output, instructions) {
  const request = requestDetails(instructions);
  if (!request) return { handled: false, changed: false };
  const unchanged = { handled: true, changed: false };
  if (request.negative) return unchanged;
  const richText = Array.isArray(output.document?.ops);
  const text = typeof output.draftText === 'string' ? output.draftText : '';
  const ops = richText ? output.document.ops : [{ insert: text.endsWith('\n') ? text : `${text}\n` }];
  const blocks = revisionDocumentBlocks(ops);
  if (!blocks) return unchanged;
  const paragraphs = revisionParagraphBlocks(blocks);
  const target = paragraphs[request.index];
  if (!target || target.embedded || target.attributes.list) return unchanged;
  const ranges = sentenceRanges(target.text);
  if (!ranges.length) return unchanged;
  const attributes = { ...target.attributes, list: request.list };
  delete attributes.header;
  const replacement = ranges.flatMap(([start, end]) => [
    ...sliceOps(ops, target.start + start, target.start + end),
    { insert: '\n', attributes: { ...attributes } },
  ]);
  const nextOps = [
    ...sliceOps(ops, 0, target.start),
    ...replacement,
    ...sliceOps(ops, target.end + Number(target.terminated), Infinity),
  ];
  output.document = { ...(richText ? output.document : {}), ops: nextOps };
  output.draftText = nextOps.map(op => typeof op.insert === 'string' ? op.insert : '\ufffc').join('').replace(/\n$/, '');
  return { handled: true, changed: true };
}
