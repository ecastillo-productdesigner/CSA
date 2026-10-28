import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createContext, runInContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import { parseSourceLinks, formatSourceLinks, sourceLinkArticles } from '../dist/source-links.js';
import { partitionSourceAdditions } from '../dist/source-model.js';
import { projectTitleFromSources } from '../dist/dashboard.js';
import { normalizeWordCount } from '../dist/variant-word-count.js';
import { createNewProjectUpload } from '../dist/new-project-upload.js';
import { projectOutputs, selectedOutputs, outputIsReady, populateOutputContent, reviseSampleOutput } from '../dist/outputs.js';

// Run the production functions without booting Quill, navigation, or the rest
// of the app. Dependencies below are observable UI/storage boundaries.
const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
function productionFunction(start, end) {
  const from = app.indexOf(start);
  const until = app.indexOf(end, from);
  assert.ok(from >= 0 && until > from, `Production function boundary: ${start}`);
  return app.slice(from, until);
}
const production = [
  productionFunction('function titleFrom(', '\nfunction createProject('),
  productionFunction('function createProject(', '\nfunction showHome('),
  productionFunction('async function appendProjectSources(', '\nfunction showProject('),
  productionFunction('async function submitSource(', "\n$('#new-project-query').addEventListener"),
  productionFunction('function finishOutputProcessing(', '\nfunction resumeOutputProcessing('),
  productionFunction('function renderDeferredOutput(', "\n$('#new-project-dialog').addEventListener"),
].join('\n');

