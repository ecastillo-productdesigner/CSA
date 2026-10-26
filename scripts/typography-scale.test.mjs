import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileTokens } from './build-design-tokens.mjs';

const source = JSON.parse(await readFile(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
const tokens = new Map(compileTokens(source).flat.map(token => [token.name, token]));
const textSizes = [12, 14, 16, 20, 24, 30];
const iconSizes = [16, 20, 24, 40];

test('the text scale stays compact and independent from icon sizes', () => {
  for (const [prefix, expected] of [['foundation.font.size.', textSizes], ['foundation.icon.size.', iconSizes]]) {
    const sizes = [...tokens.values()].filter(token => token.name.startsWith(prefix)).map(token => Number.parseFloat(token.value)).sort((a, b) => a - b);
    assert.deepEqual(sizes, expected, `${prefix} should contain only the approved scale`);
  }
  assert.ok(![...tokens.keys()].some(name => /^component\.(typography\.observed-size-|reference\.font-size-)/.test(name)), 'Retired font-size exceptions must not reintroduce one-off sizes');
  for (const token of tokens.values()) {
    if (token.type !== 'typography') continue;
    assert.ok(textSizes.includes(token.properties.fontSize.value), `${token.name} leaves the approved text scale`);
  }
});

test('consolidation preserves the approved card, dropdown, and status typography', () => {
  for (const [name, size, weight] of [
    ['semantic.typography.project-title.desktop', 16, 600],
    ['semantic.typography.project-title.mobile', 16, 600],
    ['semantic.typography.field-value', 14, 400],
    ['semantic.typography.variant-title', 14, 400],
    ['semantic.typography.status', 12, 500],
  ]) {
    const token = tokens.get(name);
    assert.equal(token?.properties.fontSize.value, size, `${name} size`);
    assert.equal(token.properties.fontWeight, weight, `${name} weight`);
    if (name.startsWith('semantic.typography.project-title.')) assert.equal(token.properties.fontSize.value * token.properties.lineHeight, 20, `${name} keeps its 20 px line height`);
  }
  const status = tokens.get('semantic.typography.status').properties;
  assert.equal(status.lineHeight * status.fontSize.value, 20, 'Status labels use the chip line height');
  assert.deepEqual(status, tokens.get('semantic.typography.chip').properties, 'Status labels and chips share typography');
});

test('shared reading, action, and dialog roles preserve their approved metrics', () => {
  for (const [name, size, height, weight] of [
    ['body', 16, 28, 400],
    ['secondary-button', 16, 24, 600],
    ['dialog-heading', 24, 32, 650],
  ]) {
    const token = tokens.get(`semantic.typography.${name}`);
    assert.equal(token.properties.fontSize.value, size, `${name} size`);
    assert.equal(token.properties.fontSize.value * token.properties.lineHeight, height, `${name} line height`);
    assert.equal(token.properties.fontWeight, weight, `${name} weight`);
    assert.deepEqual(token.properties.letterSpacing, { value: 0, unit: 'px' }, `${name} tracking`);
  }
});

test('offline exports preserve shared reading metrics instead of browser-default heading weights', async () => {
  const css = await readFile(new URL('../styles/export.css', import.meta.url), 'utf8');
  const values = new Map([...compileTokens(source).css.matchAll(/(--csa-[\w-]+):\s*([^;]+);/g)].map(match => [match[1], match[2]]));
  const resolve = name => {
    const value = values.get(name);
    const alias = value?.match(/^var\((--[\w-]+)\)$/)?.[1];
    return alias ? resolve(alias) : Number.parseFloat(value);
  };
  for (const [selector, role] of [['body', 'body'], ['h1', 'article-h1'], ['h2', 'article-h2'], ['h3', 'article-h3']]) {
    const declarations = css.match(new RegExp(`(?:^|\\n)${selector} \\{([^}]+)\\}`))[1];
    const metric = property => {
      const name = declarations.match(new RegExp(`(?:^|;)\\s*${property}:\\s*var\\((--[\\w-]+)\\)`))?.[1];
      return resolve(name);
    };
    const expected = tokens.get(`semantic.typography.${role}`).properties;
    assert.equal(metric('font-size'), expected.fontSize.value, `${selector} size`);
    assert.equal(metric('line-height') * metric('font-size'), expected.lineHeight * expected.fontSize.value, `${selector} line height`);
    assert.equal(metric('font-weight'), expected.fontWeight, `${selector} weight`);
    assert.equal(metric('letter-spacing'), expected.letterSpacing.value, `${selector} tracking`);
  }
});

test('interface text uses Inter while greetings retain Newsreader', () => {
  assert.equal(source.foundation.font.family.interface.$value[0], 'Inter');
  for (const screen of ['desktop', 'mobile']) {
    assert.equal(tokens.get(`semantic.typography.greeting.${screen}`).properties.fontFamily[0], 'Newsreader');
  }
});

test('Material Symbols use icon sizes without expanding the text scale', async () => {
  let declarations = 0;
  for (const path of ['../styles/app.css', '../styles/guide.css']) {
    const css = (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
    for (const rule of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/material-symbols-outlined|tool-dropdown-check|data-collapse-chevron/.test(rule[1])) continue;
      const size = rule[2].match(/(?:^|;)\s*font-size\s*:\s*([^;]+)/)?.[1]?.trim();
      if (!size) continue;
      declarations += 1;
      assert.match(size, /^var\(--csa-foundation-icon-size-(?:16|20|24|40)\)$/, `${path}: ${rule[1].trim()} must use the icon scale`);
    }
  }
  assert.ok(declarations > 0, 'The icon regression check must inspect actual consumers');
});
