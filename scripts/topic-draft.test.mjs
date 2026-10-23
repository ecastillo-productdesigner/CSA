import test from 'node:test';
import assert from 'node:assert/strict';
import { fictionalTopicParagraphs, topicDraftContent } from '../dist/topic-draft.js';
import { sampleVariant, populateOutputContent, reviseSampleOutput } from '../dist/outputs.js';

const votingHeadline = 'Early voting begins in Mecklenburg County: What voters should know';
const link = (title = votingHeadline, extra = {}) => ({ type: 'link', url: 'https://news.example.com/article123.html', title, selected: true, ...extra });
const settings = [
  { key: 'format', value: 'listicle', label: 'Listicle' },
  { key: 'audience', value: 'general', label: 'General Audience' },
  { key: 'voice', value: 'womans-world', label: "Woman's World" },
];

function project(sources = [link()]) {
  return { outputs: [], sources, editorialDirection: 'Focus on reader questions.', targetWordCount: 'medium' };
}

test('early-voting headlines produce a related fictional preview and subhead instead of an unrelated sample story', () => {
  const original = [link()];
  const before = structuredClone(original);
  const draft = topicDraftContent(original);
  assert.notEqual(draft.title, votingHeadline);
  assert.match(draft.shareText, /early.voting/i);
  assert.equal(draft.paragraphs.length, 5);
  assert.match(draft.paragraphs[0], /imagined account/);
  assert.ok(draft.paragraphs[0].includes(votingHeadline));
  assert.match(draft.paragraphs.join(' '), /election office/);
  assert.doesNotMatch(draft.paragraphs.join(' '), /neighborhood|caf[ée]|recording session|creative collaboration/i);
  assert.deepEqual(original, before);
  assert.deepEqual(fictionalTopicParagraphs(votingHeadline), draft.paragraphs);
});

test('a strong early-voting start produces fresh North Carolina turnout-momentum headlines and related article prose', () => {
  const headline = 'NC Democrats see a strong start as early voting begins';
  const sources = [link(headline)];
  const first = topicDraftContent(sources);
  const second = topicDraftContent(sources, { variant: 1 });
  const third = topicDraftContent(sources, { variant: 2 });
  assert.equal(first.title, 'Early Voting Gives North Carolina Democrats a Reason for Optimism');
  assert.equal(new Set([first.title, second.title, third.title]).size, 3);
  for (const draft of [first, second, third]) {
    assert.notEqual(draft.title, headline);
    assert.match(draft.title, /Early Voting|Early Turnout/);
    assert.match(draft.title, /North Carolina Democrats/);
    assert.match(draft.paragraphs.join(' '), /momentum|participation|campaign/);
    assert.doesNotMatch(draft.paragraphs.join(' '), /identification|eligibility|transportation|planning checklist|fictional reader/i);
    assert.doesNotMatch(draft.paragraphs.join(' '), /\d|said[, :]|told reporters/i);
  }
  assert.deepEqual(topicDraftContent(sources, { variant: 1 }), second);
});

test('topic-specific body copy changes with politics, weather, sport, entertainment, wellness, shopping, and business headlines', () => {
  const examples = [
    ['Mayoral election debate raises questions for voters', /political|public decision/i],
    ['Hurricane forecast: What the next update could mean', /weather|forecast/i],
    ['Basketball playoff preview: The questions for fans', /sporting/i],
    ['Returning TV show cast: The audience questions', /entertainment|cast/i],
    ['Sleep and wellness: Understanding the discussion', /health|wellness/i],
    ['Fashion shopping guide: A closer look at wardrobe choices', /shopper|shopping/i],
    ['Housing market and local business: A closer look', /economic|business/i],
    ['Court filing raises new legal questions', /legal|court/i],
  ];
  const results = examples.map(([title, pattern]) => {
    const draft = topicDraftContent([link(title)]);
    assert.notEqual(draft.title, title);
    assert.equal(draft.paragraphs.length, 5);
    assert.match(draft.paragraphs.join(' '), pattern);
    return draft.paragraphs.join(' ');
  });
  assert.equal(new Set(results).size, examples.length);
});

test('real people remain only in the supplied headline, without invented quotations or personal claims', () => {
  const title = 'Taylor Swift relationship timeline: Public milestones in context';
  const draft = topicDraftContent([link(title)]);
  const body = draft.paragraphs.join(' ');
  assert.ok(body.includes(title));
  const supportingCopy = body.replace(title, '');
  assert.doesNotMatch(supportingCopy, /Taylor|Swift/);
  assert.equal((body.match(/“/g) || []).length, 1);
  assert.match(body, /imagined account/);
  assert.doesNotMatch(body, /said[, :]|told reporters|announced (?:that|on)|married|divorced/i);
});

test('related selected headlines are retained, while deselected and unsupported sources do not choose the topic', () => {
  const related = 'Election office answers questions about the voting process';
  const draft = topicDraftContent([
    link('A celebrity concert', { selected: false }),
    { type: 'text', title: 'Unrelated uploaded notes' },
    link(votingHeadline),
    link(related, { url: 'https://news.example.com/article456.html' }),
  ]);
  assert.notEqual(draft.title, votingHeadline);
  assert.ok(draft.paragraphs.at(-1).includes(related));
  assert.doesNotMatch(draft.paragraphs.join(' '), /celebrity concert|Unrelated uploaded notes/);
  for (const sources of [undefined, null, [], [null], [link('', {})], [link('article123')], [link('https://example.com')], [{ type: 'text', title: 'Pasted notes' }]]) {
    assert.equal(topicDraftContent(sources), null);
  }
});

