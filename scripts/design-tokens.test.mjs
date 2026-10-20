import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileTokens } from './build-design-tokens.mjs';

const number = value => ({$type:'number',$value:value});
const dimension = value => ({$type:'dimension',$value:{value,unit:'px'}});
const color = (components,alpha=1) => ({$type:'color',$value:{colorSpace:'srgb',components,alpha}});

test('three token layers preserve CSS aliases and resolve export values',()=>{
  const result=compileTokens({foundation:{space:dimension(16)},semantic:{space:{$type:'dimension',$value:'{foundation.space}'}},component:{gap:{$type:'dimension',$value:'{semantic.space}'}}});
  assert.match(result.css,/--csa-component-gap: var\(--csa-semantic-space\)/);
  assert.equal(result.flat.find(t=>t.name==='component.gap').value,'16px');
  assert.match(result.csv,/component\/gap/);
});
test('invalid alias graphs fail instead of generating broken CSS',()=>{
  assert.throws(()=>compileTokens({a:{$type:'number',$value:'{b}'}}),/Unknown token reference: b/);
  assert.throws(()=>compileTokens({a:{$type:'number',$value:'{b}'},b:{$type:'number',$value:'{a}'}}),/Circular token reference/);
  assert.throws(()=>compileTokens({a:{$type:'dimension',$value:'{b}'},b:number(3)}),/Type mismatch/);
});
test('CSS name collisions and invalid dimensions are rejected',()=>{
  assert.throws(()=>compileTokens({a:{b:number(1)},'a-b':number(2)}),/CSS variable collision/);
  assert.throws(()=>compileTokens({bad:dimension(Infinity)}),/Invalid dimension/);
});
test('sRGB alpha colors preserve observed eight digit hex values',()=>{
  const result=compileTokens({shadow:color([77/255,93/255,121/255],8/255)});
  assert.equal(result.flat[0].value,'#4d5d7908');
});
test('composite typography and typography aliases expand to CSS properties',()=>{
  const result=compileTokens({base:{$type:'typography',$value:{fontFamily:['Inter','sans-serif'],fontSize:{value:16,unit:'px'},fontWeight:700,letterSpacing:{value:0,unit:'px'},lineHeight:1.25}},button:{$type:'typography',$value:'{base}'}});
  assert.match(result.css,/--csa-base-line-height: 1.25/);
  assert.match(result.css,/--csa-button-font-size: var\(--csa-base-font-size\)/);
  assert.equal(result.flat[1].properties.fontSize.value,16);
});
test('all production and reference CSS token references exist in generated CSS',async()=>{
  const source=JSON.parse(await readFile(new URL('../dist/design-system/tokens.json',import.meta.url),'utf8'));
  const result=compileTokens(source);
  const declarations=new Set([...result.css.matchAll(/(--csa-[\w-]+):/g)].map(m=>m[1]));
  for(const path of ['../dist/styles.css','../dist/design-system/guide.css']) {
    const css=await readFile(new URL(path,import.meta.url),'utf8');
    for(const match of css.matchAll(/var\((--csa-[\w-]+)/g)) assert.ok(declarations.has(match[1]),`${path}: missing ${match[1]}`);
  }
  for(const match of result.css.matchAll(/var\((--csa-[\w-]+)/g)) assert.ok(declarations.has(match[1]),`generated alias: missing ${match[1]}`);
});
test('mobile viewport thresholds stay in sync with documented tokens',async()=>{
  const source=JSON.parse(await readFile(new URL('../dist/design-system/tokens.json',import.meta.url),'utf8'));
  const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
  const tokens=compileTokens(source).flat;
  for(const [name,query] of [['mobile','max-width'],['desktop-start','min-width']]) {
    const value=tokens.find(t=>t.name===`foundation.breakpoint.${name}`).value;
    assert.ok(css.includes(`(${query}: ${value})`),`${name}: ${value}`);
  }
});

test('embedded SVG images keep literal colors because CSS variables cannot cross into assets',async()=>{
  const css=await readFile(new URL('../dist/styles.css',import.meta.url),'utf8');
  const assets=[...css.matchAll(/url\("(data:[^"]+)"\)/g)].map(match=>decodeURIComponent(match[1]));
  for(const asset of assets) assert.ok(!asset.includes('var('),'Custom property inside an isolated data URL');
  const check = await readFile(new URL('../dist/assets/material-check.svg', import.meta.url), 'utf8');
  assert.match(check, /fill="#ffffff"/, 'Checkbox retains its visible white Google glyph');
  assert.match(check, /M382-240 154-468/, 'Checkbox uses the official Material Symbols check path');
});
