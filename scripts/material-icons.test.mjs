import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { iconAliases } from '../dist/icons.js';

test('every interface symbol is included in the Google Fonts subset for both entry pages', async () => {
  const pages = await Promise.all(['../dist/index.html', '../dist/design-system/index.html'].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  const required = new Set(Object.values(iconAliases));
  for (const html of pages) for (const match of html.matchAll(/class="material-symbols-outlined[^\"]*"[^>]*>([a-z_]+)</g)) required.add(match[1]);
  for (const name of await readdir(new URL('../dist/', import.meta.url))) {
    if (!name.endsWith('.js')) continue;
    const js = await readFile(new URL('../dist/' + name, import.meta.url), 'utf8');
    for (const match of js.matchAll(/createIcon\('([a-z_]+)'/g)) required.add(iconAliases[match[1]] || match[1]);
  }
  for (const html of pages) {
    const subset = new Set(html.match(/icon_names=([^&"]+)/)[1].split(','));
    for (const name of required) assert.ok(subset.has(name), `Missing glyph in font subset: ${name}`);
    assert.match(html, /FILL,GRAD@20\.\.48,100\.\.700,0\.\.1,0/);
    assert.doesNotMatch(html, /<svg|<symbol|href="#icon-/);
  }
});

test('Quill cannot overwrite the shared Material Symbols toolbar with its own icons', async () => {
  const editor = await readFile(new URL('../dist/editor.js', import.meta.url), 'utf8');
  assert.doesNotMatch(editor, /Quill\.import\('ui\/icons'\)/);
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const name of ['format_bold', 'format_italic', 'format_underlined', 'format_strikethrough']) assert.ok(html.includes('>' + name + '</span>'));
});
