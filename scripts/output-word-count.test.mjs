import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { outputWordCount, outputSourceCount, createOutputBadges, createOutputWordCountBadge } from '../dist/outputs.js';
import { createEditorTabs } from '../dist/editor-tabs.js';

class Element {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = '';
    this.classList = { toggle() {} };
  }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return this.text ?? this.children.map(child => child.textContent).join(''); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  addEventListener() {}
}

function documentFor(t, roots = {}) {
  const names = ['document', 'ResizeObserver', 'requestAnimationFrame', 'getComputedStyle', 'setTimeout', 'clearTimeout'];
  const previous = Object.fromEntries(names.map(name => [name, globalThis[name]]));
  const duration = JSON.parse(readFileSync(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8')).component['editor-tab']['revision-dot-active-duration'].$value;
  let now = 0;
  let sequence = 0;
  const timers = new Map();
  globalThis.getComputedStyle = () => ({ getPropertyValue: () => `${duration.value}${duration.unit}` });
  globalThis.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { at: now + delay, callback }); return id; };
  globalThis.clearTimeout = id => timers.delete(id);
  globalThis.document = {
    documentElement: {},
    createElement: tag => new Element(tag),
    createTextNode: text => ({ textContent: text }),
    querySelector: selector => roots[selector],
  };
  globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  globalThis.requestAnimationFrame = () => {};
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete globalThis[name];
      else globalThis[name] = value;
    }
  });
  return { timers, tick(milliseconds) {
    const until = now + milliseconds;
    let next;
    while ((next = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort(([, a], [, b]) => a.at - b.at)[0])) {
      const [id, timer] = next;
      now = timer.at;
      timers.delete(id);
      timer.callback();
    }
    now = until;
  } };
}

const hasWords = badge => badge.className.split(' ').includes('output-badge--words');

test('actual draft counts use authoritative body operations without counting formatting, embeds, or other fields', () => {
  const output = {
    title: 'Do not count this headline', shareText: 'Do not count this subhead',
    document: { ops: [
      { insert: 'Hel', attributes: { bold: true } },
      { insert: 'lo world\n', attributes: { link: 'https://example.com/a-long-link' } },
      { insert: { image: 'image words do not count' } },
      { insert: 'Next\tparagraph\n' },
    ] },
    draftText: 'This stale fallback must not be counted',
  };
  assert.equal(outputWordCount(output), 4);
  assert.equal(outputWordCount({ document: { ops: [] }, draftText: 'Stale saved text' }), 0);
  assert.equal(outputWordCount({ document: { ops: [{ insert: '\n \t' }] }, draftText: 'Stale saved text' }), 0);
});

test('legacy drafts fall back to plain body text and handle empty or malformed content safely', () => {
  assert.equal(outputWordCount({ draftText: 'One\n\ntwo\tthree\u00a0four' }), 4);
  assert.equal(outputWordCount({ document: { ops: null }, draftText: 'Older body text' }), 3);
  assert.equal(outputWordCount({ draftText: ' \n\t' }), 0);
  assert.equal(outputWordCount({ draftText: null }), 0);
  assert.equal(outputWordCount(), 0);
});

test('source counts use captured history before stale cached counts or current indexes', () => {
  const first = { type: 'text', title: 'First saved source' };
  const second = { type: 'link', title: 'Second saved source', url: 'https://example.com/story' };
  assert.equal(outputSourceCount({ sourceSnapshots: [first], sourceCount: 3, selectedSourceIndexes: [0, 1, 2] }), 1);
  assert.equal(outputSourceCount({ sourceSnapshots: [], sourceCount: 3, selectedSourceIndexes: [0] }), 0);
  assert.equal(outputSourceCount({ sourceSnapshots: [first, null, undefined, [], 'invalid', 7, second] }), 2);
  assert.equal(outputSourceCount({ sourceSnapshots: [first, first] }), 2, 'Separate captured source entries retain their historical count');
});

test('legacy source counts preserve saved totals when details are unavailable and otherwise use valid unique indexes', () => {
  assert.equal(outputSourceCount({ sourceCount: 3 }), 3);
  assert.equal(outputSourceCount({ sourceSnapshots: null, sourceCount: 2, selectedSourceIndexes: [0] }), 2);
  assert.equal(outputSourceCount({ sourceCount: 0, selectedSourceIndexes: [0] }), 0);
  assert.equal(outputSourceCount({ sourceCount: -1, selectedSourceIndexes: [0, 0, 2, -1, 1.5, '2', null] }), 2);
  assert.equal(outputSourceCount({ sourceCount: '3', selectedSourceIndexes: [1, 1] }), 1);
  assert.equal(outputSourceCount(), 0);
});

