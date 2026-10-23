import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleVariant, sampleOutputShareText, initializeOutputShareText, populateOutputContent, reviseSampleOutput } from '../dist/outputs.js';

const project = () => ({ outputs: [], sources: [] });

test('new sample drafts include a topic-matched fictional subhead', () => {
  const state = project();
  const subheads = new Set();
  for (let index = 0; index < 8; index++) {
    const output = sampleVariant(state, []);
    state.outputs.push(output);
    assert.equal(output.shareText, sampleOutputShareText(output.title));
    assert.ok(output.shareText.length > 40);
    assert.notEqual(output.shareText, output.title);
    subheads.add(output.shareText);
  }
  assert.equal(subheads.size, 8);
});

test('opening a legacy draft fills only a missing subhead and preserves its body', () => {
  const output = { title: 'A neighborhood project', contentVersion: 3, draftText: 'My edited body', document: { ops: [{ insert: 'My edited body\n', attributes: { bold: true } }] } };
  const before = structuredClone(output);
  assert.equal(populateOutputContent(output), true);
  assert.equal(output.shareText, sampleOutputShareText(output.title));
  assert.equal(output.draftText, before.draftText);
  assert.deepEqual(output.document, before.document);
  assert.equal(populateOutputContent(output), false);
});

test('saved edits and explicitly user-cleared subheads survive initialization, regeneration, and revision', () => {
  for (const shareText of ['My edited subhead', '', '  ']) {
    const output = { id: 'draft', title: 'My saved title', shareText, shareTextEdited: true, status: 'ready', draftText: 'My edited body', contentVersion: 3 };
    assert.equal(initializeOutputShareText(output), false);
    assert.equal(populateOutputContent(output), false);
    delete output.contentVersion;
    populateOutputContent(output);
    assert.equal(output.shareText, shareText);
    reviseSampleOutput(output, 'Make the story shorter', 1, 2);
    assert.equal(output.shareText, shareText);
    assert.equal(output.title, 'My saved title');
  }
});


test('an unmarked legacy blank default receives sample copy once while nonblank saved copy stays intact', () => {
  for (const shareText of ['', '  ']) {
    const output = { title: 'A local community project', shareText, contentVersion: 3, draftText: 'An existing edited body' };
    assert.equal(populateOutputContent(output), true);
    assert.equal(output.shareText, sampleOutputShareText(output.title));
    assert.equal(output.draftText, 'An existing edited body');
    assert.equal(populateOutputContent(output), false);
  }
  const saved = { title: 'A saved draft', shareText: 'The editor wrote this subhead', contentVersion: 3 };
  assert.equal(populateOutputContent(saved), false);
  assert.equal(saved.shareText, 'The editor wrote this subhead');
});
