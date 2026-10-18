import test from 'node:test';
import assert from 'node:assert/strict';
import { removeProjectContent } from '../dist/project-deletion.js';

function project(id, sources = []) {
  return { id, title: `Project ${id}`, createdAt: 1, sources, dashboard: true, document: { html: 'Private draft' }, outputs: [{ text: 'Private output' }] };
}

test('permanent deletion clears content, persists, and keeps a deleted seed from returning', () => {
  let saved;
  const records = [project('demo-kelly-dashboard'), project('other')];
  const result = removeProjectContent(records, 'demo-kelly-dashboard', next => { saved = JSON.parse(JSON.stringify(next)); });
  const deleted = saved.find(entry => entry.id === 'demo-kelly-dashboard');
  assert.ok(deleted.deletedAt);
  assert.equal(deleted.title, 'Deleted project');
  assert.deepEqual(deleted.sources, []);
  assert.equal(deleted.document, undefined);
  assert.equal(deleted.outputs, undefined);
  assert.ok(saved.some(entry => entry.id === 'demo-kelly-dashboard'), 'bootstrap recognizes the existing ID and does not recreate its sample');
  assert.deepEqual(result.projects[1], records[1]);
  assert.equal(records[0].title, 'Project demo-kelly-dashboard');
});

test('deletes each unshared upload once and retains uploads used by another project', () => {
  const file = attachmentId => ({ type: 'file', title: 'sample.txt', attachmentId });
  const records = [project('one', [file('shared'), file('unique'), file('unique')]), project('two', [file('shared')])];
  assert.deepEqual(removeProjectContent(records, 'one', () => {}).attachmentIds, ['unique']);
});

test('storage failure leaves the current records intact', () => {
  const records = [project('one')];
  const before = JSON.stringify(records);
  assert.throws(() => removeProjectContent(records, 'one', () => { throw new Error('Storage unavailable'); }));
  assert.equal(JSON.stringify(records), before);
});

test('unknown and already deleted projects do not write storage', () => {
  const records = [{ ...project('one'), deletedAt: 1 }];
  const persist = () => assert.fail('Unexpected storage write');
  assert.equal(removeProjectContent(records, 'missing', persist), null);
  assert.equal(removeProjectContent(records, 'one', persist), null);
});
