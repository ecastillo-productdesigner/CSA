import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudienceSimilarityDialog, similarityScoreBand } from '../dist/audience-similarity-dialog.js';
import { prepareAudienceSimilarities, audienceSimilarityPairKey } from '../dist/audience-similarity-summary.js';

class Element {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = { setProperty(name, value) { this[name] = value; } };
    this.dataset = {};
    this.isConnected = true;
    this.disabled = false;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.scrollWidth = 0;
    this.clientWidth = 0;
    this.classList = {
      add: name => { this.className = [...new Set([...(this.className || '').split(' ').filter(Boolean), name])].join(' '); },
      remove: name => { this.className = (this.className || '').split(' ').filter(value => value !== name).join(' '); },
    };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(name, listener) { const listeners = this.listeners.get(name) || []; listeners.push(listener); this.listeners.set(name, listeners); }
  removeEventListener(name, listener) { this.listeners.set(name, (this.listeners.get(name) || []).filter(value => value !== listener)); }
  fire(name, values = {}) {
    const event = { target: this, currentTarget: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {}, ...values };
    for (const listener of [...(this.listeners.get(name) || [])]) listener(event);
    return event;
  }
  focus() {
    if (document.activeElement === this) return;
    const previous = document.activeElement;
    document.activeElement = this;
    previous?.fire('blur', { relatedTarget: this });
    this.fire('focus', { relatedTarget: previous });
  }
  scrollIntoView(options) { this.lastScrollIntoView = options; }
  getBoundingClientRect() { return { width: 318, height: 90 }; }
  closest() { return null; }
  showModal() { this.open = true; }
  close() { if (this.open) { this.open = false; if (this.deferClose) this.closePending = true; else this.fire('close'); } }
  flushClose() { if (this.closePending) { this.closePending = false; this.fire('close'); } }
  remove() { this.isConnected = false; }
}
const find = (root, predicate) => predicate(root) ? root : root.children.map(child => find(child, predicate)).find(Boolean);
const cls = (root, name) => find(root, node => node.className?.split(' ').includes(name));
const all = (root, predicate) => [...(predicate(root) ? [root] : []), ...root.children.flatMap(child => all(child, predicate))];
const content = root => [root.textContent || '', ...root.children.map(content)].join(' ');
const draft = (id, audience = 'general', body = 'The city shared an update about the school today.', title = `Draft ${id}`) => ({ id, title, status: 'ready', toolPreferences: { audience }, draftText: body });
const groups = () => [{ key: 'general', label: 'General Audience', drafts: [draft('a'), draft('b'), draft('c', 'general', 'A completely unrelated account tells another story.', 'A third draft')] }, { key: 'wellness-enthusiast', label: 'Wellness Enthusiast', drafts: [draft('d', 'wellness-enthusiast'), draft('e', 'wellness-enthusiast')] }];
function setup(t, options = {}) {
  const previous = globalThis.document;
  const frames = new Map();
  const observers = [];
  const listeners = new Map();
  let frameId = 0;
  const view = {
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; },
    cancelAnimationFrame(id) { frames.delete(id); },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name, listener) { if (listeners.get(name) === listener) listeners.delete(name); },
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; this.targets = []; this.disconnected = false; observers.push(this); }
      observe(element) { this.targets.push(element); }
      disconnect() { this.disconnected = true; this.targets = []; }
    },
  };
  const doc = { activeElement: null, defaultView: view,
    createElement(tag) { return Object.assign(new Element(tag), { ownerDocument: doc }); } };
  doc.body = doc.createElement('body');
  globalThis.document = doc;
  const editors = [];
  const createEditor = ({ host, onSave, onBack }) => {
    const editor = {
      host, onSave, onBack, opened: [], destroyed: false,
      open(draft) {
        this.opened.push(draft);
        this.input = doc.createElement('input');
        this.input.value = draft.title;
        host.replaceChildren(this.input);
        this.input.focus();
      },
      destroy() { this.destroyed = true; host.replaceChildren(); },
    };
    editors.push(editor);
    return editor;
  };
  const recalculations = [];
  const handoffStates = [];
  const onRecalculate = request => {
    recalculations.push(request);
    handoffStates.push({ open: controller.isOpen, cards: pairs.children.length, rows: comparisons().length, editorDestroyed: editors.at(-1)?.destroyed, focus: doc.activeElement });
  };
  const controller = createAudienceSimilarityDialog({ createEditor, onRecalculate, ...options });
  t.after(() => { controller.destroy(); globalThis.document = previous; });
  const dialog = controller.element;
  const pairs = cls(dialog, 'audience-similarity-pairs');
  const results = cls(dialog, 'audience-similarity-results');
  const comparisons = () => all(results, node => node.className?.split(' ').includes('audience-similarity-comparison'));
  const comparison = id => comparisons().find(node => node.dataset.comparisonId === id);
  const fields = () => pairs.children.map(card => cls(card, 'audience-similarity-draft-select'));
  const card = id => pairs.children.find(card => cls(card, 'audience-similarity-draft-select')?.dataset.draftId === id);
  return {
    controller, dialog, pairs, strip: cls(dialog, 'audience-similarity-card-strip'),
    results, comparisons, comparison, reference: cls(dialog, 'audience-similarity-reference'), status: cls(dialog, 'audience-similarity-status'),
    metric: (key, comparisonId) => { const scope = comparisonId ? comparison(comparisonId) : results; return scope && find(scope, node => node.dataset.metric === key); },
    dismiss: cls(dialog, 'icon-button'), done: cls(dialog, 'primary-button'),
    body: cls(dialog, 'audience-similarity-body'), footer: cls(dialog, 'audience-similarity-dialog-footer'),
    editorHost: cls(dialog, 'audience-similarity-editor-host'), editors, editor: () => editors.at(-1),
    recalculations, handoffStates, resume: (payload, request = recalculations.at(-1)) => controller.open({ ...payload, ...request }),
    fields, card,
    field: id => fields().find(field => field.dataset.draftId === id),
    edit: id => { const wrapper = card(id); return wrapper && cls(wrapper, 'audience-similarity-draft-edit'); },
    rowEdit: id => { const row = comparison(id); return row && cls(row, 'audience-similarity-row-edit'); },
    draftIds: () => fields().map(field => field.dataset.draftId),
    selectedIds: () => fields().filter(field => field.dataset.selected === 'true').map(field => field.dataset.draftId),
    frames, observers, listeners,
    flushFrames() { const pending = [...frames.values()]; frames.clear(); for (const callback of pending) callback(); },
  };
}

test('score colors keep exact threshold values in the lower band and ignore unavailable scores', () => {
  for (const [value, expected] of [[0, 'low'], [50, 'low'], [51, 'medium'], [75, 'medium'], [76, 'high'], [100, 'high']]) {
    assert.equal(similarityScoreBand(value), expected, `${value}%`);
  }
  for (const value of [null, undefined, NaN, Infinity, -Infinity]) assert.equal(similarityScoreBand(value), null);
});

