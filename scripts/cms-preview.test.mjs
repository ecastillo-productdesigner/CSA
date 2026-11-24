import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createCmsPreviewRecord, readCmsPreviewRecord, saveCmsPreviewRecord, cmsPreviewUrl } from '../dist/cms-preview-model.js';
import { projectOutputs, outputIsReady } from '../dist/outputs.js';

const prefix = 'csa.cms-preview.v1.';
function memoryStorage() {
  const entries = new Map();
  return { entries, getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value) };
}
function draft() {
  return {
    id: 'draft-a', title: 'Museum prepares a new nature exhibit', status: 'ready',
    draftText: 'Outdated plain text', shareText: 'Families will be able to explore local wildlife.',
    document: { ops: [{ insert: 'The museum is preparing a nature exhibit.', attributes: { bold: true } }, { insert: '\nA second paragraph.\n' }] },
    cmsSentAt: 1790000000000,
  };
}
const destination = { id: 'training', name: 'Training' };

test('CMS export captures the current article, share text and SEO in a separate editable snapshot', () => {
  const output = draft();
  const project = { id: 'project-a', outputs: [output] };
  const before = structuredClone(project);
  const record = createCmsPreviewRecord(project, output, destination);
  assert.match(record.id, /^[a-zA-Z0-9_-]{1,100}$/);
  assert.equal(record.projectId, project.id);
  assert.equal(record.outputId, output.id);
  assert.equal(record.title, output.title);
  assert.equal(record.shareText, output.shareText);
  assert.equal(record.body, 'The museum is preparing a nature exhibit.\nA second paragraph.');
  assert.deepEqual(record.document, output.document);
  assert.equal(record.metadata.seoTitle, output.title);
  assert.equal(record.metadata.metaDescription, 'The museum is preparing a nature exhibit.');
  assert.match(record.metadata.seoKeywords, /museum/);
  assert.equal(record.createdAt, output.cmsSentAt);
  assert.equal(record.updatedAt, output.cmsSentAt);
  assert.equal(record.exportedAt, output.cmsSentAt);
  assert.equal(record.publication, 'Training');
  assert.equal(record.destinationId, 'training');
  assert.equal(record.status, 'Draft');
  assert.deepEqual(project, before, 'preparing a preview does not modify the CSA project');
  record.title = 'Edited inside CMS';
  record.document.ops[0].attributes.bold = false;
  record.document.ops.push({ insert: 'CMS-only text' });
  assert.deepEqual(project, before, 'CMS edits cannot modify source document objects');
  output.document.ops[0].insert = 'New CSA revision';
  assert.equal(record.document.ops[0].insert, before.outputs[0].document.ops[0].insert);
});

test('legacy exports open the sent title, document and share text even after later CSA edits', () => {
  const output = draft();
  const sentOps = [{ insert: 'Exported opening.\n', attributes: { italic: true } }];
  output.cmsSentContent = JSON.stringify(['Exported headline', sentOps, 'Exported share text']);
  output.cmsDraftId = 'existing-cms-draft';
  output.cmsDestinationId = 'legacy-destination';
  const record = createCmsPreviewRecord({ id: 'project-a' }, output, undefined, { useSentSnapshot: true });
  assert.equal(record.id, 'existing-cms-draft');
  assert.equal(record.title, 'Exported headline');
  assert.equal(record.body, 'Exported opening.');
  assert.equal(record.shareText, 'Exported share text');
  assert.deepEqual(record.document.ops, sentOps);
  assert.equal(record.metadata.seoTitle, 'Exported headline');
  assert.equal(record.destinationId, 'legacy-destination');
  const reexport = createCmsPreviewRecord({ id: 'project-a' }, output, destination);
  assert.equal(reexport.id, record.id, 're-export updates the same CMS draft');
  assert.equal(reexport.title, output.title, 'a new export captures current CSA edits');
});

test('plain text and malformed legacy signatures produce usable preview records', () => {
  for (const cmsSentContent of ['not json', '{}', '[null, null]', undefined]) {
    const record = createCmsPreviewRecord({ id: 'project-a' }, {
      id: 'plain', title: '', draftText: 'Plain draft body.', cmsSentContent, cmsDraftId: '../invalid',
    }, null, { useSentSnapshot: true });
    assert.equal(record.title, 'Untitled story');
    assert.equal(record.body, 'Plain draft body.');
    assert.equal(record.document, null);
    assert.equal(record.shareText, '');
    assert.equal(record.publication, 'Training');
    assert.match(record.id, /^[a-zA-Z0-9_-]{1,100}$/);
    assert.ok(record.exportedAt > 0);
  }
});