test('shared badges show capitalized actual words before the source-count popover action', t => {
  documentFor(t);
  const output = { id: 'draft', title: 'Article', status: 'ready', labels: [{ key: 'format', label: 'Standard Format' }], draftText: 'actual '.repeat(642), sourceCount: 3 };
  const badges = createOutputBadges(output);
  assert.equal(badges.find(hasWords).textContent, '642 Words');
  assert.equal(badges.find(hasWords).attributes['aria-label'], '642 Words');
  const sources = badges.at(-1);
  assert.equal(sources.tagName, 'BUTTON');
  assert.equal(sources.dataset.variantSources, 'draft');
  assert.equal(sources.attributes['aria-controls'], undefined);
  assert.equal(sources.attributes['aria-haspopup'], 'dialog');
  assert.equal(sources.children.at(-1).textContent, '3 Sources');
  assert.equal(createOutputWordCountBadge({ ...output, draftText: 'one' }).textContent, '1 Word');
  assert.equal(createOutputBadges(output, { includeSourceCount: false }).at(-1).textContent, '642 Words');
  const headerBadges = createOutputBadges(output, { includeWordCount: false });
  assert.equal(headerBadges.some(hasWords), false);
  assert.equal(headerBadges[0].textContent, 'Standard Format');
  assert.equal(headerBadges.at(-1).dataset.variantSources, 'draft');
  assert.equal(headerBadges.at(-1).children.at(-1).textContent, '3 Sources');
});

test('legacy saved voice badges display current Us Weekly spelling without changing saved labels or authored content', t => {
  documentFor(t);
  const output = {
    id: 'saved', title: 'US Weekly coverage', draftText: 'Authored US Weekly text',
    toolPreferences: { voice: 'us-weekly' },
    labels: [
      { key: 'voice', label: 'US Weekly' },
      { key: 'audience', label: 'General Audience' },
      { key: 'format', label: 'US Weekly' },
      { key: 'voice', label: "Woman's World" },
    ],
  };
  const before = structuredClone(output);
  const options = { includeSourceCount: false, includeWordCount: false };
  const badges = createOutputBadges(output, options);
  for (const [index, expected] of ['Us Weekly', 'General Audience', 'US Weekly', "Woman's World"].entries()) {
    assert.equal(badges[index].textContent, expected);
    assert.equal(badges[index].title, expected);
    assert.equal(badges[index].attributes['aria-label'], expected);
  }
  const truncated = createOutputBadges(output, { ...options, maxLabelLength: 5 })[0];
  assert.equal(truncated.textContent, 'Us W…');
  assert.equal(truncated.title, 'Us Weekly');
  assert.equal(truncated.attributes['aria-label'], 'Us Weekly');
  assert.deepEqual(output, before);
});

test('pending, regenerating, and blank drafts omit word pills instead of displaying zero', t => {
  documentFor(t);
  for (const output of [
    { status: 'pending', draftText: 'Previously saved body' },
    { status: 'ready', needsRegeneration: true, draftText: 'Previously saved body' },
    { status: 'ready', document: { ops: [] }, draftText: 'Stale fallback' },
    { draftText: '  \n' },
    undefined,
  ]) {
    assert.equal(createOutputWordCountBadge(output), null);
    assert.equal(createOutputBadges(output).some(hasWords), false);
  }
});