test('opens a focused modal with one reference, all draft cards, and individually labeled comparison scores', t => {
  let closePanels = 0;
  const ui = setup(t, { closePanels() { closePanels++; } });
  assert.equal(ui.controller.open({ groups: groups() }), true);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(closePanels, 1);
  assert.equal(ui.dialog.getAttribute('aria-labelledby'), 'audience-similarity-dialog-title');
  assert.equal(document.activeElement, ui.dismiss);
  assert.equal(find(ui.dialog, node => node.tagName === 'select' || node.tagName === 'input' || node.tagName === 'nav'), undefined);
  assert.equal(cls(ui.dialog, 'audience-similarity-previous'), undefined);
  assert.equal(cls(ui.dialog, 'audience-similarity-next'), undefined);
  assert.equal(cls(ui.dialog, 'audience-similarity-position'), undefined);
  assert.deepEqual(ui.strip.children, [ui.pairs]);
  assert.equal(ui.pairs.getAttribute('role'), 'group');
  assert.equal(ui.pairs.getAttribute('aria-label'), 'Choose a reference draft');
  assert.doesNotMatch(content(ui.dialog), /Choose a Reference Draft|Similarity to Each Other Draft/);
  assert.equal(ui.reference, undefined, 'the selected card identifies the reference without a duplicate summary');
  assert.deepEqual(cls(ui.dialog, 'audience-similarity-body').children, [ui.strip, ui.results, ui.status]);
  assert.equal(cls(ui.dialog, 'audience-similarity-summary'), undefined);
  assert.doesNotMatch(content(ui.dialog), /Higher percentages mean more similarity/);
  assert.deepEqual(ui.draftIds(), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(ui.selectedIds(), ['a']);
  for (const field of ui.fields()) {
    assert.equal(field.tagName, 'button');
    assert.equal(field.type, 'button');
    assert.equal(field.getAttribute('aria-pressed'), field.dataset.selected);
    assert.match(field.getAttribute('aria-label'), /^Compare draft: /);
    const chips = cls(field, 'audience-similarity-draft-chips');
    const title = cls(field, 'audience-similarity-draft-title');
    assert.equal(chips.tagName, 'span');
    assert.equal(title.tagName, 'span');
    assert.equal(cls(title, 'output-card-title'), title);
    assert.deepEqual(field.children, [chips, title]);
  }
  assert.equal(cls(ui.field('a'), 'audience-similarity-draft-title').textContent, 'Draft a');
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['a', 'b'], ['a', 'c']]);
  for (const section of ui.comparisons()) {
    const heading = cls(section, 'audience-similarity-comparison-heading');
    assert.equal(heading.tagName, 'th');
    assert.equal(heading.getAttribute('scope'), 'row');
    assert.equal(heading.getAttribute('aria-label'), `Comparison: Draft a and ${section.dataset.comparisonId === 'b' ? 'Draft b' : 'A third draft'}`);
    assert.equal(heading.children.length, 1);
    for (const chip of all(heading, node => node.className?.split(' ').includes('audience-similarity-comparison-audience'))) {
      assert.equal(cls(chip, 'audience-similarity-comparison-audience'), chip);
      assert.equal(chip.textContent, 'General Audience');
    }
    assert.doesNotMatch(content(heading), /Comparing:|Against:|Draft a|Draft b|A third draft/);
    assert.equal(section.children.filter(cell => cell.dataset.metric).length, 5);
    assert.ok(cls(section, 'audience-similarity-verdict'));
  }
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '100%');
  assert.equal(cls(ui.metric('body', 'c'), 'audience-similarity-table-value').textContent, '0%');
  assert.notEqual(content(cls(ui.comparison('b'), 'audience-similarity-verdict')), content(cls(ui.comparison('c'), 'audience-similarity-verdict')));
  assert.equal(cls(ui.metric('body'), 'audience-similarity-table-value').dataset.band, 'high');
  assert.equal(cls(ui.metric('quotes'), 'audience-similarity-table-value').textContent, '—');
  assert.match(cls(ui.metric('quotes'), 'audience-similarity-table-value').getAttribute('aria-label'), /Not available/);
  assert.equal(cls(ui.metric('quotes'), 'audience-similarity-table-value').dataset.band, undefined);
  assert.equal(cls(ui.results, 'audience-similarity-rings'), undefined);
});

for (const count of [3, 4]) {
  test(`${count} drafts produce ${count - 1} separate comparisons with no self comparison`, t => {
    const ui = setup(t);
    const source = [{ key: 'selected', label: 'Selected Drafts', drafts: Array.from({ length: count }, (_, index) => draft(String(index + 1))) }];
    ui.controller.open({ groups: source });
    assert.equal(ui.comparisons().length, count - 1);
    assert.deepEqual(ui.selectedIds(), ['1']);
    assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), source[0].drafts.slice(1).map(draft => draft.id));
    for (const section of ui.comparisons()) {
      assert.equal(section.dataset.referenceId, '1');
      assert.notEqual(section.dataset.referenceId, section.dataset.comparisonId);
      assert.equal(section.children.filter(cell => cell.dataset.metric).length, 5);
    }
  });
}

test('choosing a reference recalculates every comparison without rebuilding or scrolling the cards or mutating drafts', t => {
  const ui = setup(t);
  const source = groups().slice(0, 1);
  const before = structuredClone(source);
  ui.controller.open({ groups: source });
  const fields = [...ui.fields()];
  ui.pairs.scrollLeft = 180;
  ui.field('c').fire('click');
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['c', 'a'], ['c', 'b']]);
  for (const id of ['a', 'b']) {
    assert.equal(cls(ui.metric('body', id), 'audience-similarity-table-value').textContent, '0%');
    assert.equal(cls(ui.metric('body', id), 'audience-similarity-table-value').dataset.band, 'low');
    assert.equal(cls(ui.comparison(id), 'audience-similarity-comparison-heading').getAttribute('aria-label'), `Comparison: A third draft and Draft ${id}`);
  }
  assert.equal(ui.status.textContent, 'Comparing “A third draft” with 2 other drafts');
  ui.field('b').fire('click');
  assert.deepEqual(ui.selectedIds(), ['b']);
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['b', 'a'], ['b', 'c']]);
  assert.equal(cls(ui.metric('body', 'a'), 'audience-similarity-table-value').textContent, '100%');
  assert.equal(cls(ui.metric('body', 'c'), 'audience-similarity-table-value').textContent, '0%');
  fields.forEach((field, index) => assert.equal(ui.fields()[index], field));
  assert.equal(ui.pairs.scrollLeft, 180);
  assert.deepEqual(source, before);
});

test('clicking the selected reference keeps exactly one reference and all its comparisons', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups() });
  ui.field('a').fire('click');
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.equal(ui.field('a').getAttribute('aria-pressed'), 'true');
  assert.equal(ui.comparisons().length, 2);
  ui.field('b').fire('click');
  ui.field('b').fire('click');
  assert.deepEqual(ui.selectedIds(), ['b']);
  assert.equal(ui.field('a').getAttribute('aria-pressed'), 'false');
  assert.equal(ui.field('b').getAttribute('aria-pressed'), 'true');
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['a', 'c']);
  assert.equal(cls(ui.results, 'audience-similarity-empty'), undefined);
});

test('changing reference across groups shows only compatible comparisons', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups() });
  ui.field('d').fire('click');
  assert.deepEqual(ui.selectedIds(), ['d']);
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['d', 'e']]);
  assert.equal(cls(ui.metric('body', 'e'), 'audience-similarity-table-value').textContent, '100%');
  assert.equal(ui.status.textContent, 'Comparing “Draft d” with 1 other draft');
  ui.field('e').fire('click');
  assert.deepEqual(ui.selectedIds(), ['e']);
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['e', 'd']]);
  ui.field('a').fire('click');
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['b', 'c']);
});

test('overlapping groups render each draft once without granting transitive pair eligibility', t => {
  const ui = setup(t);
  const [a, b, c] = groups()[0].drafts;
  const source = [{ key: 'first', label: 'First', drafts: [a, b] }, { key: 'second', label: 'Second', drafts: [b, c] }];
  const before = structuredClone(source);
  ui.controller.open({ groups: source });
  assert.deepEqual(ui.draftIds(), ['a', 'b', 'c']);
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['b']);
  ui.field('b').fire('click');
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['a', 'c']);
  ui.field('c').fire('click');
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['b']);
  assert.equal(ui.comparison('a'), undefined);
  assert.deepEqual(source, before);
});

