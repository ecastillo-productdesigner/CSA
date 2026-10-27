import test from 'node:test';
import assert from 'node:assert/strict';
import { createFeedbackPill, createVariantFeedback } from '../dist/variant-feedback.js';

class Control {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.value = '';
    this.textContent = '';
  }
  append(...children) { for (const child of children) { child.parent = this; this.children.push(child); } }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return (this.className || '').split(' ').includes(selector.slice(1));
    if (selector === '[data-experience-rating]') return 'experienceRating' in this.dataset;
    if (selector === '[data-variant-feedback]') return 'variantFeedback' in this.dataset;
    return false;
  }
  closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  fire(type, detail = {}) {
    const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...detail };
    this.listeners.get(type)?.(event);
    return event;
  }
  focus() { document.activeElement = this; }
}

function setup(t, saved = null) {
  const previousDocument = globalThis.document;
  const doc = new Control('document');
  doc.createElement = tag => new Control(tag);
  globalThis.document = doc;
  t.after(() => { globalThis.document = previousDocument; });
  const ids = [
    'experience-feedback-dialog', 'experience-feedback-form', 'feedback-category',
    'feedback-category-trigger', 'feedback-severity', 'feedback-severity-trigger', 'feedback-severity-required', 'feedback-severity-required-text', 'feedback-description', 'feedback-comments',
    'feedback-submit', 'feedback-error', 'experience-feedback-complete', 'feedback-description-count',
    'experience-feedback-options', 'experience-feedback-thanks', 'experience-feedback-close',
    'experience-feedback-export', 'feedback-wordpress-link',
  ];
  const nodes = Object.fromEntries(ids.map(id => { const node = new Control(); node.id = id; return [id, node]; }));
  const get = id => nodes[id];
  const dialog = get('experience-feedback-dialog');
  const form = get('experience-feedback-form');
  const description = get('feedback-description');
  const complete = get('experience-feedback-complete');
  const body = new Control();
  body.className = 'experience-feedback-body';
  body.scrollTop = 200;
  description.maxLength = 500;
  const fields = ['feedback-category', 'feedback-severity', 'feedback-description', 'feedback-comments'].map(get);
  form.reset = () => { fields.forEach(field => { field.value = ''; }); };
  form.append(body, get('feedback-submit'));
  body.append(...ids.filter(id => !['experience-feedback-dialog', 'experience-feedback-form', 'experience-feedback-complete', 'experience-feedback-thanks', 'experience-feedback-close', 'feedback-submit', 'experience-feedback-export', 'feedback-wordpress-link'].includes(id)).map(get));
  const up = new Control('button');
  const down = new Control('button');
  up.dataset.experienceRating = 'up';
  down.dataset.experienceRating = 'down';
  get('experience-feedback-options').append(up, down);
  complete.append(get('experience-feedback-thanks'));
  get('experience-feedback-export').append(get('feedback-wordpress-link'));
  get('experience-feedback-export').hidden = true;
  dialog.append(get('experience-feedback-close'), get('experience-feedback-export'), form, complete);
  doc.append(dialog);
  complete.hidden = true;
  dialog.open = false;
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; dialog.fire('close'); };
  const output = { id: 'draft-a', title: 'First draft', ...(saved ? { experienceFeedback: structuredClone(saved) } : {}) };
  const project = { id: 'project-a', updatedAt: 100, outputs: [output] };
  const calls = { save: 0, refreshDropdowns: 0, closeDropdowns: 0 };
  let saveResult = true;
  const api = createVariantFeedback({
    save() { calls.save++; return saveResult; },
    refreshDropdowns() { calls.refreshDropdowns++; },
    closeDropdowns() { calls.closeDropdowns++; },
  });
  const pill = createFeedbackPill(output);
  doc.append(pill);
  return {
    api, calls, doc, nodes, get, dialog, form, body, up, down, description, complete, output, project, pill,
    category: get('feedback-category'), severity: get('feedback-severity'), comments: get('feedback-comments'),
    submit: get('feedback-submit'), error: get('feedback-error'), count: get('feedback-description-count'),
    setSaveResult(value) { saveResult = value; },
    change() { form.fire('input'); },
    rate(button) { get('experience-feedback-options').fire('click', { target: button }); },
    send() { return form.fire('submit'); },
  };
}