test('CMS drafts persist separately, round-trip as independent data, and handle missing or damaged storage', () => {
  const storage = memoryStorage();
  storage.setItem('csa.projects', 'unrelated source projects');
  const record = createCmsPreviewRecord({ id: 'project-a' }, draft(), destination);
  assert.equal(saveCmsPreviewRecord(record, storage), true);
  assert.deepEqual([...storage.entries.keys()].sort(), ['csa.projects', prefix + record.id].sort());
  const restored = readCmsPreviewRecord(record.id, storage);
  assert.deepEqual(restored, record);
  restored.document.ops[0].insert = 'Changed preview';
  assert.deepEqual(readCmsPreviewRecord(record.id, storage), record);
  assert.equal(readCmsPreviewRecord('missing', storage), null);
  storage.setItem(prefix + 'broken', '{');
  assert.equal(readCmsPreviewRecord('broken', storage), null);
  for (const malformed of [null, {}, { id: 'different', title: '', body: '' }, { id: 'broken', title: 1, body: '' }]) {
    storage.setItem(prefix + 'broken', JSON.stringify(malformed));
    assert.equal(readCmsPreviewRecord('broken', storage), null);
  }
  const blocked = { getItem() { throw new Error('Storage unavailable'); }, setItem() { throw new Error('Quota exceeded'); } };
  assert.equal(readCmsPreviewRecord(record.id, blocked), null);
  assert.equal(saveCmsPreviewRecord(record, blocked), false);
  assert.equal(readCmsPreviewRecord(record.id, null), null);
  assert.equal(saveCmsPreviewRecord(record, null), false);
});

test('malformed IDs never access storage or become CMS links, and local links remain on the app origin', () => {
  const unused = { getItem() { assert.fail('Invalid IDs must not reach storage'); }, setItem() { assert.fail('Invalid IDs must not reach storage'); } };
  for (const id of [undefined, null, '', '../draft', 'a/b', 'a?other=b', 'a#fragment', 'a b', '<script>', 'a'.repeat(101)]) {
    assert.equal(readCmsPreviewRecord(id, unused), null);
    assert.equal(saveCmsPreviewRecord({ id, title: 'Draft', body: '' }, unused), false);
    assert.throws(() => cmsPreviewUrl(id, 'http://localhost:5173/index.html'), /Invalid CMS draft/);
  }
  assert.equal(saveCmsPreviewRecord(null, unused), false);
  assert.equal(saveCmsPreviewRecord({ id: 'valid', title: null, body: '' }, unused), false);
  assert.equal(cmsPreviewUrl('draft_123-ab', 'http://localhost:5173/index.html?project=x#editor'), 'http://localhost:5173/cms.html?draft=draft_123-ab');
  assert.equal(cmsPreviewUrl('draft-a', 'https://preview.example/csa/index.html'), 'https://preview.example/csa/cms.html?draft=draft-a');
});

const appSource = readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');
const flowSource = appSource.slice(appSource.indexOf('function openVariantInCms('), appSource.indexOf('async function deleteProjectPermanently('));
function setupFlow() {
  const output = draft();
  delete output.cmsSentAt;
  const other = { ...draft(), id: 'draft-b' };
  delete other.cmsSentAt;
  const project = { id: 'project-a', selectedOutputId: output.id, outputs: [output, other] };
  const storage = memoryStorage();
  const calls = { save: 0, markSent: 0, render: [], notices: [], opened: [] };
  let writesAllowed = true;
  const context = vm.createContext({
    projects: [project], activeProjectId: project.id, projectOutputs, outputIsReady,
    sendDestinations: [destination], createCmsPreviewRecord, cmsPreviewUrl,
    readCmsPreviewRecord: id => readCmsPreviewRecord(id, storage),
    saveCmsPreviewRecord: record => writesAllowed && saveCmsPreviewRecord(record, storage),
    richEditor: {
      canSend: () => true,
      markSent() { calls.markSent++; return JSON.stringify([output.title, output.document.ops, output.shareText]); },
    },
    saveProjects() { calls.save++; return true; },
    editorTabs: { render(entry) { calls.render.push(entry); } },
    notify(message) { calls.notices.push(message); },
    window: { location: { href: 'http://localhost:5173/index.html' }, open(...args) { calls.opened.push(args); } },
  });
  vm.runInContext(flowSource, context);
  return { context, project, output, other, storage, calls, blockWrites() { writesAllowed = false; } };
}