test('keyboard row navigation reveals focused cards without changing selection', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups() });
  ui.field('a').focus();
  assert.equal(ui.field('a').fire('keydown', { key: 'End' }).defaultPrevented, true);
  assert.equal(document.activeElement, ui.field('e'));
  assert.deepEqual(ui.field('e').lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  ui.field('e').lastScrollIntoView = null;
  ui.field('e').fire('keydown', { key: 'End' });
  assert.deepEqual(ui.field('e').lastScrollIntoView, { block: 'nearest', inline: 'nearest' });
  ui.field('e').fire('keydown', { key: 'ArrowLeft' });
  assert.equal(document.activeElement, ui.field('d'));
  ui.field('d').fire('keydown', { key: 'Home' });
  assert.equal(document.activeElement, ui.field('a'));
  ui.field('a').fire('keydown', { key: 'ArrowRight' });
  assert.equal(document.activeElement, ui.field('b'));
  assert.deepEqual(ui.selectedIds(), ['a']);
  for (const key of [' ', 'Enter']) assert.equal(ui.field('b').fire('keydown', { key }).defaultPrevented, false, 'native button activation is preserved');
});

test('edge fades follow scrolling and resizing and observers and frames are cleaned up', t => {
  const ui = setup(t);
  ui.pairs.scrollWidth = 1000;
  ui.pairs.clientWidth = 300;
  ui.controller.open({ groups: groups() });
  assert.equal(ui.strip.dataset.fadeStart, 'false');
  assert.equal(ui.strip.dataset.fadeEnd, 'true');
  assert.equal(ui.observers[0].targets.length, 6);
  assert.equal(ui.frames.size, 1);
  ui.flushFrames();
  ui.pairs.scrollLeft = 200;
  ui.pairs.fire('scroll');
  ui.pairs.fire('scroll');
  assert.equal(ui.frames.size, 1);
  ui.flushFrames();
  assert.equal(ui.strip.dataset.fadeStart, 'true');
  assert.equal(ui.strip.dataset.fadeEnd, 'true');
  ui.pairs.scrollLeft = 700;
  ui.pairs.fire('scroll');
  ui.flushFrames();
  assert.equal(ui.strip.dataset.fadeStart, 'true');
  assert.equal(ui.strip.dataset.fadeEnd, 'false');
  ui.pairs.clientWidth = 1100;
  ui.observers[0].callback();
  ui.flushFrames();
  assert.equal(ui.strip.dataset.fadeStart, 'false');
  assert.equal(ui.strip.dataset.fadeEnd, 'false');
  ui.listeners.get('resize')();
  assert.equal(ui.frames.size, 1);
  ui.controller.close();
  assert.equal(ui.observers[0].disconnected, true);
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.listeners.has('resize'), false);
  assert.equal(ui.strip.dataset.fadeStart, 'false');
  assert.equal(ui.strip.dataset.fadeEnd, 'false');
  ui.controller.open({ groups: groups() });
  assert.equal(ui.pairs.scrollLeft, 0);
  assert.equal(ui.observers.length, 2);
  ui.controller.destroy();
  assert.equal(ui.observers[1].disconnected, true);
  assert.equal(ui.frames.size, 0);
  assert.equal(ui.listeners.has('resize'), false);
  ui.observers[1].callback();
  assert.equal(ui.frames.size, 0);
});

for (const action of ['done', 'dismiss', 'escape']) {
  test(`${action} closes and returns focus to opener`, t => {
    const ui = setup(t);
    const opener = new Element('button');
    ui.controller.open({ groups: groups(), opener });
    if (action === 'escape') assert.equal(ui.dialog.fire('cancel').defaultPrevented, true);
    else ui[action].fire('click');
    assert.equal(ui.controller.isOpen, false);
    assert.equal(document.activeElement, opener);
    assert.equal(ui.results.children.length, 0);
    assert.equal(ui.fields().length, 0);
  });
}

test('hostile long titles stay complete inert text in the selected draft card', t => {
  const ui = setup(t);
  const source = groups().slice(0, 1);
  source[0].drafts = source[0].drafts.slice(0, 2);
  source[0].drafts[0].title = '<img src=x onerror=alert(1)> A very long headline that should wrap';
  ui.controller.open({ groups: source });
  const visible = cls(ui.field('a'), 'audience-similarity-draft-title');
  assert.equal(visible.textContent, source[0].drafts[0].title);
  assert.equal(visible.title, source[0].drafts[0].title);
  assert.equal(visible.children.length, 0);
  assert.equal(ui.field('a').getAttribute('aria-label'), `Compare draft: ${source[0].drafts[0].title}`);
});

test('reopening refreshes comparison scores and restores the first reference', t => {
  const ui = setup(t);
  const source = groups();
  ui.controller.open({ groups: source });
  ui.field('c').fire('click');
  ui.controller.close();
  source[0].drafts[1].draftText = 'Distinct unrelated galaxies sparkle beyond mountains.';
  ui.controller.open({ groups: source });
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.deepEqual(ui.draftIds(), ['a', 'b', 'c', 'd', 'e']);
  assert.equal(cls(ui.metric('body'), 'audience-similarity-table-value').textContent, '0%');
});

test('rejects empty, duplicate, and incomplete groups', t => {
  const ui = setup(t);
  assert.equal(ui.controller.open(), false);
  assert.equal(ui.controller.open({ groups: [] }), false);
  const malformed = [
    { key: 'a', label: 'A', drafts: [draft('a')] },
    { key: 'a', label: 'A', drafts: [draft('a'), draft('a')] },
    { key: 'a', label: 'A', drafts: [draft('a'), { ...draft('b'), status: 'pending' }] },
  ];
  for (const group of malformed) assert.equal(ui.controller.open({ groups: [group] }), false);
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.controller.open({ groups: [...malformed, groups()[1]] }), true);
  assert.deepEqual(ui.draftIds(), ['d', 'e']);
});

test('invalidated drafts clear their stale comparison scores while other comparisons remain available', t => {
  const ui = setup(t);
  const source = groups();
  ui.controller.open({ groups: source });
  source[0].drafts[0].needsRegeneration = true;
  ui.field('b').fire('click');
  assert.deepEqual(ui.selectedIds(), ['b']);
  const assertUnavailable = row => {
    assert.equal(row.children.length, 7);
    for (const cell of row.children.slice(1)) {
      assert.equal(content(cell).trim(), '—');
      assert.ok(find(cell, node => /Not available/.test(node.getAttribute('aria-label') || '')));
    }
    for (const value of all(row, node => node.className?.split(' ').includes('audience-similarity-table-value'))) {
      assert.equal(value.dataset.band, undefined);
    }
  };
  assertUnavailable(ui.comparison('a'));
  assert.equal(cls(ui.metric('body', 'c'), 'audience-similarity-table-value').textContent, '0%');
  ui.field('a').fire('click');
  assert.deepEqual(ui.selectedIds(), ['a']);
  for (const row of ui.comparisons()) assertUnavailable(row);
});

test('destroy closes, removes dialog, and prevents later openings', t => {
  const ui = setup(t);
  assert.equal(ui.listeners.has('pagehide'), true);
  ui.controller.open({ groups: groups() });
  assert.equal(ui.controller.open({ groups: groups() }), false);
  ui.controller.destroy();
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.dialog.isConnected, false);
  assert.equal(ui.listeners.has('pagehide'), false);
  assert.equal(ui.controller.open({ groups: groups() }), false);
});

test('selected drafts can have different audiences and never include unselected drafts', t => {
  const ui = setup(t);
  const selection = [{ key: 'selected-drafts', label: 'Selected Drafts', drafts: [draft('a'), draft('b', 'wellness-enthusiast'), draft('c', '')] }];
  assert.equal(ui.controller.open({ groups: selection }), true);
  assert.match(content(ui.dialog), /Audience Similarity/);
  assert.equal(cls(ui.field('a'), 'audience-similarity-draft-audience').textContent, 'General Audience');
  assert.equal(cls(ui.field('b'), 'audience-similarity-draft-audience').textContent, 'Wellness Enthusiast');
  assert.equal(cls(ui.metric('body'), 'audience-similarity-table-value').textContent, '100%');
  assert.deepEqual(ui.draftIds(), ['a', 'b', 'c']);
  ui.field('c').fire('click');
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['a', 'b']);
  const audience = cls(ui.field('c'), 'audience-similarity-draft-audience');
  assert.equal(audience.textContent, 'None Selected');
  assert.equal(audience.getAttribute('aria-label'), 'Audience: None Selected');
});


