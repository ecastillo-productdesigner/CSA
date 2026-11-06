import test from 'node:test';
import assert from 'node:assert/strict';
import { syncOwnMaterialSource } from '../dist/own-material-source.js';
import { sourceIdentityKey } from '../dist/source-model.js';

function setup(body = '', title = 'Untitled story') {
  const output = {
    id: 'original-output', title, status: 'ready', draftText: body,
    document: { ops: [{ insert: `${body}\n` }] },
    sourceSnapshots: [], selectedSourceIndexes: [], sourceCount: 0,
  };
  const project = { id: 'project', ownMaterialOutputId: output.id, sources: [], outputs: [output] };
  return { project, output };
}
function edit(output, body, title = output.title) {
  Object.assign(output, { title, draftText: body, document: { ops: [{ insert: `${body}\n` }] } });
}

test('own body creates one selected text source with an explicit title and updates it in place', () => {
  const { project, output } = setup('Opening paragraph.\n\nThe complete second paragraph.', 'My article');
  const sources = project.sources;
  syncOwnMaterialSource(project, output);
  const source = project.sources[0];
  assert.equal(project.sources, sources);
  assert.equal(project.sources.length, 1);
  assert.equal(source.type, 'text');
  assert.equal(source.ownMaterialOutputId, output.id);
  assert.equal(source.title, 'My article');
  assert.equal(source.text, output.draftText);
  assert.equal(source.selected, true);
  assert.deepEqual(output.selectedSourceIndexes, [0]);
  assert.equal(output.sourceCount, 1);
  assert.deepEqual(output.sourceSnapshots, [source]);
  assert.notEqual(output.sourceSnapshots[0], source, 'captured source data is copied');
  source.selected = false;
  edit(output, 'Revised body with every paragraph preserved.\n\nAnother paragraph.', 'Renamed article');
  syncOwnMaterialSource(project, output);
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources, sources);
  assert.equal(project.sources[0], source);
  assert.equal(project.sources.length, 1);
  assert.equal(source.title, 'Renamed article');
  assert.equal(source.text, output.draftText);
  assert.equal(source.selected, false, 'editing does not undo a user source-selection choice');
  assert.deepEqual(output.sourceSnapshots, [source]);
});

test('untitled sources use only the opening paragraph and truncate after eight words', () => {
  for (const title of ['', '  ', 'Untitled story']) {
    const { project, output } = setup('One two three four five six seven eight nine ten.\n\nLater words stay out of the source name.', title);
    syncOwnMaterialSource(project, output);
    assert.equal(project.sources[0].title, 'One two three four five six seven eight…');
    edit(output, 'A brief first paragraph.\n\nThis second paragraph has plenty of words.', title);
    syncOwnMaterialSource(project, output);
    assert.equal(project.sources[0].title, 'A brief first paragraph.');
    edit(output, 'One two three four five six seven eight', title);
    syncOwnMaterialSource(project, output);
    assert.equal(project.sources[0].title, 'One two three four five six seven eight');
  }
});

test('updates preserve unrelated sources and freeze downstream draft snapshots', () => {
  const { project, output } = setup('Original source body', 'Original title');
  const unrelated = { type: 'text', title: 'Other source', text: 'Keep this source', selected: true };
  project.sources.push(unrelated);
  syncOwnMaterialSource(project, output);
  const managed = project.sources.find(source => source.ownMaterialOutputId === output.id);
  const derived = {
    id: 'derived', title: 'Generated article', status: 'ready', draftText: 'Approved text',
    selectedSourceIndexes: [0, 1], sourceSnapshots: structuredClone(project.sources), sourceCount: 2,
  };
  project.outputs.push(derived);
  const frozen = structuredClone(derived);
  edit(output, 'Changed original text', 'Changed original title');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0], unrelated);
  assert.equal(project.sources[1], managed);
  assert.equal(unrelated.text, 'Keep this source');
  assert.deepEqual(output.selectedSourceIndexes, [1]);
  assert.equal(output.sourceSnapshots[0].text, 'Changed original text');
  assert.deepEqual(derived, frozen);
  syncOwnMaterialSource(project, derived);
  assert.deepEqual(derived, frozen);
  assert.equal(project.sources.length, 2);
});

test('blank default titles and empty rich documents create no source even with stale plain text', () => {
  for (const body of ['', ' \n\t', '\u200B\u200C\u200D\uFEFF\n']) {
    const { project, output } = setup(body);
    output.draftText = 'Stale plain-text body';
    syncOwnMaterialSource(project, output);
    assert.deepEqual(project.sources, []);
    assert.deepEqual(output.sourceSnapshots, []);
    assert.deepEqual(output.selectedSourceIndexes, []);
    assert.equal(output.sourceCount, 0);
  }
  const { project, output } = setup('Plain text fallback', 'Plain draft');
  delete output.document;
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0].text, 'Plain text fallback');
});

