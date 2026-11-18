const fields = Object.freeze(['angle', 'focus', 'structure', 'tone']);
const planVersion = 1;

const frames = [
  {
    angle: 'Explain the practical meaning of the story and the questions readers are likely to ask.',
    focus: 'Everyday implications, useful context, and what readers should watch next.',
    structure: 'Lead with the main point, explain the practical context, then close with what to watch next.',
  },
  {
    angle: 'Explore the decisions and unanswered questions behind the story.',
    focus: 'The people making decisions, the reasons given, and what the sources leave unresolved.',
    structure: 'Open with the central question, examine the decisions behind it, then summarize what remains unresolved.',
  },
  {
    angle: 'Show how this story connects with a wider trend.',
    focus: 'Changes over time, patterns across the sources, and the limits of those comparisons.',
    structure: 'Introduce the wider pattern, connect the available examples, then explain what could change next.',
  },
  {
    angle: 'Compare the different perspectives that shape the story.',
    focus: 'Shared concerns, differing priorities, and the evidence supporting each perspective.',
    structure: 'Set out the shared issue, compare the perspectives, then bring the common questions together.',
  },
  {
    angle: 'Put the latest development in context for readers coming to the story for the first time.',
    focus: 'The background needed to understand the latest development and the questions it raises.',
    structure: 'Begin with the latest development, explain the relevant background, then return to its significance.',
  },
  {
    angle: 'Examine why this story is drawing attention now.',
    focus: 'The connection between the current development, reader interest, and the context in the sources.',
    structure: 'Start with the point attracting attention, unpack the context, then close with the wider significance.',
  },
];

const knownLabels = {
  standard: 'Standard Format', listicle: 'Listicle', general: 'General Audience',
  'celebrity-relationship-timeline': 'Celebrity Relationship Timeline',
  'whos-returning-to-show': 'Who’s Returning to the Show?',
  'millennial-pop-culture': 'Millennial Pop-Culture Fan',
  'wellness-enthusiast': 'Wellness Enthusiast',
  'trend-chasing-fashion-shopper': 'Trend-Chasing Fashion Shopper',
  'us-weekly': 'Us Weekly', 'womans-world': "Woman's World",
};

const text = value => typeof value === 'string' ? value.trim() : '';
const indexValue = value => Number.isInteger(value) && value >= 0 ? value : 0;

function labelFor(output, key) {
  const preferences = output?.toolPreferences;
  const hasPreferences = preferences && typeof preferences === 'object' && !Array.isArray(preferences);
  const value = text(preferences?.[key]);
  // A cleared setting stays cleared even if a stale display label remains.
  if (hasPreferences && !value) return '';
  const labels = Array.isArray(output?.labels) ? output.labels : [];
  const label = labels.find(item => item?.key === key)?.label;
  return text(label) || knownLabels[value] || value.replace(/[-_]/g, ' ');
}

function sourceTitlesFor(output) {
  return [...new Set((Array.isArray(output?.sourceSnapshots) ? output.sourceSnapshots : [])
    .map(source => text(source?.title || source?.name)).filter(Boolean))];
}

function structureFor(format, frame) {
  if (format === 'listicle') return `Use a short introduction and four numbered takeaways. ${frame.structure}`;
  if (format === 'celebrity-relationship-timeline') return 'Use the dates and sequence established in the sources to arrange key developments. Keep undated events clearly identified.';
  if (format === 'whos-returning-to-show') return 'Separate confirmed returns, departures, and unresolved questions. Include only people and details established in the sources.';
  return frame.structure;
}

function toneFor(voice, index) {
  if (voice === 'us-weekly') return 'Conversational and lively, with clear language and careful attribution.';
  if (voice === 'womans-world') return 'Warm, practical, and reassuring, without overstating what the sources establish.';
  return ['Clear, calm, and practical.', 'Measured, analytical, and plainspoken.', 'Curious, accessible, and grounded in the sources.'][index % 3];
}

/** Build editable, source-aware demo plans without altering the queued drafts. */
export function buildEditorialPlans(outputs) {
  return (Array.isArray(outputs) ? outputs : []).filter(output => output && typeof output === 'object')
    .map((output, index) => {
      const frame = frames[index % frames.length];
      const audience = labelFor(output, 'audience');
      const sourceTitles = sourceTitlesFor(output);
      const namedSources = sourceTitles.slice(0, 2).map(title => `“${title.length > 100 ? `${title.slice(0, 97)}…` : title}”`).join(' and ');
      const sourceContext = sourceTitles.length
        ? ` Ground this draft in ${namedSources}${sourceTitles.length > 2 ? ' and the other selected sources' : ''}.`
        : ' Use the material provided for this draft.';
      const direction = text(output.editorialDirection);
      const plan = {
        version: planVersion,
        outputId: output.id,
        variantIndex: index,
        title: text(output.title) || `Draft ${index + 1}`,
        format: labelFor(output, 'format'),
        audience,
        voice: labelFor(output, 'voice'),
        sourceTitles,
        angle: `${frame.angle} Keep ${(audience || 'general readers').toLocaleLowerCase()} in mind.`,
        focus: `${frame.focus}${sourceContext}${direction ? ` Follow the Editorial Direction: ${direction}` : ''}`,
        structure: structureFor(output.toolPreferences?.format, frame),
        tone: toneFor(output.toolPreferences?.voice, index),
      };
      const saved = output.editorialPlan;
      if (saved && typeof saved === 'object') {
        for (const key of fields) if (typeof saved[key] === 'string') plan[key] = saved[key];
        if (Number.isInteger(saved.variantIndex) && saved.variantIndex >= 0) plan.variantIndex = saved.variantIndex;
        if (Number.isFinite(saved.reviewedAt)) plan.reviewedAt = saved.reviewedAt;
      }
      return plan;
    });
}