test('comparison headings show the target audience and Edit while preserving full names accessibly', t => {
  const ui = setup(t);
  const longAudience = 'Community members who follow neighborhood schools';
  const source = [{ key: 'selected', label: 'Selected Drafts', drafts: [
    draft('a', 'general', undefined, 'The first headline'),
    draft('b', longAudience, undefined, 'The second headline'),
    draft('c', '', undefined, 'The third headline'),
  ] }];
  ui.controller.open({ groups: source });
  const heading = cls(ui.comparison('b'), 'audience-similarity-comparison-heading');
  assert.equal(heading.getAttribute('aria-label'), 'Comparison: The first headline and The second headline');
  assert.equal(heading.tagName, 'th');
  assert.equal(heading.getAttribute('scope'), 'row');
  assert.equal(heading.children.length, 1);
  const chip = cls(heading, 'audience-similarity-comparison-audience');
  assert.equal(chip.textContent, 'Community members w…');
  assert.equal(chip.getAttribute('aria-label'), `Audience: ${longAudience}`);
  assert.equal(cls(chip, 'audience-similarity-comparison-audience'), chip);
  assert.equal(cls(chip, 'output-badge--audience'), chip);
  assert.doesNotMatch(content(heading), /Comparing:|Against:|The first headline|The second headline/);
  const emptyHeading = cls(ui.comparison('c'), 'audience-similarity-comparison-heading');
  assert.equal(emptyHeading.children.length, 1);
  const empty = cls(emptyHeading, 'audience-similarity-comparison-audience');
  assert.equal(empty.textContent, 'None Selected');
  assert.equal(empty.getAttribute('aria-label'), 'Audience: None Selected');
  assert.equal(cls(empty, 'audience-similarity-draft-audience--empty'), empty);
  assert.equal(cls(empty, 'output-badge--audience'), undefined);
  ui.field('b').fire('click');
  const changedHeading = cls(ui.comparison('a'), 'audience-similarity-comparison-heading');
  assert.equal(changedHeading.getAttribute('aria-label'), 'Comparison: The second headline and The first headline');
  assert.equal(changedHeading.children.length, 1);
  assert.equal(cls(changedHeading, 'audience-similarity-comparison-audience').getAttribute('aria-label'), 'Audience: General Audience');
  assert.equal(cls(changedHeading, 'audience-similarity-comparison-audience').textContent, 'General Audience');
  assert.equal(cls(ui.field('a'), 'audience-similarity-draft-title').textContent, 'The first headline');
  assert.equal(cls(ui.field('b'), 'audience-similarity-draft-title').textContent, 'The second headline');
  assert.deepEqual(ui.selectedIds(), ['b']);
});


test('each of three audience references shows only the other two target labels and their pair-specific metrics', t => {
  const ui = setup(t);
  const audiences = [
    { id: 'wellness', value: 'wellness-enthusiast', label: 'Wellness Enthusiast', chip: 'Wellness Enthusiast', title: 'Wellness briefing' },
    { id: 'fashion', value: 'trend-chasing-fashion-shopper', label: 'Trend-Chasing Fashion Shopper', chip: 'Trend-Chasing Fashi…', title: 'Fashion briefing' },
    { id: 'culture', value: 'millennial-pop-culture', label: 'Millennial Pop-Culture Fan', chip: 'Millennial Pop-Cult…', title: 'Culture briefing' },
  ];
  const selectedDrafts = audiences.map(audience => draft(audience.id, audience.value,
    audience.id === 'culture' ? 'Distant galaxies sparkle beyond mountain peaks.' : 'The city shared an update about the school today.', audience.title));
  assert.equal(ui.controller.open({ groups: [{ key: 'selected', label: 'Selected Drafts', drafts: selectedDrafts }] }), true);

  for (const reference of audiences) {
    ui.field(reference.id).fire('click');
    const targets = audiences.filter(audience => audience.id !== reference.id);
    assert.deepEqual(ui.selectedIds(), [reference.id]);
    assert.equal(ui.comparisons().length, 2);
    assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]),
      targets.map(target => [reference.id, target.id]));
    assert.equal(ui.comparison(reference.id), undefined, 'a reference never compares with itself');
    assert.deepEqual(ui.comparisons().map(section => cls(section, 'audience-similarity-comparison-audience').getAttribute('aria-label')),
      targets.map(target => `Audience: ${target.label}`));
    for (const target of targets) {
      const section = ui.comparison(target.id);
      const heading = cls(section, 'audience-similarity-comparison-heading');
      assert.equal(heading.tagName, 'th');
      assert.equal(heading.getAttribute('scope'), 'row');
      assert.equal(heading.getAttribute('aria-label'), `Comparison: ${reference.title} and ${target.title}`);
      assert.equal(heading.children.length, 1);
      const chip = cls(heading, 'audience-similarity-comparison-audience');
      assert.equal(chip.textContent, target.chip);
      assert.equal(chip.getAttribute('aria-label'), `Audience: ${target.label}`);
      assert.notEqual(chip.getAttribute('aria-label'), `Audience: ${reference.label}`);
      assert.deepEqual(section.children.filter(cell => cell.dataset.metric).map(cell => cell.dataset.metric),
        ['body', 'headline', 'opening', 'quotes', 'structure']);
      const expectedOverlap = reference.id === 'culture' || target.id === 'culture' ? '0%' : '100%';
      assert.equal(cls(ui.metric('body', target.id), 'audience-similarity-table-value').textContent, expectedOverlap);
      assert.equal(cls(ui.metric('opening', target.id), 'audience-similarity-table-value').textContent, expectedOverlap);
      assert.equal(cls(ui.metric('structure', target.id), 'audience-similarity-table-value').textContent, '100%');
      assert.match(cls(ui.metric('quotes', target.id), 'audience-similarity-table-value').getAttribute('aria-label'), /Not available/);
      assert.ok(cls(section, 'audience-similarity-verdict'));
    }
    assert.equal(ui.status.textContent, `Comparing “${reference.title}” with 2 other drafts`);
  }
});


test('draft and comparison chips retain compact labels and full-name tooltips while card focus preserves the reference', t => {
  const ui = setup(t);
  const longAudience = 'Community members who follow neighborhood schools';
  const compactAudience = 'Community members w…';
  ui.controller.open({ groups: [{ key: 'selected', label: 'Selected Drafts', drafts: [
    draft('a', 'general'), draft('b', longAudience), draft('c', 'wellness-enthusiast'),
  ] }] });
  const card = ui.field('b');
  const cardChip = cls(card, 'audience-similarity-draft-audience');
  const comparison = ui.comparison('b');
  const resultChip = cls(comparison, 'audience-similarity-comparison-audience');
  const originalComparisons = [...ui.comparisons()];
  for (const chip of [cardChip, resultChip]) {
    assert.equal(chip.textContent, compactAudience);
    assert.equal(chip.getAttribute('title'), longAudience);
    assert.equal(chip.getAttribute('aria-label'), `Audience: ${longAudience}`);
    assert.equal(chip.getAttribute('tabindex'), null, 'chips do not introduce extra keyboard stops');
    chip.fire('mouseenter');
    chip.fire('focus');
    assert.equal(chip.textContent, compactAudience);
    chip.fire('mouseleave');
    chip.fire('blur');
    assert.equal(chip.textContent, compactAudience);
  }

  card.focus();
  assert.equal(cardChip.textContent, compactAudience);
  assert.deepEqual(card.lastScrollIntoView, { block: 'nearest', inline: 'nearest' }, 'the existing card focus handler still reveals the card');
  assert.deepEqual(ui.selectedIds(), ['a'], 'focus does not select a new reference');
  assert.equal(cls(comparison, 'audience-similarity-comparison-heading').getAttribute('aria-label'), 'Comparison: Draft a and Draft b');

  ui.dismiss.focus();
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.ok(ui.comparisons().every((section, index) => section === originalComparisons[index]), 'chip interaction never rebuilds comparison results');
});


