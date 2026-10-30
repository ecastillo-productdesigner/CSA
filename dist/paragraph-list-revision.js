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
  const text = instructions.toLowerCase()
    .replace(/bullet[\s-]*point(?:s|a)?\b/g, 'bullets')
    .replace(/\bbulleted\b/g, 'bullets')
    .replace(/paragrah/g, 'paragraph')
    .replace(new RegExp(`(${ordinalPattern})(?=paragraph|para\\b)`, 'g'), '$1 ')
    .replace(/\b(paragraphs?|paras?)(?=#?\d)/g, '$1 ');
  const bulleted = /\bbullets?\b/.test(text);
  const numbered = /\b(?:numbered|ordered)\s+lists?\b/.test(text);
  if (!bulleted && !numbered && !/\blist\b/.test(text)) return null;
  const unclear = { reason: 'Could not determine which paragraph to turn into a list.' };
  if (!bulleted && !numbered) return { reason: 'Could not determine whether to use bullet points or a numbered list.' };
  let list = numbered ? 'ordered' : 'bullet';
  if (bulleted && numbered) {
    const wanted = text.match(/\b(?:add|use)\s+(?:a\s+)?(bullets?|(?:numbered|ordered)\s+lists?)\b/)
      || [...text.matchAll(/\b(?:to|into|as|with)\s+(?:a\s+)?(bullets?|(?:numbered|ordered)\s+lists?)\b/g)].at(-1);
    if (!wanted) return { reason: 'Could not determine whether to use bullet points or a numbered list.' };
    list = wanted[1].startsWith('bullet') ? 'bullet' : 'ordered';
  }
  if (/\b(?:do\s+not|don['’]?t|never|avoid|without|remove)\b[^.!?;]*(?:bullet|numbered\s+list|ordered\s+list)/.test(text)) {
    return { reason: 'Did not change list formatting because your request said not to add or keep it.' };
  }
  if (/\b(?:shorten|summarize|condense|expand|translate|rephrase|correct|fix|delete)\b/.test(text)
      || /\b(?:and|also|then)\s+(?:please\s+)?(?:rewrite|change|make|add|remove|bold|italicize)\b/.test(text)) {
    return { reason: 'Could not apply this combined request. Request the list formatting separately from other edits.' };
  }
  if (!/\b(?:add|convert|turn|make|format|change|use|put|rewrite|split|break|replace)\b/.test(text)
      && !/^\s*(?:please\s+)?bullets?(?:\s+please)?[.!?\s]*$/.test(text)) return unclear;
  const para = '(?:paragraphs?|paras?)';
  const index = `(?:${ordinalPattern}|last|final)`;
  const targetPattern = new RegExp(`\\b(${index})\\s+${para}\\b|\\b${para}\\s*(?:number\\s*)?#?\\s*(${index})\\b`, 'g');
  const targets = [...text.matchAll(targetPattern)].map(match => {
    const value = match[1] || match[2];
    return ['last', 'final'].includes(value) ? 'last' : ordinals.get(value) || Number.parseInt(value, 10);
  });
  const multiple = new RegExp(`\\b${index}\\s*(?:,|and|or|through|to|-)\\s*(?:the\\s+)?${index}\\s+${para}\\b|\\b${para}\\s*#?${index}\\s*(?:,|and|or|through|to|-)\\s*#?${index}\\b`);
  const counted = new RegExp(`\\b(?:first|last)\\s+${index}\\s+${para}\\b`);
  const combined = new RegExp(`(?:,|\\band\\b|\\bor\\b)\\s*(?:the\\s+)?#?${index}\\s+${para}\\b|\\b${para}\\s*#?${index}\\s*(?:,|and|or|through|to|-)`);
  if (new Set(targets).size > 1 || multiple.test(text) || counted.test(text) || combined.test(text)) return { reason: 'Could not apply multiple paragraph targets in one request. Request one paragraph or all paragraphs.' };
  if (targets.length) return { index: targets[0], list };
  const all = /\b(?:all|every|each)\s+(?:of\s+)?(?:the\s+)?(?:paragraphs?|paras?|text|content)\b|\b(?:whole|entire|full)\s+(?:body|draft|article|text|story)\b|\bthroughout\s+(?:the\s+)?(?:body|draft|article|text|story)\b/.test(text);
  if (all) return { all: true, includeLists: true, list };
  if (bulleted && numbered) return { sourceList: list === 'bullet' ? 'ordered' : 'bullet', plural: /\blists\b/.test(text), list };
  if (new RegExp(`\\b${para}\\b|\\b(?:sentence|line|section|heading|title|headline|intro|introduction|conclusion|opening|closing|part|passage|quote|highlighted|selected|above|below|specific)\\b`).test(text)
      || /\b(?:this|that|these|those)\s+(?:part|passage|list)\b/.test(text)) return unclear;
  return { all: true, includeLists: false, list };
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

// Existing list groups occupy one paragraph slot; every target is validated before editing.
export function applyParagraphListRevision(output, instructions) {
  const request = requestDetails(instructions);
  if (!request) return { handled: false, changed: false };
  const unchanged = reason => ({ handled: true, changed: false, reason });
  if (request.reason) return unchanged(request.reason);
  const richText = Array.isArray(output.document?.ops);
  const text = typeof output.draftText === 'string' ? output.draftText : '';
  const ops = richText ? output.document.ops : [{ insert: text.endsWith('\n') ? text : `${text}\n` }];
  const blocks = revisionDocumentBlocks(ops);
  if (!blocks) return unchanged('Could not read the draft formatting safely.');
  const paragraphs = revisionParagraphBlocks(blocks);
  let targets;
  if (request.all) targets = paragraphs.filter(block => !block.embedded && (request.includeLists || !block.attributes.list));
  else if (request.sourceList) {
    targets = paragraphs.filter(block => block.attributes.list === request.sourceList);
    if (targets.length > 1 && !request.plural) return unchanged('Could not determine which existing list to change.');
  } else {
    const index = request.index === 'last' ? paragraphs.length - 1 : request.index - 1;
    const target = paragraphs[index];
    if (!target) return unchanged(`Could not find ${request.index === 'last' ? 'the last paragraph' : `paragraph ${request.index}`} in the draft.`);
    targets = [target];
  }
  if (!targets.length) return unchanged('Could not find any paragraphs to turn into a list.');
  const edits = [], changes = [];
  for (const target of targets) {
    const start = blocks.indexOf(target), members = [target];
    if (target.attributes.list) {
      for (let index = start + 1; index < blocks.length && blocks[index].text.trim() && blocks[index].attributes.list === target.attributes.list; index++) members.push(blocks[index]);
    }
    if (members.some(block => block.embedded)) {
      if (request.all) continue;
      return unchanged('Could not change this paragraph without affecting its embedded content.');
    }
    if (target.attributes.list === request.list) continue;
    const ranges = target.attributes.list ? null : sentenceRanges(target.text);
    if (!target.attributes.list && !ranges.length) return unchanged('Could not find text in the requested paragraph.');
    const replacement = target.attributes.list
      ? members.flatMap(block => [
        ...sliceOps(ops, block.start, block.end),
        { insert: '\n', attributes: { ...block.attributes, list: request.list } },
      ])
      : ranges.flatMap(([start, end]) => [
        ...sliceOps(ops, target.start + start, target.start + end),
        { insert: '\n', attributes: { ...target.attributes, list: request.list } },
      ]);
    const last = members.at(-1);
    edits.push({ start: target.start, end: last.end + Number(last.terminated), replacement });
    changes.push({ paragraphIndex: paragraphs.indexOf(target), list: request.list, itemCount: members.length > 1 || target.attributes.list ? members.length : ranges.length, previousList: target.attributes.list || null });
  }
  if (!edits.length) return unchanged(`The selected content already uses ${request.list === 'bullet' ? 'bullet points' : 'numbered lists'}, or contains no paragraphs that can be changed safely.`);
  const nextOps = [];
  let offset = 0;
  for (const edit of edits) {
    nextOps.push(...sliceOps(ops, offset, edit.start), ...edit.replacement);
    offset = edit.end;
  }
  nextOps.push(...sliceOps(ops, offset, Infinity));
  output.document = { ...(richText ? output.document : {}), ops: nextOps };
  output.draftText = nextOps.map(op => typeof op.insert === 'string' ? op.insert : '\ufffc').join('').replace(/\n$/, '');
  return { handled: true, changed: true, changes };
}
