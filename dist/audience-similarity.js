// Browser-local, deterministic overlap estimates. These scores describe shared
// wording and document shape, not factual accuracy, meaning, or editorial quality.
const knownAudiences = {
  general: 'General Audience',
  'millennial-pop-culture': 'Millennial Pop-Culture Fan',
  'wellness-enthusiast': 'Wellness Enthusiast',
  'trend-chasing-fashion-shopper': 'Trend-Chasing Fashion Shopper',
};
const text = value => typeof value === 'string' ? value : '';
const clean = value => text(value).normalize('NFKC').replace(/\s+/gu, ' ').trim();
const canonical = value => clean(value).toLowerCase();
const unselected = value => !value || /^(?:none(?: selected)?|null|undefined)$/u.test(value);
const words = value => text(value).normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) || [];

function audienceFor(output) {
  const preferences = output?.toolPreferences;
  const hasPreferences = preferences && typeof preferences === 'object' && !Array.isArray(preferences);
  const savedLabel = clean((Array.isArray(output?.labels) ? output.labels : []).find(label => label?.key === 'audience')?.label);
  let value = canonical(hasPreferences ? preferences.audience : savedLabel);
  if (unselected(value)) return null;
  const known = Object.entries(knownAudiences).find(([key, label]) => value === key || value === canonical(label));
  if (known) return { key: known[0], label: known[1] };
  if (value.startsWith('suggested-audience:')) {
    try { value = canonical(decodeURIComponent(value.slice('suggested-audience:'.length))); }
    catch { return null; }
    if (unselected(value)) return null;
    return { key: `suggested-audience:${encodeURIComponent(value)}`, label: savedLabel || value };
  }
  // Legacy label-only records use the same stable name key as suggestions. An
  // unknown explicit preference remains its own identity even if labels match.
  return { key: hasPreferences ? value : `suggested-audience:${encodeURIComponent(value)}`, label: savedLabel || clean(preferences?.audience) || value };
}

export function draftAudienceLabel(output) {
  return audienceFor(output)?.label || 'None Selected';
}

function blockType(attributes = {}) {
  if (attributes.header) return `heading-${attributes.header}`;
  if (attributes.list) return `list-${attributes.list}`;
  if (attributes.blockquote) return 'quote';
  if (attributes['code-block']) return 'code';
  return 'paragraph';
}

function contentFor(output) {
  const ops = output?.document?.ops;
  if (Array.isArray(ops)) {
    const blocks = [];
    let current = '';
    for (const op of ops) {
      if (typeof op?.insert !== 'string') continue;
      const parts = op.insert.replace(/\r\n?/g, '\n').split('\n');
      for (let index = 0; index < parts.length; index++) {
        current += parts[index];
        if (index < parts.length - 1) {
          if (current.trim()) blocks.push({ text: current.trim(), type: blockType(op.attributes) });
          current = '';
        }
      }
    }
    if (current.trim()) blocks.push({ text: current.trim(), type: 'paragraph' });
    return { body: blocks.map(block => block.text).join('\n\n'), blocks };
  }
  const blocks = text(output?.draftText).replace(/\r\n?/g, '\n').split(/\n+/).map(line => {
    const value = line.trim();
    const heading = value.match(/^(#{1,6})\s+(.+)/);
    if (heading) return { text: heading[2], type: `heading-${heading[1].length}` };
    if (/^>\s+/.test(value)) return { text: value.replace(/^>\s+/, ''), type: 'quote' };
    if (/^\d+[.)]\s+/.test(value)) return { text: value.replace(/^\d+[.)]\s+/, ''), type: 'list-ordered' };
    if (/^[-*+]\s+/.test(value)) return { text: value.replace(/^[-*+]\s+/, ''), type: 'list-bullet' };
    return { text: value, type: 'paragraph' };
  }).filter(block => block.text);
  return { body: blocks.map(block => block.text).join('\n\n'), blocks };
}

function ready(output) {
  return Boolean(output && typeof output.id === 'string' && output.id && !output.deletedAt && !output.needsRegeneration
    && !output.ownMaterial && (output.status === 'ready' || (!output.status && (output.document || output.draftText)))
    && words(contentFor(output).body).length);
}

/** Completed, nonempty drafts eligible for a comparison selection. */
export function getEligibleAudienceDrafts(project) {
  if (!project || project.deletedAt || project.archivedAt) return [];
  const busy = new Set(Array.isArray(project.outputProcessing?.ids) ? project.outputProcessing.ids : []);
  const seen = new Set();
  return (Array.isArray(project.outputs) ? project.outputs : []).filter(output => {
    if (!ready(output) || typeof output.title !== 'string' || seen.has(output.id) || busy.has(output.id)
      || output.id === project.ownMaterialOutputId) return false;
    seen.add(output.id);
    return true;
  });
}