test('draft cards expose separate native Compare and Edit buttons without nested controls', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups() });
  assert.equal(ui.editorHost.hidden, true);
  assert.deepEqual(ui.dialog.children.slice(-3), [ui.body, ui.editorHost, ui.footer]);
  assert.equal(cls(ui.dialog, 'audience-similarity-recalculating'), undefined);
  for (const id of ui.draftIds()) {
    const card = ui.card(id);
    const select = ui.field(id);
    const edit = ui.edit(id);
    assert.equal(card.tagName, 'div');
    assert.equal(cls(card, 'audience-similarity-draft-card'), card);
    assert.equal(card.dataset.selected, select.dataset.selected);
    assert.ok(card.children.includes(select));
    assert.ok(card.children.includes(edit));
    assert.equal(edit.tagName, 'button');
    assert.equal(edit.type, 'button');
    assert.equal(edit.getAttribute('aria-label'), select.getAttribute('aria-label').replace('Compare draft:', 'Edit draft:'));
    assert.equal(find(select, node => node !== select && node.tagName === 'button'), undefined);
    assert.equal(find(edit, node => node !== edit && node.tagName === 'button'), undefined);
  }
});

test('editing a different card switches the same modal and Back restores reference, results, scroll, and focus', t => {
  const ui = setup(t);
  const source = groups().slice(0, 1);
  const before = structuredClone(source);
  ui.controller.open({ groups: source });
  ui.field('c').fire('click');
  ui.pairs.scrollLeft = 180;
  ui.body.scrollTop = 120;
  const originalResults = [...ui.comparisons()];
  const edit = ui.edit('b');
  edit.focus();
  edit.fire('click');
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.editorHost.hidden, false);
  assert.equal(ui.body.hidden, true);
  assert.equal(ui.footer.hidden, true);
  assert.equal(find(ui.dialog, node => node.id === ui.dialog.getAttribute('aria-labelledby')).textContent, 'Edit Draft');
  assert.equal(ui.dismiss.getAttribute('aria-label'), 'Close draft editor');
  assert.equal(ui.editor().opened.at(-1), source[0].drafts[1]);
  assert.equal(document.activeElement, ui.editor().input);
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.deepEqual(source, before);
  ui.editor().onBack();
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.editorHost.hidden, true);
  assert.equal(ui.body.hidden, false);
  assert.equal(ui.footer.hidden, false);
  assert.equal(find(ui.dialog, node => node.id === ui.dialog.getAttribute('aria-labelledby')).textContent, 'Audience Similarity');
  assert.equal(ui.dismiss.getAttribute('aria-label'), 'Close audience similarity');
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.deepEqual(ui.comparisons(), originalResults);
  assert.equal(ui.pairs.scrollLeft, 180);
  assert.equal(ui.body.scrollTop, 120);
  assert.equal(document.activeElement, edit);
  assert.deepEqual(source, before);
});

test('saving waits for persistence, updates only the edited draft, and refreshes comparison content and scores', async t => {
  let finishSave;
  const calls = [];
  const ui = setup(t, { onSaveDraft(target, patch) {
    calls.push({ target, patch });
    return new Promise(resolve => { finishSave = resolve; });
  } });
  const source = groups().slice(0, 1);
  const target = source[0].drafts[1];
  target.toolPreferences = { audience: 'general', format: 'listicle', voice: 'house-standard' };
  const before = structuredClone(source);
  ui.controller.open({ groups: source });
  ui.pairs.scrollLeft = 160;
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '100%');
  ui.edit('b').fire('click');
  const patch = { title: 'Revised second draft', draftText: 'Astronauts explore distant planets beyond our galaxy.' };
  const saving = ui.editor().onSave(target, patch);
  assert.deepEqual(calls, [{ target, patch }]);
  assert.deepEqual(source, before);
  assert.equal(ui.editorHost.hidden, false);
  finishSave(true);
  assert.equal(await saving, true);
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.recalculations.length, 1);
  assert.equal(ui.fields().length, 0);
  assert.equal(ui.comparisons().length, 0);
  assert.equal(ui.resume({ groups: source }), true);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.editorHost.hidden, true);
  assert.equal(ui.body.hidden, false);
  assert.equal(ui.footer.hidden, false);
  assert.equal(target.title, patch.title);
  assert.equal(target.draftText, patch.draftText);
  assert.deepEqual(target.toolPreferences, before[0].drafts[1].toolPreferences);
  assert.deepEqual(source[0].drafts[0], before[0].drafts[0]);
  assert.deepEqual(source[0].drafts[2], before[0].drafts[2]);
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.equal(ui.pairs.scrollLeft, 160);
  assert.equal(ui.field('b').getAttribute('aria-label'), `Compare draft: ${patch.title}`);
  assert.equal(ui.edit('b').getAttribute('aria-label'), `Edit draft: ${patch.title}`);
  assert.equal(cls(ui.comparison('b'), 'audience-similarity-comparison-heading').getAttribute('aria-label'), `Comparison: Draft a and ${patch.title}`);
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '0%');
  assert.equal(document.activeElement, ui.edit('b'));
});

test('a rejected save keeps the original draft and editor open for correction', async t => {
  let attempts = 0;
  const ui = setup(t, { onSaveDraft: async () => { attempts++; return false; } });
  const source = groups().slice(0, 1);
  const before = structuredClone(source);
  ui.controller.open({ groups: source });
  ui.edit('b').fire('click');
  const editor = ui.editor();
  await editor.onSave(source[0].drafts[1], { title: 'Unsaved title', draftText: 'Unsaved body.' });
  assert.equal(attempts, 1);
  assert.equal(ui.recalculations.length, 0);
  assert.deepEqual(source, before);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.editorHost.hidden, false);
  assert.equal(ui.body.hidden, true);
  assert.equal(ui.footer.hidden, true);
  assert.equal(ui.editor(), editor);
  assert.equal(editor.destroyed, false);
  assert.deepEqual(ui.selectedIds(), ['a']);
  editor.onBack();
  assert.equal(ui.field('b').getAttribute('aria-label'), 'Compare draft: Draft b');
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '100%');
});

for (const action of ['dismiss', 'escape', 'destroy']) {
  test(`closing the draft editor via ${action} destroys it and restores the opener`, t => {
    const ui = setup(t);
    const opener = document.createElement('button');
    opener.focus();
    ui.controller.open({ groups: groups(), opener });
    ui.edit('b').fire('click');
    const editor = ui.editor();
    if (action === 'dismiss') ui.dismiss.fire('click');
    else if (action === 'escape') ui.dialog.fire('cancel');
    else ui.controller.destroy();
    assert.equal(ui.controller.isOpen, false);
    assert.equal(editor.destroyed, true);
    assert.equal(document.activeElement, opener);
    assert.equal(ui.editorHost.children.length, 0);
    if (action !== 'destroy') {
      ui.controller.open({ groups: groups(), opener });
      assert.equal(find(ui.dialog, node => node.id === ui.dialog.getAttribute('aria-labelledby')).textContent, 'Audience Similarity');
      assert.equal(ui.body.hidden, false);
      assert.equal(ui.editorHost.hidden, true);
      ui.edit('c').fire('click');
      assert.notEqual(ui.editor(), editor);
      assert.equal(ui.editor().opened.at(-1).id, 'c');
    }
  });
}


