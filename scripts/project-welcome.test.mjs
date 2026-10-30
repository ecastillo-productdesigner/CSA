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
    return { hidden: false, textContent: '', children: [], attributes: {}, events: {}, append(...children) { this.children.push(...children); }, setAttribute(name, value) { this.attributes[name] = value; }, addEventListener(name, handler) { this.events[name] = handler; }, classList: { toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); }, contains(name) { return classes.has(name); } }, replaceChildren(...children) { this.children = children; } };
  };
  const controls = Object.fromEntries(['output-placeholder', 'source-story-content', 'source-story-title', 'source-story-body', 'composer-tools-heading'].map(id => [`#${id}`, node()]));
  const calls = [];
  controls['#composer-tools-heading'].focus = options => calls.push({ focus: 'newDraft', preventScroll: options.preventScroll });
  const context = { railNavigation: { open(name) { calls.push({ open: name }); } }, projectOutputs, outputIsReady, $: selector => controls[selector], element: (tag, className, textContent) => Object.assign(node(), { tag, className, textContent }), contentPreview: { hide() { calls.push('hide'); }, render(value) { calls.push(value); } } };
  runInNewContext(source, context);
  const project = { linkCards: true, sources: [{ type: 'link', url: 'https://example.com/story', selected: true }], sourceStory: { title: 'Legacy generated title', paragraphs: ['Legacy generated body.'] } };
  const before = structuredClone(project);
  context.renderSourceStory(project);
  assert.equal(controls['#output-placeholder'].classList.contains('has-project-welcome'), true);
  assert.equal(controls['#source-story-title'].hidden, true);
  const guidance = controls['#source-story-body'].children[0];
  const [desktopLabel, mobileAction] = guidance.children;
  for (const label of [desktopLabel, mobileAction]) {
    assert.equal(guidance.textContent + label.textContent, 'To start, choose a Format, Audience, or Voice in New Draft');
  }
  assert.equal(mobileAction.tag, 'button');
  assert.equal(mobileAction.type, 'button');
  assert.equal(mobileAction.attributes['aria-controls'], 'composer-tools');
  mobileAction.events.click();
  assert.deepEqual(calls.slice(-2), [{ open: 'newVariant' }, { focus: 'newDraft', preventScroll: true }]);
  assert.deepEqual(project, before, 'rendering a welcome must not invent or save source-derived article text');
  const captured = { text: 'Captured document text.' };
  context.renderSourceStory({ contentPreview: captured });
  assert.equal(controls['#output-placeholder'].classList.contains('has-project-welcome'), false);
  assert.equal(controls['#source-story-content'].classList.contains('project-welcome'), false);
  assert.equal(controls['#source-story-title'].hidden, false);
  assert.equal(calls.at(-1), captured);
});