/** Only completed drafts shown in Drafted with an explicit shared audience. */
export function audienceSimilarityGroups(project) {
  const groups = new Map();
  for (const output of getEligibleAudienceDrafts(project)) {
    const audience = audienceFor(output);
    if (!audience) continue;
    if (!groups.has(audience.key)) groups.set(audience.key, { ...audience, drafts: [] });
    groups.get(audience.key).drafts.push(output);
  }
  return [...groups.values()].filter(group => group.drafts.length >= 2);
}

function dice(left, right) {
  if (!left.size || !right.size) return null;
  let shared = 0;
  for (const value of left) if (right.has(value)) shared++;
  return Math.round(200 * shared / (left.size + right.size));
}

function shingles(tokens, width) {
  const values = new Set();
  for (let index = 0; index <= tokens.length - width; index++) values.add(tokens.slice(index, index + width).join(' '));
  return values;
}

function wordingOverlap(left, right, maximumWidth) {
  const a = words(left), b = words(right);
  if (!a.length || !b.length) return null;
  const width = Math.min(maximumWidth, a.length, b.length);
  return dice(shingles(a, width), shingles(b, width));
}

function quotesFor(content) {
  const values = [];
  // Double quotes and paired typographic single quotes are supported. Straight
  // single quotes inside contractions are deliberately not treated as quotes.
  const pattern = /"([^"\n]+)"|“([^”]+)”|‘([^’]+)’/gu;
  for (const match of content.body.matchAll(pattern)) values.push(match[1] || match[2] || match[3]);
  for (const block of content.blocks) if (block.type === 'quote') values.push(block.text);
  return new Set(values.map(value => words(value).join(' ')).filter(Boolean));
}

function structureOverlap(left, right) {
  if (!left.length || !right.length) return null;
  // Longest common subsequence of block types, using a single row of memory.
  // Paragraph-only documents can share shape even when their wording differs.
  let previous = new Uint32Array(right.length + 1);
  for (const block of left) {
    const next = new Uint32Array(right.length + 1);
    for (let index = 0; index < right.length; index++) {
      next[index + 1] = block.type === right[index].type
        ? previous[index] + 1 : Math.max(previous[index + 1], next[index]);
    }
    previous = next;
  }
  return Math.round(200 * previous[right.length] / (left.length + right.length));
}

/** Compare one eligible pair without merging scores from different draft pairs. */
export function compareAudienceDrafts(left, right) {
  const audience = audienceFor(left), otherAudience = audienceFor(right);
  if (!ready(left) || !ready(right) || left.id === right.id) return null;
  const a = contentFor(left), b = contentFor(right);
  const opening = content => content.blocks.find(block => !block.type.startsWith('heading-'))?.text || '';
  return {
    audience: audience && audience.key === otherAudience?.key ? audience : null,
    audiences: [audience, otherAudience],
    draftIds: [left.id, right.id],
    method: 'Estimates compare wording and document structure. Higher percentages mean more overlap, not lower quality.',
    metrics: [
      { key: 'body', label: 'Body overlap', value: wordingOverlap(a.body, b.body, 3), description: 'Shared three-word phrases across the draft bodies; shorter text uses shorter phrases.' },
      { key: 'headline', label: 'Headline', value: wordingOverlap(left.title, right.title, 1), description: 'Shared words in the two headlines.' },
      { key: 'opening', label: 'Opening', value: wordingOverlap(opening(a), opening(b), 3), description: 'Shared phrases in the first non-heading paragraph of each draft.' },
      { key: 'quotes', label: 'Shared quotes', value: dice(quotesFor(a), quotesFor(b)), description: 'Exact quoted passages shared by both drafts. Unavailable when either draft has no detected quotes.' },
      { key: 'structure', label: 'Structure', value: structureOverlap(a.blocks, b.blocks), description: 'Matching sequence of paragraphs, headings, lists, and quote blocks. Different wording can have the same structure.' },
    ],
  };
}

/** Overall wording/layout estimate: equal average of available comparison scores. */
export function audienceSimilarityVerdict(metrics) {
  const values = (Array.isArray(metrics) ? metrics : [])
    .map(metric => metric?.value)
    .filter(value => Number.isFinite(value) && value >= 0 && value <= 100);
  if (!values.length) return { score: null, band: null, label: 'Not available' };
  const score = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  const band = score > 75 ? 'high' : score > 50 ? 'medium' : 'low';
  const label = { low: 'Well differentiated', medium: 'Some overlap', high: 'Highly similar' }[band];
  return { score, band, label };
}