test('a save completing after close cannot reopen the editor or replace a later comparison', async t => {
  let finishSave;
  const ui = setup(t, { onSaveDraft: () => new Promise(resolve => { finishSave = resolve; }) });
  const source = groups().slice(0, 1);
  ui.controller.open({ groups: source });
  ui.edit('b').fire('click');
  const previousEditor = ui.editor();
  const saving = previousEditor.onSave(source[0].drafts[1], { title: 'Late save', draftText: 'A late response.' });
  ui.dismiss.fire('click');
  ui.controller.open({ groups: groups().slice(1) });
  const currentResults = [...ui.comparisons()];
  finishSave(true);
  await saving;
  assert.equal(previousEditor.destroyed, true);
  assert.equal(ui.recalculations.length, 0);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.editorHost.hidden, true);
  assert.equal(ui.body.hidden, false);
  assert.deepEqual(ui.draftIds(), ['d', 'e']);
  assert.deepEqual(ui.selectedIds(), ['d']);
  assert.deepEqual(ui.comparisons(), currentResults);
  assert.equal(document.activeElement, ui.dismiss);
});


test('a previous save cannot close a newer editor session for the same draft object', async t => {
  let finishSave;
  const ui = setup(t, { onSaveDraft: () => new Promise(resolve => { finishSave = resolve; }) });
  const source = groups().slice(0, 1);
  const target = source[0].drafts[1];
  ui.controller.open({ groups: source });
  ui.edit('b').fire('click');
  const previousEditor = ui.editor();
  const saving = previousEditor.onSave(target, { title: 'Previous session title', draftText: 'Previous session body.' });
  ui.dismiss.fire('click');
  ui.controller.open({ groups: source });
  ui.edit('b').fire('click');
  const currentEditor = ui.editor();
  assert.notEqual(currentEditor, previousEditor);
  assert.equal(currentEditor.opened.at(-1), target);
  currentEditor.input.value = 'Current session title';
  finishSave(true);
  await saving;
  assert.equal(previousEditor.destroyed, true);
  assert.equal(ui.recalculations.length, 0);
  assert.equal(currentEditor.destroyed, false);
  assert.equal(ui.editor(), currentEditor);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.editorHost.hidden, false);
  assert.equal(ui.body.hidden, true);
  assert.equal(ui.footer.hidden, true);
  assert.equal(ui.dialog.dataset.view, 'editor');
  assert.equal(find(ui.dialog, node => node.id === ui.dialog.getAttribute('aria-labelledby')).textContent, 'Edit Draft');
  assert.equal(currentEditor.input.value, 'Current session title');
  assert.equal(document.activeElement, currentEditor.input);
});


test('Source Draft is only the first comparison row and regular drafts are the selectable references', t => {
  const ui = setup(t);
  const sourceDraft = {
    ...draft('source', 'original-audience', 'The original source article body.', 'Original source headline'),
    isSimilaritySource: true,
  };
  const before = structuredClone(sourceDraft);
  const selected = groups().slice(0, 1);
  assert.equal(ui.controller.open({ groups: selected, sourceDraft }), true);
  assert.deepEqual(ui.draftIds(), ['a', 'b', 'c']);
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.equal(ui.card('source'), undefined);
  assert.equal(ui.field('source'), undefined);
  assert.equal(ui.edit('source'), undefined);
  assert.equal(ui.rowEdit('source'), undefined);
  assert.doesNotMatch(content(ui.pairs), /Source Draft|Original source headline/);
  assert.equal(ui.reference, undefined);
  assert.equal(cls(ui.field('a'), 'audience-similarity-draft-title').textContent, 'Draft a');
  const sourceRow = ui.comparison('source');
  assert.equal(ui.comparisons()[0], sourceRow);
  const sourceLabel = cls(sourceRow, 'audience-similarity-comparison-heading');
  assert.equal(content(sourceLabel).trim(), 'Source Draft');
  assert.equal(cls(sourceLabel, 'output-badge'), undefined);
  assert.equal(cls(sourceLabel, 'output-badge--audience'), undefined);
  assert.equal(cls(sourceRow, 'icon-button'), undefined);
  assert.deepEqual(ui.comparisons().map(section => [section.dataset.referenceId, section.dataset.comparisonId]), [['a', 'source'], ['a', 'b'], ['a', 'c']]);
  assert.deepEqual(sourceDraft, before);
});

for (const count of [2, 3, 4]) {
  test(`${count} regular references each include the Source Draft as the first of ${count} comparison rows`, t => {
    const ui = setup(t);
    const sourceDraft = { ...draft('source'), isSimilaritySource: true };
    const selectedDrafts = Array.from({ length: count }, (_, index) => draft(`selected-${index + 1}`, index % 2 ? 'wellness-enthusiast' : 'general'));
    const selected = [{ key: 'selected', label: 'Selected Drafts', drafts: selectedDrafts }];
    const before = structuredClone({ sourceDraft, selected });
    ui.controller.open({ groups: selected, sourceDraft });
    assert.equal(ui.comparisons().length, count);
    assert.deepEqual(ui.selectedIds(), [selectedDrafts[0].id]);
    assert.deepEqual(ui.draftIds(), selectedDrafts.map(draft => draft.id));
    assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['source', ...selectedDrafts.slice(1).map(draft => draft.id)]);
    for (const reference of selectedDrafts) {
      ui.field(reference.id).fire('click');
      assert.deepEqual(ui.selectedIds(), [reference.id]);
      assert.equal(ui.comparisons().length, count);
      assert.deepEqual(ui.comparisons().map(section => section.dataset.comparisonId), ['source', ...selectedDrafts.filter(draft => draft !== reference).map(draft => draft.id)]);
      for (const section of ui.comparisons()) {
        assert.equal(section.dataset.referenceId, reference.id);
        assert.notEqual(section.dataset.comparisonId, reference.id);
        assert.equal(section.children.filter(cell => cell.dataset.metric).length, 5);
      }
      assert.equal(content(cls(ui.comparison('source'), 'audience-similarity-comparison-heading')).trim(), 'Source Draft');
      assert.ok(ui.edit(reference.id));
    }
    assert.equal(ui.field('source'), undefined);
    assert.deepEqual(ui.draftIds(), selectedDrafts.map(draft => draft.id));
    assert.deepEqual({ sourceDraft, selected }, before);
  });
}

test('a Source Draft does not make a single selected draft eligible for similarity', t => {
  const ui = setup(t);
  const sourceDraft = { ...draft('source'), isSimilaritySource: true };
  assert.equal(ui.controller.open({ groups: [{ key: 'selected', label: 'Selected Drafts', drafts: [draft('only')] }], sourceDraft }), false);
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.fields().length, 0);
  assert.equal(ui.comparisons().length, 0);
});


test('comparison table supplies semantic headers, current-reference caption, and accessible horizontal scrolling', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups().slice(0, 1) });
  assert.equal(find(ui.results, node => node.tagName === 'h3'), undefined);
  assert.equal(ui.results.getAttribute('aria-label'), 'Similarity scores');
  assert.doesNotMatch(content(ui.dialog), /Choose a Reference Draft|Similarity to Each Other Draft/);
  const scroll = cls(ui.results, 'audience-similarity-table-scroll');
  assert.ok(scroll);
  assert.equal(scroll.getAttribute('role'), 'region');
  assert.equal(scroll.getAttribute('aria-label'), 'Comparison table');
  assert.equal(scroll.getAttribute('tabindex'), '0');
  const table = find(scroll, node => node.tagName === 'table');
  assert.ok(table);
  const caption = find(table, node => node.tagName === 'caption');
  assert.match(content(caption), /Draft a/);
  const head = find(table, node => node.tagName === 'thead');
  const headings = all(head, node => node.tagName === 'th');
  assert.deepEqual(headings.map(node => node.textContent), ['Compared with', 'Overall', 'Body overlap', 'Headline', 'Opening', 'Shared quotes', 'Structure']);
  for (const heading of headings) assert.equal(heading.getAttribute('scope'), 'col');
  const tbody = find(table, node => node.tagName === 'tbody');
  assert.deepEqual(tbody.children, ui.comparisons());
  for (const row of ui.comparisons()) {
    assert.equal(row.tagName, 'tr');
    assert.equal(row.children.length, 7);
    assert.equal(row.children[0].tagName, 'th');
    assert.equal(row.children[0].getAttribute('scope'), 'row');
    for (const cell of row.children.slice(1)) assert.equal(cell.tagName, 'td');
    const verdict = cls(row, 'audience-similarity-verdict');
    assert.match(verdict.textContent, /^\d+%$/);
    assert.match(verdict.getAttribute('aria-label'), /Similarity:/);
    assert.match(verdict.getAttribute('aria-label'), /similar|differentiated/i);
  }
  ui.field('c').fire('click');
  assert.match(content(find(ui.results, node => node.tagName === 'caption')), /A third draft/);
});

