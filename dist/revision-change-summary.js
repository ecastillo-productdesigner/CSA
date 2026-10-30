export function mentionsElephant(instructions) {
  return /\belephants?\b/i.test(instructions || '');
}

const normalize = text => text.replace(/\s+/g, ' ').trim();
const paragraphs = text => text.split(/\r?\n+/).map(normalize).filter(Boolean);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const words = text => text ? text.split(/\s+/).length : 0;
const quantity = count => ['zero', 'one', 'two', 'three', 'four', 'five'][count] || String(count);
const position = index => index < 5 ? `the ${['opening', 'second', 'third', 'fourth', 'fifth'][index]} paragraph` : `paragraph ${index + 1}`;
const subsequence = (a, b) => { let index = 0; for (const text of b) if (text === a[index]) index++; return index === a.length; };
const excerpt = text => {
  const parts = text.split(' '), start = parts.slice(0, 12).join(' ').slice(0, 90).replace(/[.!?…]+$/, '');
  return start + (start.length < text.replace(/[.!?…]+$/, '').length ? '…' : '');
};

function bodyChanges(before, after) {
  const old = paragraphs(before), next = paragraphs(after);
  if (same(old, next)) return before === after ? [] : ['Adjusted spacing in the draft.'];
  let start = 0, end = 0;
  while (start < Math.min(old.length, next.length) && old[start] === next[start]) start++;
  while (end < Math.min(old.length, next.length) - start && old.at(-1 - end) === next.at(-1 - end)) end++;
  const removed = old.slice(start, old.length - end), added = next.slice(start, next.length - end);
  if (normalize(old.join(' ')) === normalize(next.join(' '))) {
    if (removed.length === 1 && added.length > 1) return [`Split ${position(start)} into ${quantity(added.length)}, breaking before “${excerpt(added[1])}”.`];
    if (removed.length > 1 && added.length === 1) return [`Merged ${quantity(removed.length)} paragraphs starting with ${position(start)}.`];
    return ['Adjusted paragraph breaks in the draft.'];
  }
  if (!removed.length) {
    const location = start === 0 ? 'at the beginning' : start === old.length ? 'at the end' : `after ${position(start - 1)}`;
    return [`Added ${quantity(added.length)} ${added.length === 1 ? 'paragraph' : 'paragraphs'} ${location}.`];
  }
  if (!added.length) return [removed.length === 1 ? `Removed ${position(start)}.` : `Removed ${quantity(removed.length)} paragraphs starting with ${position(start)}.`];
  if (same([...old].sort(), [...next].sort())) {
    const count = old.filter((text, index) => text !== next[index]).length;
    return [new Set(old).size === old.length ? `Reordered ${quantity(count)} paragraphs.` : 'Reordered the paragraphs.'];
  }
  if (old.length === next.length && old.length > 1 && old[0] !== next[0] && !same(old.slice(1), next.slice(1)) && same([...old.slice(1)].sort(), [...next.slice(1)].sort())) return ['Rewrote the opening paragraph and reordered the remaining paragraphs.'];
  if (subsequence(old, next)) return [`Added ${quantity(next.length - old.length)} paragraphs.`];
  if (subsequence(next, old)) return [`Removed ${quantity(old.length - next.length)} paragraphs.`];
  if (old.length === next.length && old.length > 1 && !old.some((text, index) => next.includes(text) && next[index] !== text)) {
    const changed = old.flatMap((text, index) => text === next[index] ? [] : [index]);
    if (changed.length === 1) {
      const index = changed[0], from = words(old[index]), to = words(next[index]);
      return [from === to ? `Rewrote ${position(index)}.` : `${to < from ? 'Shortened' : 'Expanded'} ${position(index)} from ${from} to ${to} words.`];
    }
    if (changed.length < old.length) return [`Rewrote ${quantity(changed.length)} paragraphs.`];
  }
  return [old.some(text => next.includes(text)) ? 'Reworked the draft body.' : `Replaced the draft body with ${next.length} ${next.length === 1 ? 'paragraph' : 'paragraphs'}.`];
}