test('draft tabs retain status and heading while body counts stay in shared metadata badges', t => {
  const root = new Element();
  const panel = new Element();
  panel.id = 'editor-canvas-content';
  documentFor(t, { '#editor-variant-tabs': root, '#editor-canvas-content': panel });
  const tabs = createEditorTabs({ onSelect() {} });
  const output = { id: 'draft', title: 'Same article', status: 'ready', document: { ops: [{ insert: 'Two words\n' }] }, draftText: 'Stale fallback has many words' };
  const project = { id: 'project', outputs: [output], selectedOutputId: output.id };
  tabs.render(project);
  const draftTab = root.children[0];
  assert.equal(draftTab.children.some(hasWords), false);
  assert.equal(draftTab.children.find(child => child.className === 'editor-tab-title').textContent, 'Same article');
  assert.equal(draftTab.attributes['aria-description'], 'Draft');
  assert.equal(createOutputBadges(output).find(hasWords).textContent, '2 Words');
  output.document = { ops: [{ insert: 'Now three words\n' }] };
  tabs.render(project);
  assert.equal(root.children[0], draftTab, 'body-count changes must not replace the focused tab');
  assert.equal(root.children[0].children.some(hasWords), false);
  assert.equal(createOutputBadges(output).find(hasWords).textContent, '3 Words');
  output.document = { ops: [] };
  tabs.render(project);
  assert.equal(root.children[0].children.some(hasWords), false);
  assert.equal(createOutputBadges(output).some(hasWords), false);
  output.cmsSentAt = 1;
  tabs.render(project);
  assert.equal(root.children[0].attributes['aria-description'], 'Sent');
  assert.equal(root.children[0].children.some(hasWords), false);
  tabs.render({ id: 'original', linkCards: true, outputs: [] });
  assert.equal(root.hidden, false);
  assert.equal(root.children[0].attributes['aria-label'], 'Project workspace');
  assert.equal(root.children[0].attributes['aria-description'], 'New draft workspace');
  assert.equal(root.children[0].children.length, 0, 'welcome workspace keeps a blank tab without a To Draft badge');
});

test('completed revision dots update even when the selected tab and title stay the same', t => {
  const root = new Element();
  const panel = new Element();
  panel.id = 'editor-canvas-content';
  documentFor(t, { '#editor-variant-tabs': root, '#editor-canvas-content': panel });
  const tabs = createEditorTabs({ onSelect() {} });
  const output = { id: 'draft', title: 'My draft', status: 'ready' };
  const project = { id: 'project', outputs: [output], selectedOutputId: output.id };
  const label = () => root.children[0].children.find(child => child.className === 'editor-tab-title');
  const dot = () => label().children.find(child => child.className === 'editor-tab-revision-dot');
  tabs.render(project);
  assert.equal(dot(), undefined);
  output.revisionUnread = true;
  tabs.render(project);
  assert.equal(dot().attributes['aria-hidden'], 'true');
  assert.equal(root.children[0].attributes['aria-label'], 'My draft');
  assert.match(root.children[0].attributes['aria-description'], /Revision complete/);
  output.revisionUnread = false;
  tabs.render(project);
  assert.equal(dot(), undefined);
  assert.equal(root.children[0].attributes['aria-description'], 'Draft');
});

test('only inactive revising tabs animate, retain their identity, and clean up on selection or completion', t => {
  const root = new Element();
  const panel = new Element();
  panel.id = 'editor-canvas-content';
  documentFor(t, { '#editor-variant-tabs': root, '#editor-canvas-content': panel });
  const controllers = [];
  const tabs = createEditorTabs({ onSelect() {}, createAnimation(options) {
    const controller = { element: new Element(), options, destroyed: false, destroy() { this.destroyed = true; } };
    controllers.push(controller);
    return controller;
  } });
  const first = { id: 'first', title: 'First draft', status: 'ready', toolPreferences: { format: 'listicle', audience: '', voice: 'us-weekly' } };
  const second = { id: 'second', title: 'Second draft', status: 'ready' };
  const project = { id: 'project', outputs: [first, second], selectedOutputId: first.id, outputProcessing: { kind: 'revision', ids: [first.id] } };
  tabs.render(project);
  assert.equal(controllers.length, 0, 'the selected draft uses the main editor loader');
  project.selectedOutputId = second.id;
  tabs.render(project);
  assert.equal(controllers.length, 1);
  assert.deepEqual(controllers[0].options.selectionKeys, ['format', 'voice']);
  assert.equal(root.children[0].dataset.revising, 'true');
  assert.equal(root.children[0].attributes['aria-label'], 'First draft');
  assert.equal(root.children[0].attributes['aria-description'], 'Revising Draft');
  assert.equal(controllers[0].element.attributes['aria-hidden'], 'true');
  tabs.render(project);
  assert.equal(controllers.length, 1, 'unchanged renders preserve animation progress');
  project.selectedOutputId = first.id;
  tabs.render(project);
  assert.equal(controllers[0].destroyed, true);
  project.selectedOutputId = second.id;
  tabs.render(project);
  assert.equal(controllers.length, 2);
  delete project.outputProcessing;
  first.revisionUnread = true;
  tabs.render(project);
  assert.equal(controllers[1].destroyed, true);
  assert.equal(root.children[0].dataset.revising, undefined);
  assert.match(root.children[0].attributes['aria-description'], /Revision complete/);
  assert.equal(root.children[1].attributes['aria-selected'], 'true', 'completion keeps the user on their chosen draft');
  tabs.destroy();
});

