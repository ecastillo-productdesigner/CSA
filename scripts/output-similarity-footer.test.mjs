import test from 'node:test';
import assert from 'node:assert/strict';
import { createOutputSimilarityFooter } from '../dist/outputs.js';

function setup(t) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement(tagName) {
      return {
        tagName, children: [], dataset: {}, attributes: new Map(),
        append(...children) { this.children.push(...children); },
        setAttribute(name, value) { this.attributes.set(name, value); },
        getAttribute(name) { return this.attributes.get(name) ?? null; },
      };
    },
  };
  t.after(() => { globalThis.document = previous; });
}
const draft = { id: 'wellness-draft', title: 'What happened at Discovery Place' };

test('Score first footer shows percentage, meaning, and a distinct native viewing action', t => {
  setup(t);
  const footer = createOutputSimilarityFooter(draft, { score: 81, band: 'high', comparisonCount: 3 });
  assert.equal(footer.className, 'output-card-similarity');
  const [summary, action] = footer.children;
  assert.equal(summary.className, 'output-card-similarity-summary');
  const [badge, label] = summary.children;
  assert.equal(badge.textContent, '81%');
  assert.equal(badge.dataset.band, 'high');
  assert.equal(label.textContent, 'Average similarity');
  assert.equal(action.tagName, 'button');
  assert.equal(action.type, 'button');
  assert.equal(action.textContent, 'View');
  assert.equal(action.dataset.viewSimilarities, draft.id);
  assert.equal(action.getAttribute('aria-label'), `View similarities for ${draft.title}`);
  assert.equal(action.getAttribute('aria-haspopup'), 'dialog');
  assert.equal(action.getAttribute('aria-controls'), 'audience-similarity-dialog');
  assert.equal(summary.children.some(child => child.tagName === 'button'), false);
});

test('accessible score description identifies every comparison row including Source Draft', t => {
  setup(t);
  for (const count of [2, 4]) {
    const footer = createOutputSimilarityFooter(draft, { score: 63, band: 'medium', comparisonCount: count, includesSourceDraft: true });
    const badge = footer.children[0].children[0];
    const expected = `Average similarity: 63%. Compared with ${count} drafts, including Source Draft`;
    assert.equal(badge.getAttribute('aria-label'), expected);
    assert.equal(badge.title, expected);
    assert.equal(badge.dataset.band, 'medium');
  }
});

test('no available peer score omits the whole footer while zero similarity is a valid score', t => {
  setup(t);
  for (const summary of [undefined, null, { score: 81, comparisonCount: 0 }, { score: null, comparisonCount: 2 }, { score: NaN, comparisonCount: 2 }]) {
    assert.equal(createOutputSimilarityFooter(draft, summary), null);
  }
  const footer = createOutputSimilarityFooter(draft, { score: 0, band: 'low', comparisonCount: 1 });
  assert.equal(footer.children[0].children[0].textContent, '0%');
  assert.equal(footer.children[0].children[0].dataset.band, 'low');
});

test('draft identity reaches only the viewing action without rendering its title as markup', t => {
  setup(t);
  const hostile = { id: 'a:b', title: '<img src=x onerror=alert(1)>' };
  const footer = createOutputSimilarityFooter(hostile, { score: 50, band: 'low', comparisonCount: 1 });
  const action = footer.children[1];
  assert.equal(action.dataset.viewSimilarities, hostile.id);
  assert.equal(action.getAttribute('aria-label'), `View similarities for ${hostile.title}`);
  assert.deepEqual(action.children, []);
  assert.equal(action.innerHTML, undefined);
});


test('accessible score description only counts other drafts when Source Draft is unavailable', t => {
  setup(t);
  for (const count of [1, 3]) {
    const footer = createOutputSimilarityFooter(draft, { score: 63, band: 'medium', comparisonCount: count, includesSourceDraft: false });
    const badge = footer.children[0].children[0];
    const expected = `Average similarity: 63%. Compared with ${count} other ${count === 1 ? 'draft' : 'drafts'}`;
    assert.equal(badge.getAttribute('aria-label'), expected);
    assert.equal(badge.title, expected);
  }
});
