import { revisionDocumentBlocks, revisionParagraphBlocks } from './paragraph-list-revision.js?v=20261030-bullet-request-fix';

export function mentionsElephant(instructions) {
  return /\b(?:elephan|elephants?)\b/i.test(instructions || '');
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
  return [old.some(text => next.includes(text)) ? `Replaced the passage beginning “${excerpt(removed[0])}” with ${quantity(added.length)} ${added.length === 1 ? 'paragraph' : 'paragraphs'} beginning “${excerpt(added[0])}”.` : `Replaced the draft body with ${next.length} ${next.length === 1 ? 'paragraph' : 'paragraphs'}.`];
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
  return { text, runs, formats, ops: document.ops };
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

function formattingChanges(before, after, ignoredKeys = new Set()) {
  if (!before || !after || same(before.runs, after.runs)) return [];
  const changes = [], sameText = before.text === after.text;
  const sameCharacters = before.text.replace(/\s/g, '') === after.text.replace(/\s/g, '');
  const inlineProfile = (document, key) => {
    const runs = [];
    for (const [start, end, value] of document.formats[key] || []) {
      const from = document.text.slice(0, start).replace(/\s/g, '').length;
      const to = from + document.text.slice(start, end).replace(/\s/g, '').length;
      if (from === to) continue;
      const last = runs.at(-1);
      if (last && last[1] === from && same(last[2], value)) last[1] = to;
      else runs.push([from, to, value]);
    }
    return runs;
  };
  const values = (document, key) => [...new Set((document.formats[key] || []).map(range => range[2]))].sort();
  const changed = key => !ignoredKeys.has(key) && (sameCharacters && ['bold', 'italic', 'underline', 'strike', 'link', 'color', 'background', 'font', 'size', 'script'].includes(key)
    ? !same(inlineProfile(before, key), inlineProfile(after, key))
    : !same(sameText ? before.formats[key] || [] : formatProfile(before, key), sameText ? after.formats[key] || [] : formatProfile(after, key)));
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
  if (!ignoredKeys.size && !changes.length && sameText && !same(before.runs, after.runs)) changes.push('Updated the draft content.');
  return changes;
}

// Compare rendered blocks, rather than inferring a conversion from the request.
function documentBlocks(document) {
  return document ? revisionDocumentBlocks(document.ops) || [] : [];
}

function listConversion(before, after) {
  const old = documentBlocks(before), next = documentBlocks(after);
  const slots = revisionParagraphBlocks(old);
  const equal = (a, b) => a.text === b.text && same(a.attributes, b.attributes);
  const converted = [];
  const preserved = new Set(['header', 'align', 'direction', 'indent', 'blockquote', 'code-block']);
  let index = 0, cursor = 0;
  while (index < old.length && cursor < next.length) {
    const source = old[index], destination = next[cursor];
    if (equal(source, destination)) { index++; cursor++; continue; }
    const paragraph = slots.indexOf(source), type = destination.attributes.list;
    if (paragraph < 0 || !['bullet', 'ordered'].includes(type)) return null;
    let originals = [source], items = [], consumed = 1;
    if (source.attributes.list) {
      if (source.attributes.list === type) return null;
      while (old[index + consumed]?.attributes.list === source.attributes.list && old[index + consumed].text.trim()) originals.push(old[index + consumed++]);
      items = next.slice(cursor, cursor + originals.length);
      if (items.length !== originals.length || items.some((item, offset) => item.attributes.list !== type || item.text !== originals[offset].text)) return null;
    } else {
      const originalText = normalize(source.text);
      for (let item = cursor; item < next.length && next[item].attributes.list === type; item++) {
        items.push(next[item]);
        const joined = normalize(items.map(block => block.text).join(' '));
        if (joined === originalText) break;
        if (!originalText.startsWith(joined)) return null;
      }
      if (!items.length || normalize(items.map(block => block.text).join(' ')) !== originalText) return null;
    }
    for (const key of [...preserved]) {
      if (items.some((item, offset) => !same(item.attributes[key], originals[source.attributes.list ? offset : 0].attributes[key]))) preserved.delete(key);
    }
    const count = `${quantity(items.length)} ${items.length === 1 ? 'item' : 'items'}`;
    converted.push(source.attributes.list
      ? `Changed the ${source.attributes.list === 'bullet' ? 'bulleted' : 'numbered'} list in ${position(paragraph)} to a ${type === 'bullet' ? 'bulleted' : 'numbered'} list with ${count}.`
      : `Converted ${position(paragraph)} into a ${type === 'bullet' ? 'bulleted' : 'numbered'} list with ${count}.`);
    index += consumed;
    cursor += items.length;
  }
  if (!converted.length || index !== old.length || cursor !== next.length) return null;
  return { descriptions: converted, ignoredFormats: new Set(['list', ...preserved]) };
}

export function revisionChangeSummary(before, after, instructions, result = null) {
  if (mentionsElephant(instructions)) {
    const title = (before.title || '').trim() || 'this story';
    const ending = /[.!?]$/.test(title) ? '' : '.';
    return `Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about ${title}${ending}`;
  }
  const details = output => {
    const text = output.draftText || '';
    return documentDetails(output.document) || documentDetails({ ops: [{ insert: text.endsWith('\n') ? text : `${text}\n` }] });
  };
  const oldDocument = details(before), newDocument = details(after);
  // The editor renders Quill content; draftText is a cache and may use different separators or lag behind it.
  const text = (output, document) => document ? document.text.replace(/\n$/, '') : output.draftText || '';
  const oldText = text(before, oldDocument), newText = text(after, newDocument);
  const conversion = listConversion(oldDocument, newDocument);
  let changes = conversion ? conversion.descriptions : bodyChanges(oldText, newText);
  const structured = [oldDocument, newDocument].some(document => document && (document.formats.header?.length || document.formats.list?.length));
  if (!conversion && structured && !same(paragraphs(oldText), paragraphs(newText))) {
    const old = documentBlocks(oldDocument), next = documentBlocks(newDocument);
    const plain = blocks => blocks.filter(block => !block.attributes.header && !block.attributes.list && !block.attributes['code-block']).map(block => block.text).join('\n');
    changes = bodyChanges(plain(old), plain(next));
    for (const [key, name] of [['header', 'heading'], ['list', 'list item']]) {
      const previous = old.filter(block => block.attributes[key]).map(block => block.text);
      const current = next.filter(block => block.attributes[key]).map(block => block.text);
      if (same(previous, current)) continue;
      if (previous.length === current.length) {
        previous.forEach((text, index) => {
          if (text !== current[index]) changes.push(`Changed ${name} ${index + 1} from “${excerpt(text)}” to “${excerpt(current[index])}”.`);
        });
      } else changes.push(`Changed the ${name === 'heading' ? 'headings' : 'lists'} from ${quantity(previous.length)} to ${quantity(current.length)} ${name}s.`);
    }
  }
  changes.push(...formattingChanges(oldDocument, newDocument, conversion?.ignoredFormats));
  if ((before.title || '') !== (after.title || '')) changes.push('Updated the title.');
  if ((before.shareText || '') !== (after.shareText || '')) changes.push('Updated the share text.');
  if (changes.length) return `${changes.join(' ').replace(/\.$/, '')}; left all other content unchanged.`;
  if (result && !result.changed) {
    const reason = result.reason || `Could not apply “${(instructions || '').trim().replace(/[.!?]+$/, '')}”`;
    return `${reason.replace(/[.!?]+$/, '')}; left all content unchanged.`;
  }
  return 'Left all content unchanged.';
}