test('selected content cards identify the reference without a duplicate summary and keep Source Draft in the table', t => {
  const ui = setup(t);
  const sourceDraft = { ...draft('source', '', 'The original story.', 'Original source title'), isSimilaritySource: true };
  const selected = [{ key: 'selected', label: 'Selected Drafts', drafts: [
    draft('wellness', 'wellness-enthusiast', undefined, 'A complete headline for wellness readers'),
    draft('general', 'general', undefined, 'A complete headline for everyone'),
  ] }];
  ui.controller.open({ groups: selected, sourceDraft });
  assert.equal(ui.reference, undefined);
  assert.equal(ui.field('source'), undefined);
  assert.ok(ui.comparison('source'));
  assert.deepEqual(ui.selectedIds(), ['wellness']);
  for (const selectedDraft of selected[0].drafts) {
    const field = ui.field(selectedDraft.id);
    assert.equal(field.children.length, 2);
    assert.equal(field.children[0], cls(field, 'audience-similarity-draft-chips'));
    assert.equal(cls(field, 'audience-similarity-draft-title').textContent, selectedDraft.title);
    field.fire('click');
    assert.deepEqual(ui.selectedIds(), [selectedDraft.id]);
    assert.equal(field.getAttribute('aria-pressed'), 'true');
    assert.equal(ui.card(selectedDraft.id).dataset.selected, 'true');
    assert.equal(ui.comparisons()[0], ui.comparison('source'));
    for (const row of ui.comparisons()) assert.equal(row.dataset.referenceId, selectedDraft.id);
  }
  assert.equal(ui.reference, undefined);
  assert.equal(ui.field('source'), undefined);
});


test('reference cards show only the audience chip without changing saved format and voice labels', t => {
  const ui = setup(t);
  const selected = [{ key: 'selected', label: 'Selected Drafts', drafts: [
    {
      ...draft('a', 'wellness-enthusiast', undefined, 'A full headline shown below the chips'),
      labels: [
        { key: 'voice', label: 'Us Weekly Voice Guide' },
        { key: 'audience', label: 'Wellness Enthusiast' },
        { key: 'format', label: 'Listicle' },
      ],
      toolPreferences: { format: 'listicle', audience: 'wellness-enthusiast', voice: 'us-weekly' },
    },
    draft('b'),
  ] }];
  const before = structuredClone(selected);
  ui.controller.open({ groups: selected });
  const field = ui.field('a');
  const chips = cls(field, 'audience-similarity-draft-chips');
  const title = cls(field, 'audience-similarity-draft-title');
  assert.deepEqual(field.children, [chips, title]);
  assert.deepEqual(chips.children.map(chip => chip.getAttribute('title')), ['Wellness Enthusiast']);
  for (const chip of chips.children) {
    assert.equal(chip.tagName, 'span');
    assert.equal(cls(chip, 'output-badge'), chip);
  }
  assert.equal(cls(chips.children[0], 'output-badge--audience'), chips.children[0]);
  assert.equal(cls(field, 'output-badge--format'), undefined);
  assert.equal(cls(field, 'output-badge--voice'), undefined);
  assert.doesNotMatch(content(field), /Listicle|Us Weekly Voice Guide/);
  assert.equal(title.textContent, selected[0].drafts[0].title);
  assert.equal(title.children.length, 0);
  assert.ok(ui.card('a').children.includes(ui.edit('a')));
  assert.equal(find(field, node => node !== field && node.tagName === 'button'), undefined);
  assert.deepEqual(selected, before);
});


test('target rows have text Edit buttons beside their audience chips while Source Draft remains read-only', t => {
  const ui = setup(t);
  const sourceDraft = { ...draft('source'), isSimilaritySource: true };
  const selected = groups().slice(0, 1);
  ui.controller.open({ groups: selected, sourceDraft });
  assert.equal(ui.rowEdit('source'), undefined);
  assert.equal(find(ui.comparison('source'), node => node.tagName === 'button'), undefined);
  assert.equal(ui.rowEdit('a'), undefined, 'the reference has no comparison row');
  for (const target of selected[0].drafts.slice(1)) {
    const row = ui.comparison(target.id);
    const label = cls(row, 'audience-similarity-comparison-label');
    const chip = cls(row, 'audience-similarity-comparison-audience');
    const edit = ui.rowEdit(target.id);
    assert.deepEqual(label.children, [chip, edit]);
    assert.equal(edit.tagName, 'button');
    assert.equal(edit.type, 'button');
    assert.equal(edit.textContent, 'Edit');
    assert.equal(edit.children.length, 0);
    assert.equal(edit.getAttribute('aria-label'), `Edit draft: ${target.title}`);
    assert.equal(cls(edit, 'output-badge'), edit);
    assert.equal(cls(edit, 'output-badge--sources'), edit);
    assert.ok(ui.edit(target.id), 'the top-card Edit action remains available');
  }
});

test('row Edit opens the matching draft without changing the reference and Back restores row focus', t => {
  const ui = setup(t);
  const selected = groups().slice(0, 1);
  const before = structuredClone(selected);
  ui.controller.open({ groups: selected });
  const trigger = ui.rowEdit('c');
  const originalResults = [...ui.comparisons()];
  ui.pairs.scrollLeft = 140;
  ui.body.scrollTop = 90;
  trigger.focus();
  trigger.fire('click');
  assert.equal(ui.editor().opened.at(-1), selected[0].drafts[2]);
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.equal(ui.dialog.dataset.view, 'editor');
  assert.equal(ui.body.hidden, true);
  assert.equal(document.activeElement, ui.editor().input);
  ui.editor().onBack();
  assert.equal(ui.dialog.dataset.view, 'comparison');
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.deepEqual(ui.comparisons(), originalResults);
  assert.equal(ui.pairs.scrollLeft, 140);
  assert.equal(ui.body.scrollTop, 90);
  assert.equal(document.activeElement, trigger);
  assert.notEqual(document.activeElement, ui.edit('c'));
  assert.deepEqual(selected, before);
});

test('saving from a row Edit refreshes its scores and returns focus to that row after rerender', async t => {
  const ui = setup(t);
  const selected = groups().slice(0, 1);
  const target = selected[0].drafts[1];
  ui.controller.open({ groups: selected });
  const oldRow = ui.comparison('b');
  const trigger = ui.rowEdit('b');
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '100%');
  trigger.focus();
  trigger.fire('click');
  assert.equal(ui.editor().opened.at(-1), target);
  await ui.editor().onSave(target, { title: 'Updated target title', draftText: 'Astronauts explore distant planets beyond our galaxy.' });
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.recalculations.length, 1);
  assert.equal(ui.resume({ groups: selected }), true);
  assert.equal(ui.controller.isOpen, true);
  assert.equal(ui.dialog.dataset.view, 'comparison');
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.notEqual(ui.comparison('b'), oldRow);
  assert.notEqual(ui.rowEdit('b'), trigger);
  assert.equal(ui.rowEdit('b').getAttribute('aria-label'), 'Edit draft: Updated target title');
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '0%');
  assert.equal(document.activeElement, ui.rowEdit('b'));
  assert.notEqual(document.activeElement, ui.edit('b'));
});