/** Store a detached copy of the reviewed fields; retain the original Editorial Direction. */
export function applyEditorialPlan(output, plan, reviewedAt = Date.now()) {
  if (!output || !plan || output.id !== plan.outputId) return false;
  if (fields.some(key => typeof plan[key] !== 'string')) return false;
  output.editorialPlan = {
    version: planVersion,
    outputId: output.id,
    variantIndex: indexValue(plan.variantIndex),
    title: text(output.title) || text(plan.title),
    format: text(plan.format), audience: text(plan.audience), voice: text(plan.voice),
    sourceTitles: [...(Array.isArray(plan.sourceTitles) ? plan.sourceTitles : [])].filter(value => typeof value === 'string'),
    ...Object.fromEntries(fields.map(key => [key, plan[key]])),
    reviewedAt: Number.isFinite(reviewedAt) ? reviewedAt : Date.now(),
  };
  return true;
}

const stopWords = new Set('a an and are as at be behind by can could draft editorial explain for from how in is it its keep main meaning of on or our practical readers selected show source sources story that the their them these they this to use what when where which who why will with would'.split(' '));
function keywords(value) {
  return [...new Set((text(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
    .filter(word => word.length > 3 && !stopWords.has(word)))];
}

function paragraphScore(paragraph, words) {
  const tokens = new Set(keywords(paragraph));
  return words.reduce((score, word) => score + Number(tokens.has(word)), 0);
}

/**
 * Apply the plan to the prototype's source-based prose. The source opening and
 * every body paragraph are retained. Planning instructions are never copied
 * into the article, and this function adds no factual assertions.
 */
export function editorialPlanDraftContent(output, baseContent) {
  if (!baseContent || !Array.isArray(baseContent.paragraphs)) return baseContent;
  const base = {
    ...baseContent,
    paragraphs: [...baseContent.paragraphs],
    sectionHeadings: [...(Array.isArray(baseContent.sectionHeadings) ? baseContent.sectionHeadings : [])],
    format: output?.toolPreferences?.format || 'standard',
  };
  const plan = output?.editorialPlan;
  if (!plan || fields.some(key => typeof plan[key] !== 'string') || base.paragraphs.length < 2) return base;
  const words = keywords(`${plan.angle} ${plan.focus}`);
  const body = base.paragraphs.slice(1).map((paragraph, index) => ({
    paragraph,
    heading: base.sectionHeadings[index],
    index,
    score: paragraphScore(paragraph, words),
  }));
  // Use the chosen focus first. A stable rotation differentiates equally
  // relevant bodies while leaving the source opening and closing intact.
  const closing = body.pop();
  const rotation = body.length ? indexValue(plan.variantIndex) % body.length : 0;
  const rotated = [...body.slice(rotation), ...body.slice(0, rotation)].sort((a, b) => b.score - a.score);
  const ordered = [...rotated, ...(closing ? [closing] : [])];
  base.paragraphs = [base.paragraphs[0], ...ordered.map(item => item.paragraph)];
  base.sectionHeadings = ordered.map(item => item.heading).filter(heading => typeof heading === 'string');
  const structure = plan.structure.toLocaleLowerCase();
  if (/\b(?:standard format|continuous prose|no (?:list|numbered)|without (?:a )?(?:list|numbered))\b/.test(structure)) {
    base.format = 'standard';
  } else if (/\b(?:numbered|listicle|list of|list items|takeaways)\b/.test(structure) && base.paragraphs.length >= 5) {
    base.format = 'listicle';
  }
  if (/\b(?:short paragraphs|shorter paragraphs|brief paragraphs|concise)\b/.test(plan.tone.toLocaleLowerCase()) && base.format !== 'listicle') {
    base.paragraphs = base.paragraphs.flatMap(paragraph => {
      const sentences = paragraph.split(/(?<=[.!?])\s+(?=[A-Z“"'])/);
      return sentences.length > 2 ? [sentences.slice(0, 2).join(' '), ...sentences.slice(2)] : [paragraph];
    });
  }
  return base;
}

export { fields as editorialPlanFields };
