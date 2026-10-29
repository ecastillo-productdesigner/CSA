import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { projectOutputs, outputIsReady } from '../dist/outputs.js';

const app = await readFile(new URL('../dist/app.js', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('function renderSourceStory('), app.indexOf('\nfunction showEditorProject('));

test('source-first welcome stays empty and clears its presentation when showing captured content', () => {
  const node = () => {
    const classes = new Set();
    return { hidden: false, textContent: '', classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } }, replaceChildren(...children) { this.children = children; } };
  };
  const controls = Object.fromEntries(['output-placeholder', 'source-story-content', 'source-story-title', 'source-story-body'].map(id => [`#${id}`, node()]));
  const calls = [];
  const context = { projectOutputs, outputIsReady, $: selector => controls[selector], element: (tag, className, textContent) => ({ tag, className, textContent }), contentPreview: { hide() { calls.push('hide'); }, render(value) { calls.push(value); } } };
  runInNewContext(source, context);
  const project = { linkCards: true, sources: [{ type: 'link', url: 'https://example.com/story', selected: true }], sourceStory: { title: 'Legacy generated title', paragraphs: ['Legacy generated body.'] } };
  const before = structuredClone(project);
  context.renderSourceStory(project);
  assert.equal(controls['#output-placeholder'].classList.contains('has-project-welcome'), true);
  assert.equal(controls['#source-story-title'].hidden, true);
  assert.equal(controls['#source-story-body'].children[0].textContent, 'To start, choose a Format, Audience, or Voice in the New Draft panel, then select Add to List.');
  assert.deepEqual(project, before, 'rendering a welcome must not invent or save source-derived article text');
  const captured = { text: 'Captured document text.' };
  context.renderSourceStory({ contentPreview: captured });
  assert.equal(controls['#output-placeholder'].classList.contains('has-project-welcome'), false);
  assert.equal(controls['#source-story-content'].classList.contains('project-welcome'), false);
  assert.equal(controls['#source-story-title'].hidden, false);
  assert.equal(calls.at(-1), captured);
});
