import test from 'node:test';
import assert from 'node:assert/strict';
import { setCompactChipLabel, truncateChipLabel } from '../dist/chip-label.js';

class Chip {
  constructor() {
    this.attributes = new Map();
    this.listeners = new Map();
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  emit(name) { this.listeners.get(name)?.(); }
}

const fullLabel = 'Trend-Chasing Fashion Shopper';

test('compact chips expose the full tooltip label without growing on hover or focus', () => {
  const chip = new Chip();
  assert.equal(setCompactChipLabel(chip, fullLabel), chip);
  assert.equal(chip.textContent, 'Trend-Chasing Fashi…');
  assert.equal(chip.getAttribute('title'), fullLabel);
  assert.equal(chip.getAttribute('aria-label'), fullLabel);
  assert.equal(chip.getAttribute('tabindex'), null);
  for (const event of ['mouseenter', 'focus', 'mouseleave', 'blur']) {
    chip.emit(event);
    assert.equal(chip.textContent, 'Trend-Chasing Fashi…');
  }
  assert.equal(chip.listeners.size, 0);
});

test('updating a chip replaces its tooltip and accessible label without changing caller-owned tab order', () => {
  const chip = new Chip();
  chip.setAttribute('tabindex', '-1');
  setCompactChipLabel(chip, fullLabel);
  const updated = 'A different long audience label';
  setCompactChipLabel(chip, updated, { ariaLabel: `Audience: ${updated}` });
  assert.equal(chip.textContent, truncateChipLabel(updated));
  assert.equal(chip.getAttribute('title'), updated);
  assert.equal(chip.getAttribute('aria-label'), `Audience: ${updated}`);
  assert.equal(chip.getAttribute('tabindex'), '-1');
});

test('short and explicitly untruncated labels retain their full text without adding keyboard stops', () => {
  for (const [label, options] of [['Listicle', {}], [fullLabel, { maxLength: 0 }]]) {
    const chip = setCompactChipLabel(new Chip(), label, options);
    assert.equal(chip.textContent, label);
    assert.equal(chip.getAttribute('title'), label);
    assert.equal(chip.getAttribute('aria-label'), label);
    assert.equal(chip.getAttribute('tabindex'), null);
  }
});

test('tooltip labels remain plain text and compact labels preserve Unicode code points', () => {
  const label = '🧭 <img src=x onerror=alert(1)> Local readers';
  const chip = setCompactChipLabel(new Chip(), label, { maxLength: 4 });
  assert.equal(chip.textContent, '🧭 <…');
  assert.equal(chip.getAttribute('title'), label);
  assert.equal(chip.innerHTML, undefined);
});