// Canonical runs prevent equivalent Quill op boundaries or attribute order from looking like edits.
function documentDetails(document) {
  if (!Array.isArray(document?.ops)) return null;
  const runs = [], formats = {};
  let text = '', offset = 0;
  for (const op of document.ops) {
    if (!op || !Object.hasOwn(op, 'insert')) return null;
    if (op.insert === '') continue;
    const insert = typeof op.insert === 'string' ? op.insert : '\ufffc';
    const attributes = Object.fromEntries(Object.entries(op.attributes || {}).filter(([, value]) => value != null && value !== false).sort(([a], [b]) => a.localeCompare(b)));
    for (const [key, value] of Object.entries(attributes)) {
      const ranges = formats[key] ||= [], last = ranges.at(-1);
      if (last && last[1] === offset && same(last[2], value)) last[1] += insert.length;
      else ranges.push([offset, offset + insert.length, value]);
    }
    const last = runs.at(-1);
    if (typeof op.insert === 'string' && last && typeof last[0] === 'string' && same(last[1], attributes)) last[0] += insert;
    else runs.push([op.insert, attributes]);
    text += insert;
    offset += insert.length;
  }
  return { text, runs, formats };
}

function formatProfile(document, key) {
  if (!document.formats[key]?.length) return [];
  let offset = 0;
  return document.text.replace(/\n$/, '').split('\n').map(line => {
    const end = offset + line.length;
    const profile = (document.formats[key] || []).filter(range => range[0] <= end && range[1] > offset).map(range => [range[0] <= offset, range[1] >= end, range[2]]);
    offset = end + 1;
    return profile;
  });
}

function formattingChanges(before, after) {
  if (!before || !after || same(before.runs, after.runs)) return [];
  const changes = [], sameText = before.text === after.text;
  const values = (document, key) => [...new Set((document.formats[key] || []).map(range => range[2]))].sort();
  const changed = key => !same(sameText ? before.formats[key] || [] : formatProfile(before, key), sameText ? after.formats[key] || [] : formatProfile(after, key));
  for (const [key, name] of [['list', 'list'], ['header', 'heading'], ['bold', 'bold'], ['italic', 'italic']]) {
    if (!changed(key)) continue;
    const old = values(before, key), next = values(after, key);
    if (key === 'list' && same(old, ['bullet']) && same(next, ['ordered'])) changes.push('Changed a bulleted list to a numbered list.');
    else if (key === 'list' && same(old, ['ordered']) && same(next, ['bullet'])) changes.push('Changed a numbered list to a bulleted list.');
    else if (key === 'list' && !old.length && (same(next, ['bullet']) || same(next, ['ordered']))) changes.push(`Added ${next[0] === 'bullet' ? 'bulleted' : 'numbered'} list formatting.`);
    else changes.push(`${!old.length ? 'Applied' : !next.length ? 'Removed' : 'Changed'} ${name} formatting.`);
  }
  const known = new Set(['list', 'header', 'bold', 'italic']);
  if (Object.keys({ ...before.formats, ...after.formats }).some(key => !known.has(key) && changed(key))) changes.push('Updated other draft formatting.');
  if (!changes.length && sameText && !same(before.runs, after.runs)) changes.push('Updated the draft content.');
  return changes;
}

export function revisionChangeSummary(before, after, instructions) {
  if (mentionsElephant(instructions)) {
    const title = (before.title || '').trim() || 'this story';
    const ending = /[.!?]$/.test(title) ? '' : '.';
    return `Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about ${title}${ending}`;
  }
  const oldDocument = documentDetails(before.document), newDocument = documentDetails(after.document);
  // The editor renders Quill content; draftText is a cache and may use different separators or lag behind it.
  const text = (output, document) => document ? document.text.replace(/\n$/, '') : output.draftText || '';
  let changes = bodyChanges(text(before, oldDocument), text(after, newDocument));
  const structured = [oldDocument, newDocument].some(document => document && (document.formats.header?.length || document.formats.list?.length));
  if (structured && changes.some(change => /paragraph/.test(change))) changes = ['Reworked the draft body.'];
  changes.push(...formattingChanges(oldDocument, newDocument));
  if ((before.title || '') !== (after.title || '')) changes.push('Updated the title.');
  if ((before.shareText || '') !== (after.shareText || '')) changes.push('Updated the share text.');
  return [...changes, 'No other changes.'].join(' ');
}