test('export saves the chosen draft before enabling CMS opening, and subsequent opens preserve CMS edits', () => {
  const ui = setupFlow();
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), false);
  assert.equal(ui.context.markVariantSentToCms(ui.project.id, ui.other.id, destination.id), false, 'cannot export a different selected draft');
  assert.equal(ui.context.markVariantSentToCms(ui.project.id, ui.output.id, destination.id), true);
  assert.equal(ui.calls.markSent, 1);
  assert.ok(ui.output.cmsSentAt > 0);
  assert.equal(ui.output.cmsDestinationId, destination.id);
  assert.equal(ui.other.cmsDraftId, undefined);
  const record = readCmsPreviewRecord(ui.output.cmsDraftId, ui.storage);
  assert.equal(record.title, ui.output.title);
  record.title = 'Edited in CMS';
  saveCmsPreviewRecord(record, ui.storage);
  ui.output.title = 'Later CSA edit';
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), true);
  assert.deepEqual(ui.calls.opened[0], [cmsPreviewUrl(record.id, 'http://localhost:5173/index.html'), '_blank', 'noopener,noreferrer']);
  assert.equal(readCmsPreviewRecord(record.id, ui.storage).title, 'Edited in CMS', 'opening does not overwrite independent CMS edits');
  assert.equal(ui.calls.markSent, 1, 'opening does not export again');
});

test('legacy opening recovers the sent snapshot, while storage failure does not mark a draft exported or navigate', () => {
  const ui = setupFlow();
  ui.output.cmsSentAt = 1790000000000;
  ui.output.cmsSentContent = JSON.stringify(['Old exported headline', [{ insert: 'Old exported body.\n' }], 'Old share']);
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), true);
  assert.equal(readCmsPreviewRecord(ui.output.cmsDraftId, ui.storage).title, 'Old exported headline');
  assert.equal(ui.calls.markSent, 0);
  assert.equal(ui.calls.save, 1);

  const blocked = setupFlow();
  blocked.blockWrites();
  assert.equal(blocked.context.markVariantSentToCms(blocked.project.id, blocked.output.id, destination.id), false);
  assert.equal(blocked.output.cmsSentAt, undefined);
  assert.equal(blocked.output.cmsDraftId, undefined);
  assert.equal(blocked.calls.markSent, 0);
  assert.equal(blocked.calls.save, 0);
  blocked.output.cmsSentAt = 1790000000000;
  assert.equal(blocked.context.openVariantInCms(blocked.project.id, blocked.output.id), false);
  assert.equal(blocked.calls.opened.length, 0);
  assert.equal(blocked.calls.notices.length, 2);
});

test('missing, unready, archived and deleted drafts cannot open a CMS page', () => {
  const ui = setupFlow();
  assert.equal(ui.context.openVariantInCms('missing', ui.output.id), false);
  assert.equal(ui.context.openVariantInCms(ui.project.id, 'missing'), false);
  ui.output.cmsSentAt = 1790000000000;
  ui.output.status = 'processing';
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), false);
  ui.output.status = 'ready';
  ui.project.archivedAt = 1;
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), false);
  delete ui.project.archivedAt;
  ui.project.deletedAt = 1;
  assert.equal(ui.context.openVariantInCms(ui.project.id, ui.output.id), false);
  assert.equal(ui.calls.opened.length, 0);
  assert.equal(ui.storage.entries.size, 0);
});

test('re-export updates the same CMS draft and preserves its creation date', () => {
  const ui = setupFlow();
  const createdAt = 1790000000000;
  ui.output.cmsSentAt = createdAt;
  ui.output.cmsDraftId = 'existing-preview';
  const previous = createCmsPreviewRecord(ui.project, ui.output, destination);
  saveCmsPreviewRecord(previous, ui.storage);
  ui.output.title = 'Revised headline for the next export';
  ui.output.document.ops = [{ insert: 'Revised body for the next export.\n' }];
  ui.output.shareText = 'A revised share description.';
  assert.equal(ui.context.markVariantSentToCms(ui.project.id, ui.output.id, destination.id), true);
  const next = readCmsPreviewRecord('existing-preview', ui.storage);
  assert.equal(ui.output.cmsDraftId, 'existing-preview');
  assert.equal(ui.storage.entries.size, 1);
  assert.equal(next.createdAt, createdAt);
  assert.ok(next.exportedAt > createdAt);
  assert.equal(next.updatedAt, next.exportedAt);
  assert.equal(next.title, ui.output.title);
  assert.equal(next.body, 'Revised body for the next export.');
  assert.equal(next.shareText, ui.output.shareText);
  assert.equal(ui.calls.markSent, 1);
});