function completeRequired(ui, description = 'The draft needs more context.') {
  ui.category.value = 'content';
  ui.severity.value = 'medium';
  ui.description.value = description;
  ui.change();
}

test('thumb triggers name their draft rating, link the dialog and expose saved selection', t => {
  const ui = setup(t, { rating: 'down' });
  assert.equal(ui.pill.getAttribute('role'), 'group');
  assert.equal(ui.pill.getAttribute('aria-label'), 'Rate this draft');
  assert.deepEqual(ui.pill.children.map(button => [
    button.dataset.variantFeedback, button.dataset.feedbackRating, button.getAttribute('aria-label'),
    button.getAttribute('aria-pressed'), button.getAttribute('aria-haspopup'), button.getAttribute('aria-controls'), button.children[0].textContent,
  ]), [
    ['draft-a', 'up', 'Rate draft: Good', 'false', 'dialog', 'experience-feedback-dialog', 'thumb_up'],
    ['draft-a', 'down', 'Rate draft: Could be better', 'true', 'dialog', 'experience-feedback-dialog', 'thumb_down'],
  ]);
  const disabled = createFeedbackPill({ id: 'draft-b' }, true);
  assert.ok(disabled.children.every(button => button.disabled && button.getAttribute('aria-pressed') === 'false'));
});

test('severity is optional for Good and required for Could be better, including after rating changes', t => {
  const ui = setup(t);
  ui.api.open(ui.project, ui.output, 'up');
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.up.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.down.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.complete.hidden, true);
  assert.equal(ui.error.hidden, true);
  assert.equal(ui.submit.disabled, true);
  assert.equal(ui.count.textContent, '500 characters remaining');
  assert.equal(ui.body.scrollTop, 0);
  assert.equal(ui.calls.refreshDropdowns, 1);
  assert.equal(ui.calls.save, 0);
  assert.equal(ui.output.experienceFeedback, undefined);
  ui.category.value = 'content';
  ui.description.value = '   ';
  ui.change();
  assert.equal(ui.submit.disabled, true);
  ui.description.value = 'Needs context';
  ui.change();
  assert.equal(ui.submit.disabled, false, 'Good feedback does not require severity');
  assert.equal(ui.severity.required, false);
  assert.equal(ui.get('feedback-severity-required').hidden, true);
  ui.rate(ui.down);
  assert.equal(ui.severity.required, true);
  assert.equal(ui.get('feedback-severity-required').hidden, false);
  assert.equal(ui.submit.disabled, true, 'Could be better requires severity');
  ui.severity.value = 'medium';
  ui.change();
  assert.equal(ui.submit.disabled, false);
  ui.severity.value = '';
  ui.change();
  assert.equal(ui.submit.disabled, true, 'clearing severity disables negative feedback submission');
  ui.rate(ui.up);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.severity.required, false);
  assert.equal(ui.get('feedback-severity-required').hidden, true);
  assert.equal(ui.get('feedback-severity-required-text').hidden, true);
  assert.equal(ui.count.textContent, '487 characters remaining');
  assert.equal(ui.calls.save, 0);
});

test('invalid programmatic submission cannot save and focuses the first missing requirement', t => {
  const ui = setup(t);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.send().defaultPrevented, true);
  assert.equal(ui.error.hidden, false);
  assert.equal(document.activeElement, ui.up);
  ui.rate(ui.down);
  ui.send();
  assert.equal(document.activeElement, ui.get('feedback-category-trigger'));
  ui.category.value = 'content';
  ui.description.value = 'Missing severity';
  ui.send();
  assert.equal(document.activeElement, ui.get('feedback-severity-trigger'));
  assert.equal(ui.calls.save, 0);
  ui.severity.value = 'medium';
  ui.description.value = '   ';
  ui.send();
  assert.equal(document.activeElement, ui.description);
  ui.description.value = 'x'.repeat(501);
  ui.change();
  assert.equal(ui.submit.disabled, true);
  assert.equal(ui.count.textContent, '0 characters remaining');
  ui.send();
  assert.equal(ui.error.hidden, false);
  assert.equal(ui.calls.save, 0);
  assert.equal(ui.output.experienceFeedback, undefined);
  assert.equal(ui.project.updatedAt, 100);
  ui.description.value = 'x'.repeat(500);
  ui.change();
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.error.hidden, true);
});

