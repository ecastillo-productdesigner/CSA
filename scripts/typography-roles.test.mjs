import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileTokens } from './build-design-tokens.mjs';
import { typographyRoleGroups } from '../dist/design-system/typography-roles.js';

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


test('component typography overrides reference foundation tokens of the expected property type', () => {
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
          assert.ok(path.startsWith('foundation.'), `Override must reference an existing foundation token: ${path}`);
          const token = tokens.get(path);
          assert.ok(token, `Missing override token: ${path}`);
          assert.ok(propertyTypes[property].includes(token.type), `${property} cannot use ${token.type}: ${path}`);
          if (['fontSize', 'fontWeight', 'lineHeight'].includes(property)) assert.ok(Number.parseFloat(token.value) > 0, `Invalid ${property}: ${path}`);
        }
      }
    }
  }
});
