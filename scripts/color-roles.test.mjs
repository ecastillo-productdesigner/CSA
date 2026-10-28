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
function luminance(name) {
  const { components, alpha = 1 } = resolveColor(name);
  assert.equal(alpha, 1, `${name}: contrast calculation expects an opaque color`);
  const linear = components.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function assertContrast(foreground, background, minimum) {
  const [dark, light] = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
  const ratio = (light + 0.05) / (dark + 0.05);
  assert.ok(ratio >= minimum, `${foreground} against ${background}: ${ratio}:1 is below ${minimum}:1`);
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
  assert.deepEqual([...visibleValues].sort(), [...foundationValues].sort(), 'Every distinct foundation color needs a visible role, including translucent colors');
});

test('translucent roles disclose their token alpha', () => {
  for (const role of roles) {
    const { alpha = 1 } = resolveColor(role.token);
    if (alpha < 1) {
      assert.ok(typeof role.opacity === 'number', `Missing opacity disclosure: ${role.token}`);
      assert.ok(Math.abs(role.opacity - alpha) < 1e-10, `Incorrect opacity disclosure: ${role.token}`);
    } else {
      assert.equal(role.opacity, undefined, `Opaque role must not apply transparency again: ${role.token}`);
    }
  }

});

test('approved palette keeps readable text, action, and selection roles accessible', () => {
  const palette = {
    'semantic.color.background.canvas': 'fffdf5ff',
    'semantic.color.surface.default': 'ffffffff',
    'semantic.color.surface.selected': 'f0fdfaff',
    'semantic.color.navigation.selected': 'f0fdfaff',
    'semantic.color.navigation.selected-hover': 'f0fdfaff',
    'semantic.color.navigation.selected-foreground': '00786fff',
    'semantic.color.text.heading': '060606ff',
    'semantic.color.text.secondary': '737373ff',
    'semantic.color.text.canvas-secondary': '404040ff',
    'semantic.color.action.primary': '00786fff',
    'semantic.color.action.primary-hover': '005f5aff',
    'component.button.primary.disabled-background': 'e5e5e5ff',
    'component.button.primary.disabled-label': '737373ff',
    'component.layout-switch.selected-background': '00786fff',
    'component.layout-switch.selected-label': 'ffffffff',
    'semantic.color.border.selected': '00786fff',
    'semantic.color.border.focus': '00786fff',
    'component.checkbox.selected-background': '00786fff',
  };
  for (const [name, expected] of Object.entries(palette)) assert.equal(colorKey(name), expected, name);

  // Supporting text uses its surface-specific role without reducing the text
  // contrast threshold: Neutral 500 on white, Neutral 700 on Amber 50 at 50% over white.
  assertContrast('semantic.color.text.secondary', 'semantic.color.surface.default', 4.5);
  assertContrast('semantic.color.text.canvas-secondary', 'semantic.color.background.canvas', 4.5);
  for (const surface of ['semantic.color.surface.default', 'semantic.color.background.canvas', 'semantic.color.surface.selected']) {
    assertContrast('semantic.color.action.primary', surface, 4.5);
    assertContrast('semantic.color.action.primary-hover', surface, 4.5);
    assertContrast('component.layout-switch.selected-background', surface, 3);
    assertContrast('semantic.color.border.selected', surface, 3);
    assertContrast('semantic.color.border.focus', surface, 3);
  }
  assertContrast('semantic.color.text.primary', 'semantic.color.surface.selected', 4.5);
  assertContrast('semantic.color.text.secondary', 'semantic.color.surface.selected', 4.5);
  assertContrast('semantic.color.navigation.selected-foreground', 'semantic.color.navigation.selected', 4.5);
  assertContrast('semantic.color.navigation.selected-foreground', 'semantic.color.navigation.selected-hover', 4.5);
  assertContrast('component.layout-switch.selected-label', 'component.layout-switch.selected-background', 4.5);
  assertContrast('component.button.primary.label', 'component.button.primary.background', 4.5);
  assertContrast('component.button.primary.label', 'component.button.primary.hover', 4.5);
});

test('text-field and unchecked-checkbox boundaries meet non-text contrast on field surfaces', () => {
  for (const border of ['component.field.border', 'component.checkbox.border']) {
    assert.equal(colorKey(border), '737373ff', `${border}: preserve the meaningful control boundary`);
    for (const surface of ['semantic.color.surface.default', 'semantic.color.background.canvas', 'semantic.color.surface.subtle']) {
      assertContrast(border, surface, 3);
    }
  }
});

test('revision notifications use Blue 500 and meet non-text contrast on tab surfaces', () => {
  assert.equal(colorKey('component.editor-tab.revision-dot-color'), '3b82f6ff');
  for (const surface of ['semantic.color.surface.default', 'semantic.color.background.canvas']) {
    assertContrast('component.editor-tab.revision-dot-color', surface, 3);
  }
});
