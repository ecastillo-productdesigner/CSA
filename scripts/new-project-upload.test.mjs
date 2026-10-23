import test from 'node:test';
import assert from 'node:assert/strict';
import { createNewProjectUpload } from '../dist/new-project-upload.js';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.children = [];
    this.listeners = new Map();
    this.attributes = new Map();
    this.disabled = false;
    this.hidden = false;
    this.value = '';
    this.textContent = '';
    const classes = new Set();
    this.classList = { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) };
  }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  querySelectorAll(selector) {
    const tags = selector.split(',').map(tag => tag.trim());
    return this.children.flatMap(child => [...(tags.includes(child.tagName) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  fire(name, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...detail };
    this.lastEvent = event;
    return this.listeners.get(name)?.(event);
  }
  focus() { document.activeElement = this; }
  click() { this.clicks = (this.clicks || 0) + 1; return this.fire('click'); }
}

const file = (name, size = 100, lastModified = 1) => ({ name, size, lastModified });
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function setup(t, callbacks = {}) {
  const previous = globalThis.document;
  const tags = { dialog: 'dialog', 'file-input': 'input', 'drop-zone': 'label', 'upload-selection': 'div', 'selected-files': 'ul', 'file-status': 'p', 'use-material': 'button', 'material-error': 'p' };
  const nodes = Object.fromEntries(Object.entries(tags).map(([name, tag]) => [name, new Element(tag)]));
  const get = name => nodes[name];
  const urlInput = new Element('textarea');
  const urlContinue = new Element('button');
  urlContinue.disabled = true;
  get('use-material').textContent = 'Start Creating';
  get('drop-zone').append(get('file-input'));
  get('upload-selection').append(get('selected-files'), get('file-status'), get('use-material'));
  get('dialog').append(urlInput, urlContinue, get('drop-zone'), get('upload-selection'), get('material-error'));
  globalThis.document = { createElement: tag => new Element(tag), querySelector: selector => get(selector.replace('#new-project-', '')) };
  t.after(() => { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; });
  const saved = [];
  const created = [];
  const deleted = [];
  const api = createNewProjectUpload({
    isBlocked: callbacks.isBlocked,
    saveFiles: callbacks.saveFiles || (async incoming => { saved.push(incoming); return incoming.map((entry, index) => ({ type: 'file', title: entry.name, attachmentId: `attachment-${index}` })); }),
    onCreate: callbacks.onCreate || (async sources => { created.push(sources); }),
    deleteFiles: callbacks.deleteFiles || (async ids => { deleted.push(ids); }),
  });
  function select(files) { get('file-input').files = files; get('file-input').value = 'browser-file-selection'; get('file-input').fire('change'); }
  return { api, get, select, saved, created, deleted, urlInput, urlContinue };
}

test('browse accepts supported documents, de-duplicates the same file and displays removable selections', t => {
  const ui = setup(t);
  assert.equal(ui.get('upload-selection').hidden, true);
  assert.equal(ui.get('use-material').disabled, true);
  const pdf = file('Report.PDF', 10 * 1024 * 1024);
  ui.select([pdf, pdf, file('Notes.docx'), file('Slides.pptx'), file('Notes.txt'), file('Outline.md')]);
  assert.equal(ui.get('selected-files').children.length, 5);
  assert.equal(ui.get('file-input').value, '');
  assert.equal(ui.get('file-status').textContent, '5 documents selected');
  assert.equal(ui.get('upload-selection').hidden, false);
  assert.equal(ui.get('use-material').disabled, false);
  assert.match(ui.get('selected-files').children[0].children[0].textContent, /Report.PDF · 10.0 MB/);
  const remove = ui.get('selected-files').children[0].children[1];
  assert.equal(remove.getAttribute('aria-label'), 'Remove Report.PDF');
  remove.click();
  assert.equal(ui.get('file-status').textContent, '4 documents selected');
  assert.equal(document.activeElement, ui.get('selected-files').querySelector('button'));
});

test('unsupported, empty and oversized documents are rejected without discarding accepted selections', t => {
  const ui = setup(t);
  ui.select([file('Valid.txt')]);
  ui.select([file('Invalid.exe'), file('Empty.pdf', 0), file('Too large.docx', 10 * 1024 * 1024 + 1), file('Invalid size.md', Infinity)]);
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.equal(ui.get('material-error').hidden, false);
  assert.match(ui.get('material-error').textContent, /Invalid.exe, Empty.pdf, Too large.docx, Invalid size.md/);
  assert.match(ui.get('material-error').textContent, /10 MB/);
  ui.get('selected-files').querySelector('button').click();
  assert.equal(ui.get('upload-selection').hidden, true);
  assert.equal(ui.get('use-material').disabled, true);
  assert.equal(ui.get('file-status').textContent, '');
  assert.equal(ui.get('material-error').hidden, true);
});

test('the file limit includes existing selections while identical files do not consume another slot', t => {
  const ui = setup(t);
  const files = Array.from({ length: 20 }, (_, index) => file(`Document ${index}.txt`));
  ui.select(files);
  ui.select([files[0], file('Extra.txt')]);
  assert.equal(ui.get('selected-files').children.length, 20);
  assert.equal(ui.get('file-status').textContent, '20 documents selected');
  assert.match(ui.get('material-error').textContent, /Extra.txt/);
  assert.doesNotMatch(ui.get('material-error').textContent, /Document 0/);
});

test('drop and keyboard browse work and reset clears all selection state between openings', t => {
  const ui = setup(t);
  ui.get('drop-zone').fire('dragover');
  assert.equal(ui.get('drop-zone').lastEvent.defaultPrevented, true);
  assert.equal(ui.get('drop-zone').classList.contains('dragging'), true);
  ui.get('drop-zone').fire('drop', { dataTransfer: { files: [file('Dropped.md')] } });
  assert.equal(ui.get('drop-zone').classList.contains('dragging'), false);
  assert.equal(ui.get('file-status').textContent, '1 document selected');
  ui.get('drop-zone').fire('keydown', { key: 'Enter' });
  assert.equal(ui.get('file-input').clicks, 1);
  assert.equal(ui.api.reset(), true);
  assert.equal(ui.get('selected-files').children.length, 0);
  assert.equal(ui.get('file-status').textContent, '');
  assert.equal(ui.get('material-error').hidden, true);
});

test('creation stores original files once, waits for creation and restores control state', async t => {
  const saving = deferred();
  const creating = deferred();
  const saved = [];
  const received = [];
  const sources = [{ type: 'file', title: 'Original.pdf', attachmentId: 'saved-file' }];
  const ui = setup(t, { saveFiles: incoming => { saved.push(incoming); return saving.promise; }, onCreate: incoming => { received.push(incoming); return creating.promise; } });
  const original = file('Original.pdf');
  ui.select([original]);
  const work = ui.get('use-material').click();
  assert.equal(ui.api.isBusy(), true);
  assert.equal(ui.get('dialog').getAttribute('aria-busy'), 'true');
  assert.equal(ui.get('file-input').disabled, true);
  assert.equal(ui.urlInput.disabled, true);
  assert.equal(ui.get('use-material').textContent, 'Saving Documents…');
  assert.equal(ui.api.reset(), false);
  ui.get('use-material').click();
  ui.select([file('Ignored.txt')]);
  ui.get('selected-files').querySelector('button').click();
  assert.equal(saved.length, 1);
  assert.equal(saved[0][0], original);
  saving.resolve(sources);
  await Promise.resolve();
  assert.equal(received[0], sources);
  assert.equal(ui.api.isBusy(), true);
  creating.resolve();
  await work;
  assert.equal(ui.api.isBusy(), false);
  assert.equal(ui.get('dialog').getAttribute('aria-busy'), undefined);
  assert.equal(ui.get('file-input').disabled, false);
  assert.equal(ui.urlInput.disabled, false);
  assert.equal(ui.urlContinue.disabled, true);
  assert.equal(ui.get('use-material').textContent, 'Start Creating');
  assert.equal(ui.get('use-material').disabled, true);
  assert.equal(ui.get('selected-files').children.length, 0);
});

test('storage failure keeps selected documents available and exposes quota guidance', async t => {
  const ui = setup(t, { saveFiles: async () => { throw Object.assign(new Error('Storage full'), { name: 'QuotaExceededError' }); } });
  ui.select([file('Keep.pdf')]);
  await ui.get('use-material').click();
  assert.equal(ui.api.isBusy(), false);
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.equal(ui.get('use-material').disabled, false);
  assert.match(ui.get('material-error').textContent, /not enough browser storage/);
  assert.equal(ui.created.length, 0);
  assert.equal(ui.deleted.length, 0);
});

test('a failed project creation cleans up stored originals and retains selection for a retry', async t => {
  let shouldFail = true;
  const ui = setup(t, { onCreate: async () => { if (shouldFail) throw new Error('Project storage failed'); } });
  ui.select([file('Keep.txt')]);
  await ui.get('use-material').click();
  assert.deepEqual(ui.deleted, [['attachment-0']]);
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.match(ui.get('material-error').textContent, /still selected/);
  shouldFail = false;
  await ui.get('use-material').click();
  assert.equal(ui.saved.length, 2);
  assert.equal(ui.get('selected-files').children.length, 0);
  assert.equal(ui.get('material-error').hidden, true);
});

test('an explicitly rejected create also cleans up, and a cleanup failure is reported', async t => {
  const ui = setup(t, { onCreate: async () => false, deleteFiles: async () => { throw new Error('Storage blocked'); } });
  ui.select([file('Keep.docx')]);
  await ui.get('use-material').click();
  assert.equal(ui.get('selected-files').children.length, 1);
  assert.equal(ui.api.isBusy(), false);
  assert.match(ui.get('material-error').textContent, /could not be removed from browser storage/);
});


test('an active link import blocks file browse, drops and document creation until it finishes', async t => {
  let blocked = false;
  const ui = setup(t, { isBlocked: () => blocked });
  ui.select([file('Saved.txt')]);
  blocked = true;
  assert.equal(ui.api.isBusy(), true);
  ui.select([file('Ignored.txt')]);
  ui.get('drop-zone').fire('drop', { dataTransfer: { files: [file('Dropped.txt')] } });
  ui.get('drop-zone').fire('keydown', { key: 'Enter' });
  ui.get('drop-zone').fire('click');
  assert.equal(ui.get('drop-zone').lastEvent.defaultPrevented, true);
  assert.equal(ui.get('file-input').clicks || 0, 0);
  await ui.get('use-material').click();
  assert.equal(ui.saved.length, 0);
  assert.equal(ui.get('selected-files').children.length, 1);
  blocked = false;
  assert.equal(ui.api.isBusy(), false);
  await ui.get('use-material').click();
  assert.equal(ui.saved.length, 1);
  assert.equal(ui.saved[0][0].name, 'Saved.txt');
});