class Control {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    this.selectionStart = 0;
    const classes = new Set();
    this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name); }
  querySelectorAll(selector) {
    const tags = selector.split(',').map(value => value.trim());
    return this.children.flatMap(child => [...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  setCustomValidity(value) { this.validityMessage = value; }
  setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
  fire(name, detail = {}) { return this.listeners.get(name)?.({ target: this, preventDefault() {}, ...detail }); }
  focus() { document.activeElement = this; }
}
const clone = value => JSON.parse(JSON.stringify(value));
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const url = 'https://www.charlotteobserver.com/opinion/article317717272.html';
const title = 'NC Democrats see the strongest start to early voting ‘in the entire country’ | Opinion';
const metadata = (href = url, heading = title) => ({ url: href, title: heading, description: 'A public article description', headlineSource: 'json-ld', metadataStatus: 'resolved' });

function setup(t, { target = null, active = null, projects = [], dialogOpen = true, holdAddition = false } = {}) {
  const priorDocument = globalThis.document;
  const tags = { dialog: 'dialog', query: 'textarea', submit: 'button', 'file-input': 'input', 'drop-zone': 'label', 'upload-selection': 'div', 'selected-files': 'ul', 'file-status': 'p', 'use-material': 'button', 'material-error': 'p', 'link-status': 'p', 'link-error': 'p', close: 'button' };
  const nodes = Object.fromEntries(Object.entries(tags).map(([key, tag]) => [key, new Control(tag)]));
  const get = name => nodes[name];
  get('query').value = url;
  get('query').selectionStart = url.length;
  get('submit').textContent = 'Continue';
  get('use-material').textContent = 'Start creating';
  get('drop-zone').append(get('file-input'));
  get('upload-selection').append(get('selected-files'), get('file-status'), get('use-material'));
  get('dialog').append(get('query'), get('submit'), get('close'), get('drop-zone'), get('upload-selection'), get('material-error'));
  get('dialog').open = dialogOpen;
  get('dialog').close = () => { get('dialog').open = false; get('dialog').fire('close'); };
  const otherInput = new Control('input');
  const alreadyDisabled = new Control('button');
  alreadyDisabled.disabled = true;
  const document = {
    createElement: tag => new Control(tag),
    querySelector: selector => selector.startsWith('#new-project-') ? get(selector.slice('#new-project-'.length)) : null,
    querySelectorAll: () => [...get('dialog').querySelectorAll('button, input, textarea'), otherInput, alreadyDisabled],
  };
  globalThis.document = document;
  t.after(() => { if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument; });
  const pending = deferred();
  const addition = deferred();
  const composer = new Control();
  const querySelector = document.querySelector;
  document.querySelector = selector => selector === '#composer' ? composer : querySelector(selector);
  const calls = { resolve: [], saved: [], shown: [], sourcePanels: [], notifications: [], fileSaves: 0, resets: 0, editorCloses: 0, additionWaits: [], sourceRenders: [], deletedDocuments: [], duplicatePopups: [] };
  const context = createContext({
    partitionSourceAdditions, sourceAlreadyAdded: { open: options => calls.duplicatePopups.push(options) },
    AbortController, crypto: { randomUUID }, document, parseSourceLinks, formatSourceLinks, sourceLinkArticles, projectTitleFromSources, normalizeWordCount,
    projectOutputs, selectedOutputs, outputIsReady, populateOutputContent, reviseSampleOutput, clearTimeout,
    projectSourcesPanel: { waitForAddition: id => { calls.additionWaits.push(id); return holdAddition ? addition.promise : Promise.resolve(true); } },
    renderProjectSources: project => calls.sourceRenders.push(project.id),
    updateComposerActions() {},
    searchExperience: { show() {} },
    deleteDocuments: async ids => { calls.deletedDocuments.push(...ids); },
    outputTimers: new Map(), outputViews: new Map(), deferredOutputProjectId: null,
    richEditor: { close: () => { calls.editorCloses++; } },
    $: selector => document.querySelector(selector),
    projects: structuredClone(projects), activeProjectId: active, sourceTargetProjectId: target, sourceImport: null,
    resolveArticleMetadata: (urls, options) => { calls.resolve.push({ urls: clone(urls), options }); return pending.promise; },
    saveProjects: () => { calls.saved.push(clone(context.projects)); return true; },
    showProject: id => { calls.shown.push(id); context.activeProjectId = id; context.sourceTargetProjectId = null; },
    showEditorProject: project => { calls.shown.push(project.id); context.activeProjectId = project.id; if (get('dialog').open) get('dialog').close(); },
    showHome: () => { context.activeProjectId = null; },
    notify: message => calls.notifications.push(message),
    railNavigation: { open: name => calls.sourcePanels.push(name), closeTransient() {} },
    window: { matchMedia: () => ({ matches: false }) }, breakpointQuery: () => '(max-width: 640px)',
  });
  const upload = createNewProjectUpload({
    isBlocked: () => Boolean(context.sourceImport),
    saveFiles: async () => { calls.fileSaves++; return []; },
    onCreate: () => true,
  });
  const reset = upload.reset;
  upload.reset = () => { calls.resets++; return reset(); };
  context.newProjectUpload = upload;
  get('dialog').addEventListener('close', () => { upload.reset(); context.renderDeferredOutput(); });
  runInContext(production, context, { filename: 'app-link-import-integration.js' });
  function selectFile() {
    get('file-input').files = [{ name: 'Original.txt', size: 12, lastModified: 1 }];
    get('file-input').fire('change');
  }
  return { context, get, pending, addition, calls, upload, selectFile, otherInput, alreadyDisabled, submit: input => context.submitSource(input ?? get('query').value) };
}

test('duplicate submission resolves each pasted URL once and creates one project with the exact metadata', async t => {
  const ui = setup(t);
  ui.get('query').value = `${url}\n${url}`;
  const work = ui.submit();
  assert.equal(ui.calls.resolve.length, 1);
  assert.deepEqual(ui.calls.resolve[0].urls, [url]);
  assert.equal(ui.calls.resolve[0].options.signal.aborted, false);
  assert.equal(await ui.submit(), false);
  assert.equal(ui.calls.resolve.length, 1);
  assert.equal(ui.get('submit').textContent, 'Reading articles…');
  assert.equal(ui.get('dialog').getAttribute('aria-busy'), 'true');
  assert.equal(ui.get('drop-zone').getAttribute('aria-disabled'), 'true');
  assert.equal(ui.get('query').disabled, true);
  ui.pending.resolve([metadata()]);
  assert.equal(await work, true);
  assert.equal(ui.context.projects.length, 1);
  const project = ui.context.projects[0];
  assert.equal(project.title, title);
  assert.equal(project.kind, 'draft');
  assert.equal(project.awaitingOutput, true);
  assert.equal(project.linkCards, true);
  assert.deepEqual(clone(project.sources), [{ type: 'link', url, title, description: 'A public article description', excerpt: 'A public article description', headlineSource: 'json-ld', metadataStatus: 'resolved', selected: true, addedToCsa: false }]);
  assert.equal(ui.calls.saved.at(-1)[0].sources[0].title, title);
  assert.equal(ui.calls.shown.length, 1);
  assert.equal(ui.context.sourceImport, null);
  assert.equal(ui.get('dialog').open, false);
});

test('source addition uses the captured target and persists metadata through the actual append function', async t => {
  const existing = { id: 'target', title: 'Existing project', sources: [{ type: 'text', title: 'Keep this source', text: 'Saved original' }] };
  const ui = setup(t, { target: 'target', active: 'target', projects: [existing, { id: 'other', title: 'Other', sources: [] }] });
  const work = ui.submit();
  ui.pending.resolve([metadata()]);
  assert.equal(await work, true);
  assert.equal(ui.context.projects.length, 2);
  const target = ui.context.projects.find(project => project.id === 'target');
  assert.equal(target.sources.length, 2);
  assert.equal(target.sources[0].text, 'Saved original');
  assert.equal(target.sources[1].title, title);
  assert.equal(target.sources[1].description, 'A public article description');
  assert.equal(target.sources[1].headlineSource, 'json-ld');
  assert.equal(target.linkCards, true);
  assert.equal(target.viewOriginalDraft, true);
  assert.equal(ui.context.projects.find(project => project.id === 'other').sources.length, 0);
  assert.equal(ui.context.sourceTargetProjectId, null);
  assert.equal(ui.calls.saved.at(-1).find(project => project.id === 'target').sources[1].title, title);
  assert.deepEqual(ui.calls.shown, ['target']);
});

for (const scenario of ['active changed', 'target changed', 'dialog closed', 'request aborted']) {
  test(`a stale import cannot create a project after ${scenario}`, async t => {
    const ui = setup(t, { active: 'origin' });
    const work = ui.submit();
    if (scenario === 'active changed') ui.context.activeProjectId = 'different';
    if (scenario === 'target changed') ui.context.sourceTargetProjectId = 'different';
    if (scenario === 'dialog closed') ui.get('dialog').close();
    if (scenario === 'request aborted') ui.context.sourceImport.controller.abort();
    ui.pending.resolve([metadata()]);
    assert.equal(await work, false);
    assert.equal(ui.context.projects.length, 0);
    assert.equal(ui.calls.saved.length, 0);
    assert.equal(ui.calls.shown.length, 0);
    assert.equal(ui.context.sourceImport, null);
    assert.equal(ui.get('dialog').getAttribute('aria-busy'), undefined);
    assert.equal(ui.get('submit').textContent, 'Continue');
  });
}

test('a target deleted during fetching receives no sources and is never replaced by a new project', async t => {
  const ui = setup(t, { target: 'target', active: 'target', projects: [{ id: 'target', title: 'Existing', sources: [] }] });
  const work = ui.submit();
  ui.context.projects[0].deletedAt = 10;
  ui.pending.resolve([metadata()]);
  assert.equal(await work, false);
  assert.equal(ui.context.projects.length, 1);
  assert.equal(ui.context.projects[0].sources.length, 0);
  assert.equal(ui.calls.saved.length, 0);
  assert.equal(ui.calls.shown.length, 0);
});

test('success restores prior control states and cannot leave an enabled upload action after its selection was reset', async t => {
  const ui = setup(t);
  ui.selectFile();
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.equal(ui.get('use-material').disabled, false);
  const work = ui.submit();
  assert.equal(ui.upload.isBusy(), true);
  assert.equal(ui.otherInput.disabled, true);
  await ui.get('use-material').fire('click');
  assert.equal(ui.calls.fileSaves, 0, 'file creation cannot overlap the link import');
  ui.pending.resolve([metadata()]);
  assert.equal(await work, true);
  assert.equal(ui.get('selected-files').children.length, 0);
  assert.equal(ui.get('upload-selection').hidden, true);
  assert.equal(ui.get('use-material').disabled, true, 'close reset must win over the prior enabled control snapshot');
  assert.equal(ui.get('file-input').disabled, false);
  assert.equal(ui.otherInput.disabled, false);
  assert.equal(ui.alreadyDisabled.disabled, true);
  assert.equal(ui.get('query').disabled, false);
  assert.equal(ui.get('drop-zone').getAttribute('aria-disabled'), undefined);
  assert.equal(ui.get('link-status').textContent, '');
  assert.equal(ui.calls.resets >= 2, true);
});

test('an interrupted import keeps the open dialog selection intact while restoring control states', async t => {
  const ui = setup(t, { active: 'origin' });
  ui.selectFile();
  const work = ui.submit();
  ui.context.activeProjectId = 'different';
  ui.pending.resolve([metadata()]);
  assert.equal(await work, false);
  assert.equal(ui.get('dialog').open, true);
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.equal(ui.get('use-material').disabled, false);
  assert.equal(ui.get('file-input').disabled, false);
  assert.equal(ui.alreadyDisabled.disabled, true);
});

test('a resolver error still creates readable fallback sources in input order and releases the busy state', async t => {
  const ui = setup(t);
  const second = 'https://news.example.com/a-readable-story.html';
  ui.get('query').value = `${url}\n${second}`;
  const work = ui.submit();
  ui.pending.reject(new Error('Metadata unavailable'));
  assert.equal(await work, true);
  const sources = ui.context.projects[0].sources;
  assert.deepEqual(clone(sources.map(source => source.url)), [url, second]);
  assert.equal(sources.length, 2);
  assert.equal(sources[0].metadataStatus, 'fallback');
  assert.equal(sources[1].title, 'a readable story');
  assert.equal(ui.context.sourceImport, null);
  assert.equal(ui.get('query').disabled, false);
});


test('a draft completing during a headline import is saved without closing the dialog or discarding the new project', async t => {
  const output = { id: 'pending', title: 'Existing pending story', status: 'pending' };
  const original = { id: 'origin', title: 'Existing project', sources: [], outputs: [output], selectedOutputIds: ['pending'], outputProcessing: { ids: ['pending'], openOutputId: 'pending' } };
  const ui = setup(t, { active: 'origin', projects: [original] });
  const work = ui.submit();
  const project = ui.context.projects[0];
  ui.context.finishOutputProcessing(project);
  assert.equal(project.outputs[0].status, 'ready');
  assert.equal(project.outputProcessing, undefined);
  assert.equal(ui.calls.saved.length, 1, 'background completion still persists');
  assert.equal(ui.get('dialog').open, true, 'background refresh must leave the active import dialog open');
  assert.equal(ui.calls.editorCloses, 0);
  assert.deepEqual(ui.calls.shown, []);
  assert.equal(ui.context.deferredOutputProjectId, 'origin');
  ui.pending.resolve([metadata()]);
  assert.equal(await work, true);
  assert.equal(ui.context.projects.length, 2);
  assert.equal(ui.context.projects[0].sources[0].title, title);
  assert.equal(ui.calls.shown.length, 1, 'the new project opens without an old-project refresh stealing focus');
  assert.equal(ui.calls.shown[0], ui.context.projects[0].id);
  assert.equal(ui.context.deferredOutputProjectId, null);
});


const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('adding a source closes the picker and waits before changing or saving project sources', async t => {
  const project = { id: 'target', title: 'Existing', sources: [{ type: 'text', title: 'Original', text: 'Keep this' }] };
  const ui = setup(t, { target: 'target', active: 'target', projects: [project], holdAddition: true });
  const work = ui.submit();
  ui.pending.resolve([metadata()]);
  await flush();
  assert.deepEqual(ui.calls.additionWaits, ['target']);
  assert.equal(ui.get('dialog').open, false);
  assert.deepEqual(ui.calls.sourcePanels, ['sources']);
  assert.equal(ui.context.projects[0].sources.length, 1);
  assert.equal(ui.calls.saved.length, 0);
  assert.equal(ui.calls.notifications.length, 0);
  ui.addition.resolve(true);
  assert.equal(await work, true);
  assert.equal(ui.context.projects[0].sources.length, 2);
  assert.deepEqual(ui.calls.sourceRenders, ['target']);
  assert.deepEqual(ui.calls.notifications, ['1 source added']);
});

test('source additions finish in their original project without taking over the project opened during loading', async t => {
  const ui = setup(t, { target: 'target', active: 'target', projects: [
    { id: 'target', title: 'Existing', sources: [] }, { id: 'other', title: 'Other', sources: [] },
  ], holdAddition: true });
  const work = ui.submit();
  ui.pending.resolve([metadata()]);
  await flush();
  ui.context.activeProjectId = 'other';
  ui.addition.resolve(true);
  assert.equal(await work, true);
  assert.equal(ui.context.projects[0].sources.length, 1);
  assert.equal(ui.context.projects[1].sources.length, 0);
  assert.equal(ui.context.activeProjectId, 'other');
  assert.deepEqual(ui.calls.shown, ['target'], 'completion does not open the target again');
  assert.deepEqual(ui.calls.sourceRenders, []);
});

test('deleting a project during source loading releases its new documents without reopening it', async t => {
  const ui = setup(t, { target: 'target', active: 'target', projects: [{ id: 'target', title: 'Existing', sources: [] }], holdAddition: true });
  const work = ui.context.appendProjectSources([{ type: 'file', title: 'New document', attachmentId: 'new-document' }], 'target');
  assert.deepEqual(ui.calls.additionWaits, ['target']);
  ui.context.projects[0].deletedAt = 10;
  ui.context.activeProjectId = null;
  ui.addition.resolve(true);
  assert.equal(await work, true);
  assert.equal(ui.context.projects[0].sources.length, 0);
  assert.deepEqual(ui.calls.deletedDocuments, ['new-document']);
  assert.equal(ui.calls.saved.length, 0);
  assert.equal(ui.calls.notifications.length, 0);
});

test('an already-added source does not show a five-second loading state or duplicate its row', async t => {
  const ui = setup(t, { target: 'target', active: 'target', projects: [{ id: 'target', title: 'Existing', sources: [{ type: 'link', url, title }] }] });
  const work = ui.submit();
  ui.pending.resolve([metadata()]);
  assert.equal(await work, true);
  assert.equal(ui.context.projects[0].sources.length, 1);
  assert.deepEqual(ui.calls.additionWaits, []);
  assert.deepEqual(ui.calls.notifications, []);
  assert.equal(ui.calls.duplicatePopups.length, 1);
  assert.equal(ui.calls.duplicatePopups[0].count, 1);
});


test('a mixed batch adds only new sources then shows the duplicate popup once', async t => {
  const original = { type: 'text', title: 'Original', text: 'Keep this', selected: true };
  const fresh = { type: 'text', title: 'New', text: 'New source' };
  const ui = setup(t, { target: 'target', active: 'target', projects: [{ id: 'target', title: 'Existing', sources: [original] }], holdAddition: true });
  const work = ui.context.appendProjectSources([original, fresh, fresh], 'target');
  assert.equal(ui.context.projects[0].sources.length, 1);
  ui.addition.resolve(true);
  assert.equal(await work, true);
  assert.equal(ui.context.projects[0].sources.length, 2);
  assert.deepEqual(ui.calls.notifications, ['1 source added']);
  assert.equal(ui.calls.duplicatePopups.length, 1);
  assert.equal(ui.calls.duplicatePopups[0].count, 2);
});

test('duplicate documents discard only the unused new upload and preserve the saved attachment', async t => {
  const original = { type: 'file', title: 'Notes.pdf', attachmentId: 'saved-file' };
  const ui = setup(t, { target: 'target', active: 'target', projects: [{ id: 'target', title: 'Existing', sources: [original] }] });
  assert.equal(await ui.context.appendProjectSources([{ ...original, attachmentId: 'unused-upload' }, original], 'target'), true);
  assert.deepEqual(ui.calls.deletedDocuments, ['unused-upload']);
  assert.equal(ui.context.projects[0].sources.length, 1);
  assert.equal(ui.context.projects[0].sources[0].attachmentId, 'saved-file');
  assert.equal(ui.calls.duplicatePopups[0].count, 2);
  assert.deepEqual(ui.calls.additionWaits, []);
});