test('Submit saves the chosen draft only, updates thumb state and shows confirmation once', t => {
  const ui = setup(t);
  const other = { id: 'draft-b', experienceFeedback: { rating: 'up', description: 'Keep this feedback' } };
  ui.project.outputs.push(other);
  const otherBefore = structuredClone(other);
  const otherPill = createFeedbackPill(other);
  ui.doc.append(otherPill);
  ui.api.open(ui.project, ui.output, 'up');
  completeRequired(ui, '  Add local context.  ');
  ui.severity.value = 'medium';
  ui.comments.value = '  This is optional.  ';
  ui.rate(ui.down);
  assert.equal(ui.up.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.down.getAttribute('aria-pressed'), 'true');
  const before = Date.now();
  ui.send();
  const feedback = ui.output.experienceFeedback;
  assert.ok(feedback.submittedAt >= before && feedback.submittedAt <= Date.now());
  assert.deepEqual(feedback, {
    rating: 'down', category: 'content', severity: 'medium', description: 'Add local context.',
    comments: 'This is optional.', submittedAt: feedback.submittedAt,
  });
  assert.equal(ui.project.updatedAt, feedback.submittedAt);
  assert.equal(ui.calls.save, 1);
  assert.equal(ui.form.hidden, true);
  assert.equal(ui.complete.hidden, false);
  assert.equal(ui.get('experience-feedback-thanks').textContent, 'Thanks for your feedback!');
  assert.equal(document.activeElement, ui.get('experience-feedback-close'));
  assert.deepEqual(ui.pill.children.map(button => button.getAttribute('aria-pressed')), ['false', 'true']);
  assert.deepEqual(otherPill.children.map(button => button.getAttribute('aria-pressed')), ['true', 'false']);
  assert.deepEqual(other, otherBefore);
  ui.send();
  assert.equal(ui.calls.save, 1);
  assert.equal(ui.output.experienceFeedback, feedback);
});

test('Good feedback can save without severity or comments and failed persistence keeps session feedback', t => {
  const ui = setup(t);
  ui.setSaveResult(false);
  ui.api.open(ui.project, ui.output, 'up');
  completeRequired(ui);
  ui.severity.value = '';
  ui.change();
  assert.equal(ui.submit.disabled, false);
  ui.send();
  assert.equal(ui.output.experienceFeedback.severity, '');
  assert.equal(ui.output.experienceFeedback.comments, '');
  assert.equal(ui.calls.save, 1);
  assert.equal(ui.complete.hidden, false);
  assert.equal(ui.get('experience-feedback-thanks').textContent, 'Thanks! Your feedback is saved for this session.');
});

test('reopening restores submitted fields; a new clicked rating is tentative until Submit', t => {
  const saved = { rating: 'up', category: 'accuracy', severity: 'high', description: 'Check the details.', comments: 'Sources disagree.', submittedAt: 77 };
  const ui = setup(t, saved);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.up.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.category.value, saved.category);
  assert.equal(ui.severity.value, saved.severity);
  assert.equal(ui.description.value, saved.description);
  assert.equal(ui.comments.value, saved.comments);
  assert.equal(ui.submit.disabled, false);
  assert.equal(ui.count.textContent, '482 characters remaining');
  ui.dialog.close();
  ui.api.open(ui.project, ui.output, 'down');
  assert.equal(ui.down.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.description.value, saved.description);
  ui.category.value = 'other';
  ui.description.value = 'Unsaved revision';
  ui.comments.value = 'Unsaved comment';
  ui.dialog.close();
  assert.equal(ui.calls.save, 0);
  assert.deepEqual(ui.output.experienceFeedback, saved);
  assert.equal(ui.project.updatedAt, 100);
  ui.api.open(ui.project, ui.output);
  assert.equal(ui.category.value, saved.category);
  assert.equal(ui.description.value, saved.description);
  assert.equal(ui.comments.value, saved.comments);
  assert.equal(ui.up.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.form.hidden, false);
  assert.equal(ui.complete.hidden, true);
});