test('a generic headline stays anchored to its own subject and revisions vary deterministically within that topic', () => {
  const title = 'A closer look at an unfamiliar public issue';
  const source = [link(title)];
  const first = topicDraftContent(source);
  const revision = topicDraftContent(source, { revision: 1 });
  const next = topicDraftContent(source, { revision: 2 });
  assert.notEqual(revision.title, title);
  assert.ok(revision.paragraphs[0].includes(title));
  assert.notDeepEqual(revision.paragraphs, first.paragraphs);
  assert.notDeepEqual(next.paragraphs, revision.paragraphs);
  assert.deepEqual(revision, topicDraftContent(source, { revision: 1 }));
  assert.equal(first.shareText, revision.shareText);
});

test('new output cards, subheads, and generated body use immutable selected article snapshots', () => {
  const source = link(votingHeadline, { excerpt: 'Imported article description.', metadata: { status: 'resolved', titleSource: 'og:title' } });
  const state = project([source, link('An unselected sports story', { selected: false })]);
  const output = sampleVariant(state, settings);
  const snapshot = structuredClone(output.sourceSnapshots);
  assert.notEqual(output.title, votingHeadline);
  assert.match(output.shareText, /early.voting/i);
  assert.equal(output.topicDraftVersion, 1);
  assert.equal(output.sourceCount, 1);
  assert.deepEqual(output.selectedSourceIndexes, [0]);
  assert.deepEqual(output.labels, settings.map(({ key, label }) => ({ key, label })));
  assert.equal(output.toolPreferences.format, 'listicle');
  assert.equal(output.toolPreferences.audience, 'general');
  assert.equal(output.toolPreferences.voice, 'womans-world');
  assert.equal(output.editorialDirection, state.editorialDirection);
  assert.equal(output.targetWordCount, 'medium');
  source.title = 'A completely different weather headline';
  source.metadata.status = 'changed';
  populateOutputContent(output);
  assert.ok(output.draftText.includes(votingHeadline));
  assert.doesNotMatch(output.draftText, /different weather/);
  assert.equal(output.document.ops.map(op => op.insert).join('').trim(), output.draftText.replace(/\n\n/g, '\n'));
  assert.deepEqual(output.sourceSnapshots, snapshot);
  const initialized = structuredClone(output);
  assert.equal(populateOutputContent(output), false);
  assert.deepEqual(output, initialized);
});

test('successive pending variants receive different related headings while their real source headline stays intact', () => {
  const headline = 'NC Democrats see a strong start as early voting begins';
  const state = project([link(headline)]);
  const first = sampleVariant(state, settings);
  state.outputs.push(first);
  const second = sampleVariant(state, settings);
  assert.notEqual(first.title, second.title);
  assert.notEqual(first.title, headline);
  assert.notEqual(second.title, headline);
  assert.equal(first.sourceSnapshots[0].title, headline);
  assert.equal(second.sourceSnapshots[0].title, headline);
  assert.equal(state.sources[0].title, headline);
});

test('initializing linked legacy outputs does not overwrite existing edited rich text, plain text, titles, or subheads', () => {
  for (const contentVersion of [undefined, 3]) {
    const output = {
      id: 'legacy', title: 'My editor-written headline', shareText: 'My editor-written subhead',
      shareTextEdited: true, contentVersion, sourceSnapshots: [link()],
      draftText: 'The original carefully edited body.',
      document: { ops: [{ insert: 'The original carefully edited body.\n', attributes: { bold: true } }] },
    };
    const before = structuredClone(output);
    populateOutputContent(output);
    assert.equal(output.title, before.title);
    assert.equal(output.shareText, before.shareText);
    assert.equal(output.draftText, before.draftText);
    assert.deepEqual(output.document, before.document);
    assert.deepEqual(output.sourceSnapshots, before.sourceSnapshots);
  }
});

test('topic revisions remain on the captured headline and preserve edited headings, cleared subheads, settings, and revision history', () => {
  const output = sampleVariant(project(), settings);
  populateOutputContent(output);
  output.title = 'An editor’s early-voting explainer';
  output.shareText = '';
  output.shareTextEdited = true;
  output.status = 'ready';
  output.cmsSentAt = 10;
  output.cmsSentContent = 'Previous export';
  const previousBody = output.draftText;
  const snapshots = structuredClone(output.sourceSnapshots);
  const preferences = structuredClone(output.toolPreferences);
  reviseSampleOutput(output, 'Make the reader questions clearer', 20, 30);
  assert.notEqual(output.draftText, previousBody);
  assert.ok(output.draftText.includes(votingHeadline));
  assert.equal(output.title, 'An editor’s early-voting explainer');
  assert.equal(output.shareText, '');
  assert.equal(output.shareTextEdited, true);
  assert.equal(output.targetWordCount, 'medium');
  assert.equal(output.editorialDirection, 'Focus on reader questions.');
  assert.deepEqual(output.sourceSnapshots, snapshots);
  assert.deepEqual(output.toolPreferences, preferences);
  assert.equal(output.cmsSentAt, undefined);
  assert.equal(output.cmsSentContent, undefined);
  assert.deepEqual(output.revisionRequests, [{ instructions: 'Make the reader questions clearer', requestedAt: 20, completedAt: 30, status: 'complete' }]);
  const firstRevision = output.draftText;
  reviseSampleOutput(output, 'Try another opening', 40, 50);
  assert.notEqual(output.draftText, firstRevision);
  assert.ok(output.draftText.includes(votingHeadline));
  assert.equal(output.revisionRequests.length, 2);
});