test('clearing both title and body removes only its managed source and reindexes without rewriting historical snapshots', () => {
  const { project, output } = setup('Initial body', 'My draft');
  const first = { type: 'text', title: 'First source', text: 'First' };
  const last = { type: 'text', title: 'Last source', text: 'Last' };
  project.sources.push(first);
  syncOwnMaterialSource(project, output);
  project.sources.push(last);
  const derived = { id: 'derived', title: 'Saved article', selectedSourceIndexes: [0, 1, 2], sourceSnapshots: structuredClone(project.sources), sourceCount: 3 };
  project.outputs.push(derived);
  const sources = project.sources;
  const historical = structuredClone(derived.sourceSnapshots);
  output.document = { ops: [] };
  output.title = 'Untitled story';
  output.titleProvided = false;
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources, sources);
  assert.deepEqual(project.sources, [first, last]);
  assert.deepEqual(output.sourceSnapshots, []);
  assert.deepEqual(output.selectedSourceIndexes, []);
  assert.equal(output.sourceCount, 0);
  assert.deepEqual(derived.selectedSourceIndexes, [0, 1]);
  assert.deepEqual(derived.sourceSnapshots, historical);
  assert.equal(derived.sourceCount, 3);
  edit(output, 'New body after clearing');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources.length, 3, 'clearing is reversible by adding new body text');
});

test('explicit deletion uses stable own-material identity and suppresses recreation until restored', () => {
  const { project, output } = setup('Initial body', 'My draft');
  syncOwnMaterialSource(project, output);
  const source = project.sources[0];
  const key = sourceIdentityKey(source);
  assert.equal(key, JSON.stringify(['own-material', output.id]));
  project.sources.splice(0, 1);
  project.removedSourceKeys = [key];
  edit(output, 'Changed after deletion', 'A new title after deletion');
  syncOwnMaterialSource(project, output);
  assert.deepEqual(project.sources, []);
  assert.ok(project.removedSourceKeys.includes(key));
  project.removedSourceKeys = [];
  project.sources.push(source);
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources.length, 1);
  assert.equal(project.sources[0], source);
  assert.equal(sourceIdentityKey(source), key);
  assert.equal(source.title, 'A new title after deletion');
  assert.equal(source.text, 'Changed after deletion');
});


test('a title alone creates a source that gains body text and keeps the title when the body is cleared', () => {
  const { project, output } = setup('', 'A title by itself');
  output.titleProvided = true;
  syncOwnMaterialSource(project, output);
  const source = project.sources[0];
  assert.equal(project.sources.length, 1);
  assert.equal(source.title, 'A title by itself');
  assert.equal(source.text, 'A title by itself');
  assert.equal(source.selected, true);
  assert.deepEqual(output.sourceSnapshots, [source]);
  edit(output, 'The written article body', 'Renamed article');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0], source);
  assert.equal(project.sources.length, 1);
  assert.equal(source.title, 'Renamed article');
  assert.equal(source.text, 'The written article body');
  edit(output, '');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0], source);
  assert.equal(source.title, 'Renamed article');
  assert.equal(source.text, 'Renamed article');
  assert.equal(output.sourceCount, 1);
  edit(output, '', 'Untitled story');
  output.titleProvided = false;
  syncOwnMaterialSource(project, output);
  assert.deepEqual(project.sources, []);
  assert.deepEqual(output.sourceSnapshots, []);
  assert.equal(output.sourceCount, 0);
});

test('a deliberately typed Untitled story title is distinct from the empty-editor default', () => {
  const { project, output } = setup();
  syncOwnMaterialSource(project, output);
  assert.deepEqual(project.sources, []);
  output.titleProvided = true;
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0].title, 'Untitled story');
  assert.equal(project.sources[0].text, 'Untitled story');
  edit(output, 'Opening paragraph must not replace an explicitly typed title');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources[0].title, 'Untitled story');
  assert.equal(project.sources[0].text, output.draftText);
});


test('additional own-material outputs sync independently and respect per-source deletion', () => {
  const { project, output } = setup('First body', 'First material');
  const second = { ...structuredClone(output), id: 'second-material', ownMaterial: true, title: 'Second material', draftText: 'Second body', document: { ops: [{ insert: 'Second body\n' }] } };
  project.outputs.push(second);
  syncOwnMaterialSource(project, output);
  syncOwnMaterialSource(project, second);
  assert.equal(project.sources.length, 2);
  assert.equal(project.sources[0].ownMaterialOutputId, output.id);
  assert.equal(project.sources[1].ownMaterialOutputId, second.id);
  assert.deepEqual(output.selectedSourceIndexes, [0]);
  assert.deepEqual(second.selectedSourceIndexes, [1]);
  const firstSource = structuredClone(project.sources[0]);
  const firstOutput = structuredClone(output);
  edit(second, 'Revised second body', 'Updated second material');
  syncOwnMaterialSource(project, second);
  assert.deepEqual(project.sources[0], firstSource);
  assert.deepEqual(output, firstOutput);
  assert.equal(project.sources[1].text, 'Revised second body');
  const removed = project.sources.pop();
  project.removedSourceKeys = [sourceIdentityKey(removed)];
  edit(second, 'Do not restore the deleted source');
  assert.equal(syncOwnMaterialSource(project, second), false);
  assert.deepEqual(project.sources, [firstSource]);
  edit(output, 'First source stays editable');
  syncOwnMaterialSource(project, output);
  assert.equal(project.sources.length, 1);
  assert.equal(project.sources[0].text, 'First source stays editable');
});