test('switching drafts resets prior fields and closing drops the save target', t => {
  const saved = { rating: 'down', category: 'content', severity: 'low', description: 'First draft feedback', comments: 'First draft comment' };
  const ui = setup(t, saved);
  ui.api.open(ui.project, ui.output);
  ui.dialog.close();
  const next = { id: 'draft-b' };
  ui.project.outputs.push(next);
  ui.api.open(ui.project, next);
  assert.ok([ui.category, ui.severity, ui.description, ui.comments].every(field => field.value === ''));
  assert.equal(ui.up.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.down.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.submit.disabled, true);
  ui.rate(ui.up);
  completeRequired(ui);
  ui.dialog.close();
  ui.send();
  assert.equal(ui.calls.save, 0);
  assert.equal(next.experienceFeedback, undefined);
  assert.deepEqual(ui.output.experienceFeedback, saved);
  assert.equal(ui.project.updatedAt, 100);
});


test('post-export opening focuses a demo WordPress button without a live destination', t => {
  const ui = setup(t);
  const section = ui.get('experience-feedback-export');
  const link = ui.get('feedback-wordpress-link');
  ui.api.open(ui.project, ui.output, undefined, { exportUrl: 'https://publisher.example/wp-admin/post.php?post=12&action=edit' });
  assert.equal(section.hidden, false);
  assert.equal(link.getAttribute('href'), undefined);
  assert.equal(link.getAttribute('target'), undefined);
  assert.equal(link.getAttribute('rel'), undefined);
  assert.equal(document.activeElement, link);
  assert.equal(ui.submit.disabled, true);
  assert.equal(ui.up.getAttribute('aria-pressed'), 'false');
  assert.equal(ui.down.getAttribute('aria-pressed'), 'false');
  completeRequired(ui);
  assert.equal(ui.submit.disabled, true, 'exporting does not supply a required rating');
  ui.rate(ui.up);
  assert.equal(ui.submit.disabled, false);
  ui.send();
  assert.equal(ui.calls.save, 1);
  assert.equal(ui.complete.hidden, false);
  assert.equal(section.hidden, false, 'the WordPress CTA remains available after feedback is submitted');
  assert.equal(link.getAttribute('href'), undefined);
  assert.equal(document.activeElement, ui.get('experience-feedback-close'));
});

test('closing post-export feedback clears its target and normal thumb reopening removes any stale destination', t => {
  const ui = setup(t);
  const section = ui.get('experience-feedback-export');
  const link = ui.get('feedback-wordpress-link');
  ui.api.open(ui.project, ui.output, undefined, { exportUrl: 'https://first.example/wp-admin/' });
  ui.rate(ui.up);
  completeRequired(ui, 'Unsaved feedback');
  ui.dialog.close();
  assert.equal(section.hidden, true);
  assert.equal(link.getAttribute('href'), undefined);
  ui.send();
  assert.equal(ui.calls.save, 0);
  assert.equal(ui.output.experienceFeedback, undefined);
  ui.api.open(ui.project, ui.output, 'down');
  assert.equal(section.hidden, true);
  assert.equal(link.getAttribute('href'), undefined);
  assert.equal(ui.down.getAttribute('aria-pressed'), 'true');
  assert.equal(ui.description.value, '');
  assert.equal(ui.submit.disabled, true);
  ui.dialog.close();
  ui.api.open(ui.project, ui.output, undefined, { exportUrl: 'http://second.example/wp-admin/' });
  assert.equal(section.hidden, false);
  assert.equal(link.getAttribute('href'), undefined);
  assert.equal(document.activeElement, link);
});

test('unsafe, relative and missing export URLs never create a navigable CTA or retain an earlier URL', t => {
  const ui = setup(t);
  const section = ui.get('experience-feedback-export');
  const link = ui.get('feedback-wordpress-link');
  const unsafe = [undefined, null, '', '/wp-admin/', 'javascript:alert(1)', 'data:text/html,example', 'ftp://example.com/file', 'https://user:password@example.com/wp-admin/'];
  for (const exportUrl of unsafe) {
    ui.api.open(ui.project, ui.output, 'up', { exportUrl: 'https://safe.example/wp-admin/' });
    assert.equal(section.hidden, false);
    ui.dialog.close();
    ui.api.open(ui.project, ui.output, 'up', { exportUrl });
    assert.equal(section.hidden, true, String(exportUrl));
    assert.equal(link.getAttribute('href'), undefined, String(exportUrl));
    assert.equal(ui.up.getAttribute('aria-pressed'), 'true');
    ui.dialog.close();
  }
  ui.api.open(ui.project, ui.output, 'up', null);
  assert.equal(section.hidden, true);
  assert.equal(link.getAttribute('href'), undefined);
  assert.equal(ui.calls.save, 0);
});
