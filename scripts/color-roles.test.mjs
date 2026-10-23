import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { colorRoleGroups } from '../dist/design-system/color-roles.js';

const source = JSON.parse(await readFile(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
const tokens = new Map();
function collect(group, prefix = '') {
  for (const [name, value] of Object.entries(group)) {
    if (name.startsWith('$') || !value || typeof value !== 'object') continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if ('$value' in value) tokens.set(path, value);
    else collect(value, path);
  }
}
collect(source);

function resolveColor(name, chain = []) {
  assert.ok(!chain.includes(name), `Circular color reference: ${[...chain, name].join(' → ')}`);
  const token = tokens.get(name);
  assert.ok(token, `Missing color token: ${name}`);
  assert.equal(token.$type, 'color', `Expected a color token: ${name}`);
  if (typeof token.$value === 'string') {
    const match = token.$value.match(/^\{(.+)\}$/);
    assert.ok(match, `Expected a token reference: ${name}`);
    return resolveColor(match[1], [...chain, name]);
  }
  const value = token.$value;
  assert.equal(value.colorSpace, 'srgb', `Unsupported color space: ${name}`);
  assert.equal(value.components.length, 3, `Expected RGB components: ${name}`);
  return value;
}
function colorKey(name) {
  const { components, alpha = 1 } = resolveColor(name);
  return [...components, alpha].map(value => Math.round(value * 255).toString(16).padStart(2, '0')).join('');
}
const roles = colorRoleGroups.flatMap(group => group.colors);

test('visible color roles cover every distinct foundation color exactly once', () => {
  const groupIds = new Set();
  const roleTokens = new Set();
  const visibleValues = new Set();
  for (const group of colorRoleGroups) {
    assert.ok(group.id && group.title && group.description && group.colors.length, 'Color groups need labels, descriptions, and swatches');
    assert.ok(!groupIds.has(group.id), `Repeated color group: ${group.id}`);
    groupIds.add(group.id);
    for (const role of group.colors) {
      assert.ok(role.name && role.description, `Color role needs a label and description: ${role.token}`);
      assert.ok(!roleTokens.has(role.token), `Repeated color token: ${role.token}`);
      roleTokens.add(role.token);
      const value = colorKey(role.token);
      assert.ok(!visibleValues.has(value), `Duplicate resolved swatch: ${role.token}`);
      visibleValues.add(value);
    }
  }
  const foundationValues = new Set([...tokens].filter(([name, token]) => name.startsWith('foundation.color.') && token.$type === 'color').map(([name]) => colorKey(name)));
  assert.deepEqual([...visibleValues].sort(), [...foundationValues].sort(), 'Every distinct foundation color needs a visible role, including legacy defaults and alpha colors');
});

test('translucent roles disclose their token alpha and the canvas keeps its 50% recipe opaque', () => {
  for (const role of roles) {
    const { alpha = 1 } = resolveColor(role.token);
    if (alpha < 1) {
      assert.ok(typeof role.opacity === 'number', `Missing opacity disclosure: ${role.token}`);
      assert.ok(Math.abs(role.opacity - alpha) < 1e-10, `Incorrect opacity disclosure: ${role.token}`);
    } else {
      assert.equal(role.opacity, undefined, `Opaque role must not apply transparency again: ${role.token}`);
    }
  }
  const canvas = resolveColor('semantic.color.background.canvas');
  const base = resolveColor('foundation.color.orange.50');
  const white = resolveColor('foundation.color.neutral.0');
  const metadata = tokens.get('foundation.color.canvas.orange-50-half').$extensions['com.csa'];
  assert.equal(metadata.opacity, 0.5);
  assert.equal(metadata.derivedFrom, 'foundation.color.orange.50');
  assert.equal(metadata.over, 'foundation.color.neutral.0');
  assert.equal(canvas.alpha, 1);
  assert.deepEqual(canvas.components.map(value => Math.round(value * 255)), base.components.map((value, index) => Math.round((value * metadata.opacity + white.components[index] * (1 - metadata.opacity)) * 255)));
  assert.equal(colorKey('component.editor.color-input-default'), '26344aff');
});

test('text-field and unchecked-checkbox boundaries meet non-text contrast on field surfaces', () => {
  const luminance = name => {
    const { components, alpha = 1 } = resolveColor(name);
    assert.equal(alpha, 1, `${name}: contrast calculation expects an opaque boundary or surface`);
    const linear = components.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  };
  for (const border of ['component.field.border', 'component.checkbox.border']) {
    for (const surface of ['semantic.color.surface.default', 'semantic.color.background.canvas', 'semantic.color.surface.subtle']) {
      const [dark, light] = [luminance(border), luminance(surface)].sort((a, b) => a - b);
      const contrast = (light + 0.05) / (dark + 0.05);
      assert.ok(contrast >= 3, `${border} against ${surface}: ${contrast}:1 is below WCAG AA 3:1`);
    }
  }
});
