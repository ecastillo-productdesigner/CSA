import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileTokens } from './build-design-tokens.mjs';
import { typographyRoleGroups } from '../dist/design-system/typography-roles.js';
import { buildTypographyReference } from '../dist/design-system/typography-reference.js';

const source = JSON.parse(await readFile(new URL('../dist/design-system/tokens.json', import.meta.url), 'utf8'));
const tokens = new Map(compileTokens(source).flat.map(token => [token.name, token]));

test('typography guidance covers every semantic typography token in one role', () => {
  const expected = [...tokens.values()].filter(token => token.name.startsWith('semantic.typography.') && token.type === 'typography').map(token => token.name).sort();
  const covered = new Map();
  for (const group of typographyRoleGroups) {
    for (const role of group.roles) {
      const labels = new Set();
      for (const style of role.styles) {
        assert.ok(!labels.has(style.label), `Repeated style label in ${role.name}: ${style.label}`);
        labels.add(style.label);
        if (!covered.has(style.token)) covered.set(style.token, new Set());
        covered.get(style.token).add(role);
      }
    }
  }
  for (const [name, roles] of covered) assert.equal(roles.size, 1, `${name} appears in more than one role`);
  assert.deepEqual([...covered.keys()].sort(), expected, 'The guidance must cover all current semantic typography roles');
});

test('typography role groups provide purpose, examples, and valid style details', () => {
  assert.equal(new Set(typographyRoleGroups.map(group => group.id)).size, typographyRoleGroups.length, 'Group identifiers must be unique');
  const names = new Set();
  for (const group of typographyRoleGroups) {
    for (const key of ['id', 'title', 'description']) assert.equal(typeof group[key], 'string', `Missing group ${key}`);
    assert.ok(group.roles.length, `Empty group: ${group.id}`);
    for (const role of group.roles) {
      for (const key of ['name', 'usage', 'example']) assert.ok(typeof role[key] === 'string' && role[key].trim(), `Missing ${key} in ${group.id}`);
      assert.ok(!names.has(role.name), `Duplicate role: ${role.name}`);
      names.add(role.name);
      assert.ok(role.styles.length, `No examples for ${role.name}`);
      for (const style of role.styles) {
        const token = tokens.get(style.token);
        assert.equal(token?.type, 'typography', `Invalid typography token: ${style.token}`);
        assert.ok(style.label?.trim(), `Missing screen or context label: ${style.token}`);
        assert.ok(token.properties.fontFamily, `Missing font family: ${style.token}`);
        assert.ok(token.properties.fontSize.value > 0, `Invalid font size: ${style.token}`);
        assert.ok(token.properties.lineHeight > 0, `Invalid line height: ${style.token}`);
        assert.ok(token.properties.fontWeight > 0, `Invalid font weight: ${style.token}`);
      }
    }
  }
});

test('responsive versions stay together under one typography role', () => {
  const groupsByBase = new Map();
  for (const group of typographyRoleGroups) {
    for (const role of group.roles) {
      for (const style of role.styles) {
        if (!/\.(desktop|mobile|compact)$/.test(style.token)) continue;
        const base = style.token.replace(/\.(desktop|mobile|compact)$/, '');
        if (!groupsByBase.has(base)) groupsByBase.set(base, new Set());
        groupsByBase.get(base).add(role);
      }
    }
  }
  for (const [base, roles] of groupsByBase) assert.equal(roles.size, 1, `${base} is split across separate roles`);
});


