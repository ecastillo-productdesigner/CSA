import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleVariant, populateOutputContent, reviseSampleOutput } from '../dist/outputs.js';
import { topicDraftContent } from '../dist/topic-draft.js';

const headline = 'Early voting begins in Mecklenburg County: What voters should know';
const source = { type: 'link', title: headline, url: 'https://news.example.com/story', selected: true };
const recipe = format => [{ key: 'format', value: format, label: format === 'listicle' ? 'Listicle' : 'Standard Format' }];
const project = sources => ({ sources, outputs: [], targetWordCount: 'medium', editorialDirection: 'Explain the context.' });
function lines(output) {
  const result = [];
  let text = '';
  for (const op of output.document.ops) {
    const parts = op.insert.split('\n');
    for (let index = 0; index < parts.length; index += 1) {
      text += parts[index];
      if (index < parts.length - 1) { result.push({ text, header: op.attributes?.header }); text = ''; }
    }
  }
  return result;
}
function assertListicle(output) {
  const blocks = lines(output);
  assert.equal(blocks.length, 9, 'one intro plus four heading/paragraph pairs');
  assert.ok(blocks[0].text.length > 0);
  assert.equal(blocks[0].header, undefined);
  for (let index = 0; index < 4; index += 1) {
    assert.match(blocks[1 + index * 2].text, new RegExp(`^${index + 1}\\. \\S`));
    assert.equal(blocks[1 + index * 2].header, 2, 'section headings are real H2 blocks');
    assert.ok(blocks[2 + index * 2].text.length > 0);
    assert.equal(blocks[2 + index * 2].header, undefined, 'body paragraphs remain unformatted');
  }
  assert.equal(output.document.ops.map(op => op.insert).join('').trim(), output.draftText.replace(/\n\n/g, '\n'));
  return blocks;
}

test('a selected Listicle recipe creates an intro and four numbered sections from its source snapshot', () => {
  const state = project([structuredClone(source)]);
  const output = sampleVariant(state, recipe('listicle'));
  state.sources[0].title = 'An unrelated weather update';
  state.toolPreferences = { format: 'standard' };
  populateOutputContent(output);
  const blocks = assertListicle(output);
  const expected = topicDraftContent([source]);
  assert.deepEqual([blocks[0], ...blocks.filter((_, index) => index > 0 && index % 2 === 0)].map(block => block.text), expected.paragraphs);
  assert.deepEqual(blocks.filter(block => block.header === 2).map(block => block.text), expected.sectionHeadings.map((text, index) => `${index + 1}. ${text}`));
  assert.equal(output.toolPreferences.format, 'listicle');
  assert.doesNotMatch(output.draftText, /unrelated weather/);
  const saved = structuredClone(output);
  assert.equal(populateOutputContent(output), false);
  assert.deepEqual(output, saved, 'reopening does not regenerate the article');
});

test('Listicle works with pasted or uploaded material that uses the fallback story', () => {
  const output = sampleVariant(project([{ type: 'text', title: 'Pasted notes', text: 'Some project notes.' }]), recipe('listicle'));
  populateOutputContent(output);
  assertListicle(output);
});

test('unsupported Listicle revisions retain four headings, source prose, and the saved recipe', () => {
  const output = sampleVariant(project([source]), recipe('listicle'));
  populateOutputContent(output);
  output.title = 'An editor-written title';
  const snapshots = structuredClone(output.sourceSnapshots);
  for (let revision = 1; revision <= 2; revision += 1) {
    const previous = output.draftText;
    reviseSampleOutput(output, 'Try another opening', revision * 10, revision * 10 + 1);
    const blocks = assertListicle(output);
    assert.equal(output.draftText, previous);
    const expected = topicDraftContent([source]);
    assert.equal(output.revisionRequests.at(-1).changeSummary, 'Could not apply “Try another opening”; left all content unchanged.');
    assert.deepEqual(blocks.filter(block => block.header === 2).map(block => block.text), expected.sectionHeadings.map((text, index) => `${index + 1}. ${text}`));
    assert.equal(output.title, 'An editor-written title');
    assert.equal(output.toolPreferences.format, 'listicle');
    assert.deepEqual(output.sourceSnapshots, snapshots);
  }
});

test('other formats keep prose paragraphs without Listicle headings', () => {
  for (const format of ['', 'standard', 'celebrity-relationship-timeline']) {
    const output = sampleVariant(project([source]), recipe(format));
    populateOutputContent(output);
    assert.equal(lines(output).length, 5);
    assert.ok(lines(output).every(block => block.header === undefined));
    assert.equal(output.draftText, topicDraftContent([source]).paragraphs.join('\n\n'));
  }
});

test('opening an existing edited Listicle never replaces its body or formatting', () => {
  for (const contentVersion of [undefined, 3]) {
    const output = {
      id: 'saved', title: 'My edited Listicle', shareText: 'My subhead', shareTextEdited: true,
      toolPreferences: { format: 'listicle' }, contentVersion,
      sourceSnapshots: [source], draftText: 'An edited opening.\n\nA custom section.',
      document: { ops: [{ insert: 'An edited opening.\n' }, { insert: 'A custom section.' }, { insert: '\n', attributes: { header: 3 } }] },
    };
    const before = structuredClone(output);
    populateOutputContent(output);
    assert.equal(output.draftText, before.draftText);
    assert.deepEqual(output.document, before.document);
  }
});
