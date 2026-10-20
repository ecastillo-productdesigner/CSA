import test from 'node:test';
import assert from 'node:assert/strict';
import { audienceWordCounts, normalizeWordCount, setProjectWordCount } from '../dist/variant-word-count.js';
import { presetConfiguration, setSavedPresetSettings } from '../dist/preset-settings.js';
import { sampleVariant } from '../dist/outputs.js';

test('audience word-count choices have the requested ranges and legacy defaults',()=>{
  assert.deepEqual(audienceWordCounts,{short:{min:500,max:800},medium:{min:800,max:1200},long:{min:1200,max:1500}});
  for(const value of [undefined,null,'','invalid']) assert.equal(normalizeWordCount(value),'short');
  for(const value of ['short','medium','long']) assert.equal(normalizeWordCount(value),value);
});
test('changing the target detaches an applied preset while retaining variant preferences',()=>{
  const project={variantPreset:{outputId:'saved'},toolPreferences:{audience:'general'},targetWordCount:'short'};
  assert.equal(setProjectWordCount(project,'short'),false);
  assert.ok(project.variantPreset);
  assert.equal(setProjectWordCount(project,'medium'),true);
  assert.equal(project.variantPreset,undefined);
  assert.equal(project.targetWordCount,'medium');
  assert.deepEqual(project.toolPreferences,{audience:'general'});
});
test('new variants snapshot their own word-count target',()=>{
  const project={outputs:[],sources:[],targetWordCount:'medium'};
  const variant=sampleVariant(project,[{key:'audience',value:'general',label:'General Audience'}]);
  project.targetWordCount='long';
  assert.equal(variant.targetWordCount,'medium');
  assert.equal(variant.toolPreferences.audience,'general');
});
test('saved-preset word-count edits stay independent from the generated variant',()=>{
  const output={targetWordCount:'medium',toolPreferences:{audience:'general'},labels:[],editorialDirection:'',draftText:'Approved content'};
  setSavedPresetSettings(output,{name:'Long briefing',toolPreferences:output.toolPreferences,labels:[],editorialDirection:'',targetWordCount:'long'});
  assert.equal(presetConfiguration(output).targetWordCount,'long');
  assert.equal(output.targetWordCount,'medium');
  assert.equal(output.draftText,'Approved content');
});