function unreadFixture(t) {
  const root = new Element();
  const panel = new Element();
  panel.id = 'editor-canvas-content';
  const clock = documentFor(t, { '#editor-variant-tabs': root, '#editor-canvas-content': panel });
  const reads = [];
  const tabs = createEditorTabs({ onSelect() {}, onRevisionRead(project, output) { reads.push([project.id, output.id]); } });
  const first = { id: 'first', title: 'First draft', status: 'ready', revisionUnread: true, revisionRequests: [{ completedAt: 1 }] };
  const second = { id: 'second', title: 'Second draft', status: 'ready', revisionUnread: true };
  const project = { id: 'project', outputs: [first, second], selectedOutputId: first.id };
  const dot = id => root.children.find(tab => tab.dataset.editorOutput === id)?.children.find(child => child.className === 'editor-tab-title')?.children.some(child => child.className === 'editor-tab-revision-dot');
  return { ...clock, reads, tabs, first, second, project, dot };
}

test('a selected revision dot clears at ten seconds, persists acknowledgement, and does not clear inactive dots', t => {
  const ui = unreadFixture(t);
  ui.tabs.render(ui.project);
  ui.tick(6000);
  ui.tabs.render(ui.project);
  ui.tick(3999);
  assert.equal(ui.dot('first'), true);
  assert.equal(ui.dot('second'), true);
  assert.deepEqual(ui.reads, []);
  ui.tick(1);
  assert.equal(ui.dot('first'), false);
  assert.equal(ui.first.revisionUnread, false);
  assert.equal(ui.dot('second'), true);
  assert.equal(ui.second.revisionUnread, true);
  assert.deepEqual(ui.reads, [['project', 'first']]);
  assert.equal(ui.project.selectedOutputId, 'first');
  ui.tick(60000);
  assert.equal(ui.dot('second'), true);
  assert.deepEqual(ui.reads, [['project', 'first']]);
  ui.tabs.destroy();
});

test('switching away cancels the selected-dot timer and keeps that draft unread', t => {
  const ui = unreadFixture(t);
  ui.second.revisionUnread = false;
  ui.tabs.render(ui.project);
  ui.tick(4000);
  ui.project.selectedOutputId = 'second';
  ui.tabs.render(ui.project);
  ui.tick(60000);
  assert.equal(ui.first.revisionUnread, true);
  assert.equal(ui.dot('first'), true);
  assert.equal(ui.timers.size, 0);
  assert.deepEqual(ui.reads, []);
  // Activating an unread tab acknowledges it through the app's existing onSelect handler.
  ui.first.revisionUnread = false;
  ui.project.selectedOutputId = 'first';
  ui.tabs.render(ui.project);
  assert.equal(ui.dot('first'), false);
  assert.equal(ui.timers.size, 0);
  ui.tabs.destroy();
});

test('a new revision cancels the old dot deadline and gets ten seconds after completion', t => {
  const ui = unreadFixture(t);
  ui.tabs.render(ui.project);
  ui.tick(9000);
  ui.project.outputProcessing = { kind: 'revision', ids: ['first'] };
  ui.tabs.render(ui.project);
  ui.tick(5000);
  assert.equal(ui.first.revisionUnread, true);
  assert.deepEqual(ui.reads, []);
  delete ui.project.outputProcessing;
  ui.first.revisionRequests.push({ completedAt: 2 });
  ui.tabs.render(ui.project);
  ui.tick(9999);
  assert.equal(ui.first.revisionUnread, true);
  ui.tick(1);
  assert.equal(ui.first.revisionUnread, false);
  assert.deepEqual(ui.reads, [['project', 'first']]);
  ui.tabs.destroy();
});

test('leaving the editor suspends acknowledgement and returning starts a fresh interval', t => {
  const ui = unreadFixture(t);
  ui.tabs.render(ui.project);
  ui.tick(5000);
  ui.tabs.suspend();
  ui.tick(60000);
  assert.equal(ui.first.revisionUnread, true);
  assert.deepEqual(ui.reads, []);
  ui.tabs.render(ui.project);
  ui.tick(9999);
  assert.equal(ui.first.revisionUnread, true);
  ui.tick(1);
  assert.equal(ui.first.revisionUnread, false);
  ui.tabs.destroy();
  assert.equal(ui.timers.size, 0);
});