test('successful recalculation closes and cleans up before handing regular draft IDs and reference context to the Content panel', async t => {
  const ui = setup(t);
  const selected = groups().slice(0, 1);
  const sourceDraft = { ...draft('source'), isSimilaritySource: true };
  const opener = document.createElement('button');
  ui.controller.open({ groups: selected, sourceDraft, opener });
  ui.field('c').fire('click');
  ui.pairs.scrollLeft = 180;
  ui.body.scrollTop = 90;
  ui.rowEdit('b').fire('click');
  const editor = ui.editor();
  const target = selected[0].drafts[1];
  assert.equal(await editor.onSave(target, { title: 'Updated second draft' }), true);
  assert.equal(ui.controller.isOpen, false);
  assert.equal(ui.fields().length, 0);
  assert.equal(ui.comparisons().length, 0);
  assert.equal(editor.destroyed, true);
  assert.deepEqual(ui.recalculations, [{ draftIds: ['a', 'b', 'c'], sourceDraft, editedDraft: target, referenceId: 'c', focusDraftId: 'b', focusOrigin: 'row', scrollLeft: 180, scrollTop: 90 }]);
  assert.deepEqual(ui.handoffStates, [{ open: false, cards: 0, rows: 0, editorDestroyed: true, focus: opener }]);
  assert.equal(cls(ui.dialog, 'audience-similarity-recalculating'), undefined);
  assert.equal(cls(ui.dialog, 'audience-similarity-loading-list'), undefined);
  assert.equal(await editor.onSave(target, { title: 'Repeated request' }), false);
  assert.equal(ui.recalculations.length, 1);
  assert.equal(target.title, 'Updated second draft');
  assert.equal(ui.resume({ groups: selected, sourceDraft, opener }), true);
  assert.deepEqual(ui.selectedIds(), ['c']);
  assert.equal(ui.pairs.scrollLeft, 180);
  assert.equal(ui.body.scrollTop, 90);
  assert.equal(ui.comparisons()[0], ui.comparison('source'));
  assert.equal(document.activeElement, ui.rowEdit('b'));
});

for (const action of ['dismiss', 'escape', 'close', 'pagehide', 'destroy']) {
  test(`canceling before persistence completes via ${action} prevents a recalculation handoff`, async t => {
    let finishSave;
    const ui = setup(t, { onSaveDraft: () => new Promise(resolve => { finishSave = resolve; }) });
    const selected = groups().slice(0, 1);
    const opener = document.createElement('button');
    ui.controller.open({ groups: selected, opener });
    ui.edit('b').fire('click');
    const saving = ui.editor().onSave(selected[0].drafts[1], { title: 'Save finishing after close' });
    if (action === 'dismiss') ui.dismiss.fire('click');
    else if (action === 'escape') ui.dialog.fire('cancel');
    else if (action === 'pagehide') ui.listeners.get('pagehide')();
    else if (action === 'close') ui.controller.close();
    else ui.controller.destroy();
    finishSave(true);
    await saving;
    assert.equal(ui.recalculations.length, 0);
    assert.equal(ui.controller.isOpen, false);
    assert.equal(ui.fields().length, 0);
    assert.equal(ui.comparisons().length, 0);
    assert.equal(document.activeElement, opener);
  });
}

for (const action of ['pagehide', 'destroy']) {
  test(`${action} cancels a pending recalculation handoff before the native close event`, async t => {
    const ui = setup(t);
    const selected = groups().slice(0, 1);
    ui.controller.open({ groups: selected });
    ui.edit('b').fire('click');
    ui.dialog.deferClose = true;
    await ui.editor().onSave(selected[0].drafts[1], { title: 'Saved while native close is pending' });
    assert.equal(ui.controller.isOpen, false);
    assert.equal(ui.dialog.closePending, true);
    assert.equal(ui.recalculations.length, 0);
    if (action === 'pagehide') ui.listeners.get('pagehide')();
    else ui.controller.destroy();
    ui.dialog.flushClose();
    assert.equal(ui.recalculations.length, 0);
    assert.equal(ui.fields().length, 0);
    assert.equal(ui.comparisons().length, 0);
  });
}

test('invalid restored reference or focus falls back to the first regular draft and dismiss button', t => {
  const ui = setup(t);
  ui.controller.open({ groups: groups().slice(0, 1), referenceId: 'missing', focusDraftId: 'missing', focusOrigin: 'row', scrollLeft: 120, scrollTop: 80 });
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.equal(document.activeElement, ui.dismiss);
  assert.equal(ui.pairs.scrollLeft, 120);
  assert.equal(ui.body.scrollTop, 80);
});


test('opens prepared pair results immediately, computes Source separately, and refreshes edited content', t => {
  const ui = setup(t);
  const project = { outputs: [draft('a'), draft('b')] };
  const prepared = prepareAudienceSimilarities(project);
  const pair = prepared.comparisons.get(audienceSimilarityPairKey('a', 'b'));
  // A distinct supplied estimate makes accidental recomputation observable.
  const deliveredPair = { ...pair, metrics: pair.metrics.map(metric => metric.key === 'body' ? { ...metric, value: 37 } : metric) };
  const delivered = new Map([[audienceSimilarityPairKey('a', 'b'), deliveredPair]]);
  const sourceDraft = { ...draft('source'), isSimilaritySource: true };
  assert.equal(ui.controller.open({ groups: [prepared.group], comparisonResults: delivered, sourceDraft, referenceId: 'a' }), true);
  assert.deepEqual(ui.selectedIds(), ['a']);
  assert.deepEqual(ui.comparisons().map(row => row.dataset.comparisonId), ['source', 'b']);
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '37%');
  assert.equal(cls(ui.metric('body', 'source'), 'audience-similarity-table-value').textContent, '100%');
  assert.equal(ui.recalculations.length, 0);
  ui.field('b').fire('click');
  assert.equal(cls(ui.metric('body', 'a'), 'audience-similarity-table-value').textContent, '37%', 'Prepared pair scores work in either direction');
  project.outputs[1].draftText = 'Orchards flourished beside mountains while farmers harvested apples.';
  ui.field('a').fire('click');
  assert.equal(cls(ui.metric('body', 'b'), 'audience-similarity-table-value').textContent, '0%', 'Content changes invalidate the cached comparison');
  assert.equal(deliveredPair.metrics.find(metric => metric.key === 'body').value, 37, 'Rendering does not mutate supplied results');
});

test('each card average equals the Overall column including the first Source Draft row', t => {
  const ui = setup(t);
  const project = {
    id: 'source-average-project',
    sourceDraft: { title: 'School funding proposal', draftText: 'The board reviewed school funding.\n\nFamilies are awaiting another meeting.' },
    outputs: [
      draft('a', 'general', 'The board reviewed school funding.\n\nFamilies are awaiting another meeting.', 'School funding proposal'),
      draft('b', 'wellness-enthusiast', 'Families discussed the school proposal.\n\nPublic meetings start next month.', 'Families discuss schools'),
      draft('c', 'millennial-pop-culture', 'A cinema opens beside the town square.\n\nVisitors celebrated the opening.', 'New cinema opens'),
      draft('d', 'trend-chasing-fashion-shopper', 'The board reviewed school funding.\n\nNew proposals await a decision.', 'Board reviews new proposals'),
    ],
  };
  const prepared = prepareAudienceSimilarities(project);
  assert.equal(ui.controller.open({ groups: [prepared.group], sourceDraft: prepared.sourceDraft, comparisonResults: prepared.comparisons }), true);
  for (const reference of prepared.drafts) {
    ui.field(reference.id).fire('click');
    const rows = ui.comparisons();
    const summary = prepared.summaries.get(reference.id);
    assert.equal(rows[0].dataset.comparisonId, prepared.sourceDraft.id);
    assert.equal(rows.some(row => row.dataset.comparisonId === reference.id), false);
    const displayed = rows.map(row => Number.parseInt(cls(row, 'audience-similarity-verdict').textContent, 10));
    assert.equal(summary.score, Math.round(displayed.reduce((total, score) => total + score, 0) / displayed.length));
    assert.equal(summary.comparisonCount, rows.length);
    assert.equal(summary.includesSourceDraft, true);
  }
});
