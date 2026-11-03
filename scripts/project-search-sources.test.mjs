import test from 'node:test';
import assert from 'node:assert/strict';
import { sampleSearchSources } from '../dist/search.js';
import { sourcePreviewParagraphs } from '../dist/sources.js';
import { hasSelectedSources, sampleVariant } from '../dist/outputs.js';

for (const query of ['Local school openings', 'Kelly Clarkson']) {
  test(`topic sources for ${query} are selected, previewable, and explicitly fictional`, () => {
    const sources = sampleSearchSources(query);
    assert.equal(sources.length, 8);
    assert.equal(hasSelectedSources({ sources }), true);
    for (const source of sources) {
      assert.equal(source.type, 'text');
      assert.equal(source.selected, true);
      assert.ok(source.title.includes(query));
      assert.equal(source.url, undefined);
      assert.match(source.text, /^Fictional sample article · .+ · \d{4}-\d{2}-\d{2}\n\n/);
      const paragraphs = sourcePreviewParagraphs(source);
      assert.ok(paragraphs.length > 1);
      assert.ok(paragraphs.every(paragraph => paragraph.trim().length > 0));
    }
    const output = sampleVariant({ sources, outputs: [] }, [{ key: 'format', value: 'standard', label: 'Standard Format' }]);
    assert.equal(output.sourceCount, 8);
    assert.deepEqual(output.sourceSnapshots, sources);
    assert.equal(output.status, 'pending');
  });
}

test('each topic search owns independent source records and selections', () => {
  const first = sampleSearchSources('School openings');
  const original = structuredClone(first);
  const second = sampleSearchSources('School openings');
  assert.notStrictEqual(first, second);
  for (let index = 0; index < first.length; index++) assert.notStrictEqual(first[index], second[index]);
  first[0].selected = false;
  first[0].title = 'Edited source title';
  first[0].text = 'Edited source body';
  first.pop();
  assert.deepEqual(second, original);
});