test('component typography overrides reference design tokens of the expected property type', () => {
  const propertyTypes = {
    fontFamily: ['fontFamily'],
    fontSize: ['dimension'],
    fontWeight: ['fontWeight', 'number'],
    lineHeight: ['dimension', 'number'],
    letterSpacing: ['dimension'],
  };
  for (const group of typographyRoleGroups) {
    for (const role of group.roles) {
      for (const style of role.styles) {
        if (!style.overrides) continue;
        assert.ok(style.note?.trim(), `Explain component overrides for ${role.name}: ${style.label}`);
        assert.ok(Object.keys(style.overrides).length, `Empty overrides for ${role.name}: ${style.label}`);
        for (const [property, path] of Object.entries(style.overrides)) {
          assert.ok(propertyTypes[property], `Unsupported typography property: ${property}`);
          assert.ok(/^(foundation|component)\./.test(path), `Override must reference an existing design token: ${path}`);
          const token = tokens.get(path);
          assert.ok(token, `Missing override token: ${path}`);
          assert.ok(propertyTypes[property].includes(token.type), `${property} cannot use ${token.type}: ${path}`);
          if (['fontSize', 'fontWeight', 'lineHeight'].includes(property)) assert.ok(Number.parseFloat(token.value) > 0, `Invalid ${property}: ${path}`);
        }
      }
    }
  }
});


test('consolidated reference preserves all semantic roles and resolves display properties', () => {
  const reference = buildTypographyReference([...tokens.values()]);
  assert.deepEqual(reference.groups.map(group => group.title), ['Display', 'Headings', 'Body', 'Labels', 'Supporting Information']);
  const covered = new Set();
  for (const group of reference.groups) {
    for (const role of group.roles) {
      assert.equal(new Set(role.specimens.map(style => style.signature)).size, role.specimens.length, `Repeated sample in ${role.name}`);
      for (const specimen of role.specimens) {
        for (const ref of specimen.references) covered.add(ref.token);
        assert.ok(specimen.details.family);
        for (const property of ['size', 'lineHeight', 'weight']) assert.ok(specimen.details[property] > 0, `Invalid ${property} in ${role.name}`);
        for (const value of Object.values(specimen.css)) assert.doesNotMatch(value, /undefined/);
      }
    }
  }
  assert.deepEqual([...covered].sort(), [...tokens.values()].filter(token => token.type === 'typography' && token.name.startsWith('semantic.typography.')).map(token => token.name).sort());
  const compact = reference.groups.flatMap(group => group.roles).find(role => role.name === 'Compact content and values');
  assert.equal(compact.specimens.length, 1, 'Equivalent source, content, and dropdown roles share a sample');
  assert.equal(compact.specimens[0].references.length, 3);
  const project = reference.groups.flatMap(group => group.roles).find(role => role.name === 'Project card title');
  assert.equal(project.specimens.length, 1, 'Identical desktop and mobile styles are consolidated');
  assert.deepEqual(project.specimens[0].labels, ['Desktop', 'Mobile']);
});

test('reference retains meaningful responsive variants and component typography', () => {
  const reference = buildTypographyReference([...tokens.values()]);
  const roles = reference.groups.flatMap(group => group.roles);
  const greeting = roles.find(role => role.name === 'Homepage greeting');
  assert.deepEqual(greeting.specimens.map(style => style.details.size), [30, 24]);
  const byLabel = label => roles.flatMap(role => role.specimens).find(style => style.labels.includes(label)).details;
  assert.deepEqual(byLabel('New Draft / Content'), { family: 'Inter', weight: 700, size: 16, lineHeight: 24, tracking: '0px' });
  assert.deepEqual(byLabel('Editorial Direction'), { family: 'Inter', weight: 400, size: 14, lineHeight: 20, tracking: '0px' });
  assert.equal(byLabel('Mobile navigation').weight, 600);
  assert.equal(byLabel('Desktop navigation').weight, 550);
  assert.deepEqual(reference.scale.map(style => style.size), [12, 14, 16, 20, 24, 30]);
  assert.deepEqual(reference.families.map(family => family.name), ['Inter', 'Newsreader']);
  assert.deepEqual(reference.families.find(family => family.name === 'Newsreader').weights, [400, 650, 700], 'Include the serif article body and headings as well as the greeting');
});
