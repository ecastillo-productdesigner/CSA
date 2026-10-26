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

test('each entry-page font subset covers its own interface symbols', async () => {
  const pages = await Promise.all(['../dist/index.html', '../dist/design-system/index.html'].map(path => readFile(new URL(path, import.meta.url), 'utf8')));
  const htmlSymbols = html => [...html.matchAll(/class="material-symbols-outlined[^\"]*"[^>]*>([a-z0-9_]+)</g)].map(match => match[1]);
  const appRequired = new Set([...Object.values(iconAliases), ...htmlSymbols(pages[0])]);
  const dsRequired = new Set([...iconInventory.map(([symbol]) => symbol), ...htmlSymbols(pages[1])]);
  for (const source of (await appModules(pages[0])).values()) {
    for (const match of source.matchAll(/(?:createIcon|\bicon)\(([^)\n]+)\)/g)) {
      for (const name of match[1].split(',')[0].matchAll(/['"]([a-z0-9_-]+)['"]/g)) appRequired.add(iconAliases[name[1]] || name[1]);
    }
    for (const match of source.matchAll(/class="material-symbols-outlined[^"]*"[^>]*>([a-z0-9_]+)</g)) appRequired.add(match[1]);
    for (const match of source.matchAll(/['"]material-symbols-outlined['"]\s*,\s*['"]([a-z0-9_]+)['"]/g)) appRequired.add(match[1]);
    for (const match of source.matchAll(/\bicon\.textContent\s*=\s*['"]([a-z0-9_]+)['"]/g)) appRequired.add(match[1]);
  }
  // DS requirements come from its own gallery and markup. App-only runtime
  // glyphs must not force legacy symbols back into the DS catalog.
  for (const [index, html] of pages.entries()) {
    const pageRequired = index === 0 ? appRequired : dsRequired;
    const subset = new Set(html.match(/icon_names=([^&"]+)/)[1].split(','));
    for (const name of pageRequired) assert.ok(subset.has(name), `Missing glyph in ${index === 0 ? 'app' : 'DS'} font subset: ${name}`);
    assert.deepEqual([...subset].sort(), [...pageRequired].sort(), 'Each font subset should contain only its current interface symbols');
    assert.match(html, /FILL,GRAD@20\.\.48,100\.\.700,0\.\.1,(?:0|-50\.\.200)&amp;icon_names=/);
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

test('the DS icon gallery matches its own subset while app-only glyphs stay separate', async () => {
  const html = await readFile(new URL('../dist/design-system/index.html', import.meta.url), 'utf8');
  const shipped = html.match(/icon_names=([^&"]+)/)[1].split(',').sort();
  const catalog = iconInventory.map(([symbol]) => symbol).sort();
  assert.equal(new Set(catalog).size, catalog.length, 'Gallery symbols must be unique');
  assert.deepEqual(catalog, shipped, 'Keep the DS gallery in sync with its own shipped symbols');
  const app = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');
  const appSubset = app.match(/icon_names=([^&"]+)/)[1].split(',').sort();
  assert.deepEqual(appSubset, [...shipped, 'photo_camera'].sort(), 'Only the legacy result thumbnail glyph may remain app-only');

  const dropdowns = await readFile(new URL('../dist/tool-dropdowns.js', import.meta.url), 'utf8');
  assert.match(dropdowns, /createIcon\(['"]unfold_less['"],\s*['"]tool-dropdown-chevron['"]\)/,
    'App and DS dropdowns use the approved unfold_less glyph');
  assert.doesNotMatch(dropdowns, /unfold_more/, 'The replaced double-chevron glyph must not return');
});
