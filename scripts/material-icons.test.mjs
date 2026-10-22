import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { iconAliases } from '../dist/icons.js';
import { iconInventory } from '../dist/design-system/icon-inventory.js';

async function appModules(html) {
  const modules = new Map();
  async function visit(url) {
    url.search = '';
    url.hash = '';
    if (modules.has(url.href) || !url.pathname.endsWith('.js')) return;
    const source = await readFile(url, 'utf8');
    modules.set(url.href, source);
    // Follow static imports, re-exports, side-effect imports, and literal
    // dynamic imports, including demo-access.js loading app.js after sign-in.
    for (const match of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) {
      if (match[1].startsWith('.')) await visit(new URL(match[1], url));
    }
  }
  for (const match of html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)) {
    await visit(new URL(match[1], new URL('../dist/index.html', import.meta.url)));
  }
  return modules;
}

test('every interface symbol is included in the Google Fonts subset for both entry pages', async () => {
  const pages = await Promise.all(['../dist/index.html', '../dist/design-system/index.html'].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  const required = new Set(Object.values(iconAliases));
  for (const html of pages) for (const match of html.matchAll(/class="material-symbols-outlined[^\"]*"[^>]*>([a-z0-9_]+)</g)) required.add(match[1]);
  for (const source of (await appModules(pages[0])).values()) {
    for (const match of source.matchAll(/(?:createIcon|\bicon)\(([^)\n]+)\)/g)) {
      for (const name of match[1].split(',')[0].matchAll(/['"]([a-z0-9_-]+)['"]/g)) required.add(iconAliases[name[1]] || name[1]);
    }
    for (const match of source.matchAll(/class="material-symbols-outlined[^"]*"[^>]*>([a-z0-9_]+)</g)) required.add(match[1]);
    for (const match of source.matchAll(/['"]material-symbols-outlined['"]\s*,\s*['"]([a-z0-9_]+)['"]/g)) required.add(match[1]);
    for (const match of source.matchAll(/\bicon\.textContent\s*=\s*['"]([a-z0-9_]+)['"]/g)) required.add(match[1]);
  }
  for (const html of pages) {
    const subset = new Set(html.match(/icon_names=([^&"]+)/)[1].split(','));
    for (const name of required) assert.ok(subset.has(name), `Missing glyph in font subset: ${name}`);
    assert.deepEqual([...subset].sort(), [...required].sort(), 'Font subsets should contain only current interface symbols');
    assert.match(html, /FILL,GRAD@20\.\.48,100\.\.700,0\.\.1,0/);
    // Pending cards use a single SVG rectangle for their dashed border.
    // This decorative outline is separate from the Material Symbols icons.
    const withoutCardBorders = html.replace(/<svg class="output-card-dash"[^>]*>\s*<rect\b[^>]*><\/rect>\s*<\/svg>/g, '');
    assert.doesNotMatch(withoutCardBorders, /<svg\b|<symbol\b|href="#icon-/);
  }
});

test('Quill cannot overwrite the shared Material Symbols toolbar with its own icons', async () => {
  const editor = await readFile(new URL('../dist/editor.js', import.meta.url), 'utf8');
  assert.doesNotMatch(editor, /Quill\.import\('ui\/icons'\)/);
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  for (const name of ['format_bold', 'format_italic', 'format_underlined', 'format_h2', 'format_h3', 'format_quote', 'format_list_bulleted', 'format_list_numbered', 'link_2', 'undo', 'redo']) assert.ok(html.includes('>' + name + '</span>'));
});

test('the DS icon gallery includes every symbol shipped with the app', async () => {
  const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const shipped = html.match(/icon_names=([^&"]+)/)[1].split(',').sort();
  const catalog = iconInventory.map(([symbol]) => symbol).sort();
  assert.equal(new Set(catalog).size, catalog.length, 'Gallery symbols must be unique');
  assert.deepEqual(catalog, shipped, 'Keep the gallery in sync when adding or removing app icons');
});
