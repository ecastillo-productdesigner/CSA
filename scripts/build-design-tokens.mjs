import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function flattenTokens(group, prefix = '', output = []) {
  for (const [name, item] of Object.entries(group)) {
    if (name.startsWith('$')) continue;
    const path = prefix ? `${prefix}.${name}` : name;
    if (item && typeof item === 'object' && '$value' in item) output.push({ path, ...item });
    else if (item && typeof item === 'object') flattenTokens(item, path, output);
  }
  return output;
}
export const cssName = path => `--csa-${path.replaceAll('.', '-')}`;
const reference = value => typeof value === 'string' && /^\{[^{}]+\}$/.test(value) ? value.slice(1, -1) : null;
export function resolveToken(path, tokens, trail = []) {
  if (trail.includes(path)) throw new Error(`Circular token reference: ${[...trail, path].join(' → ')}`);
  const token = tokens.get(path);
  if (!token) throw new Error(`Unknown token reference: ${path}`);
  const resolveValue = value => {
    const target = reference(value);
    if (target) return resolveToken(target, tokens, [...trail, path]);
    if (Array.isArray(value)) return value.map(resolveValue);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item)]));
    return value;
  };
  const alias = reference(token.$value);
  if (alias && !tokens.has(alias)) throw new Error(`Unknown token reference: ${alias}`);
  if (alias && token.$type !== tokens.get(alias).$type) throw new Error(`Type mismatch: ${path} → ${alias}`);
  return resolveValue(token.$value);
}
function dimension(value) { return `${value.value}${value.unit}`; }
function color(value) {
  const bytes = value.components.map(c => Math.round(c * 255));
  if (value.alpha !== undefined && value.alpha < 1) bytes.push(Math.round(value.alpha * 255));
  return '#' + bytes.map(c => c.toString(16).padStart(2, '0')).join('');
}
function family(value) { return (Array.isArray(value) ? value : [value]).map(v => /\s/.test(v) ? JSON.stringify(v) : v).join(', '); }
const typographyTypes = { fontFamily: 'fontFamily', fontSize: 'dimension', fontWeight: 'fontWeight', letterSpacing: 'dimension', lineHeight: 'number' };
const kebab = value => value.replace(/[A-Z]/g, m => '-'+m.toLowerCase());
export function cssValue(type, value, aliases = true) {
  const target = reference(value);
  if (target && aliases) return `var(${cssName(target)})`;
  if (type === 'dimension' || type === 'duration') return dimension(value);
  if (type === 'color') return color(value);
  if (type === 'fontFamily') return family(value);
  if (type === 'cubicBezier') return `cubic-bezier(${value.join(', ')})`;
  if (type === 'shadow') {
    return (Array.isArray(value) ? value : [value]).map(s => `${s.inset ? 'inset ' : ''}${cssValue('dimension',s.offsetX)} ${cssValue('dimension',s.offsetY)} ${cssValue('dimension',s.blur)} ${cssValue('dimension',s.spread)} ${cssValue('color',s.color)}`).join(', ');
  }
  if (type === 'typography') return `${cssValue('fontWeight',value.fontWeight)} ${cssValue('dimension',value.fontSize)}/${cssValue('number',value.lineHeight)} ${cssValue('fontFamily',value.fontFamily)}`;
  return String(value);
}
function validate(token, value) {
  const validDimension = d => d && Number.isFinite(d.value) && ['px','rem'].includes(d.unit);
  const validColor = c => c && c.colorSpace === 'srgb' && c.components?.length === 3 && c.components.every(v=>Number.isFinite(v)&&v>=0&&v<=1) && (c.alpha===undefined || (c.alpha>=0&&c.alpha<=1));
  const type = token.$type;
  let valid = false;
  if(type==='color') valid=validColor(value);
  if(type==='dimension') valid=validDimension(value);
  if(type==='duration') valid=Number.isFinite(value.value)&&value.value>=0&&['ms','s'].includes(value.unit);
  if(type==='number'||type==='fontWeight') valid=Number.isFinite(value);
  if(type==='fontFamily') valid=typeof value==='string'||(Array.isArray(value)&&value.length>0&&value.every(v=>typeof v==='string'));
  if(type==='cubicBezier') valid=Array.isArray(value)&&value.length===4&&value.every(Number.isFinite)&&value[0]>=0&&value[0]<=1&&value[2]>=0&&value[2]<=1;
  if(type==='shadow') valid=(Array.isArray(value)?value:[value]).every(s=>validColor(s.color)&&['offsetX','offsetY','blur','spread'].every(k=>validDimension(s[k])));
  if(type==='typography') valid=validDimension(value.fontSize)&&validDimension(value.letterSpacing)&&Number.isFinite(value.fontWeight)&&Number.isFinite(value.lineHeight)&&Boolean(value.fontFamily);
  if(!valid) throw new Error(`Invalid ${type} value: ${token.path}`);
}
export function compileTokens(source) {
  const list = flattenTokens(source);
  const map = new Map(list.map(token=>[token.path,token]));
  const names = new Set();
  const lines = ['/* Generated from tokens.json. Edit the JSON source, then run npm run design-system:build. */', ':root {'];
  const flat = list.map(token=>{
    const variable=cssName(token.path);
    const exportedNames = token.$type === 'typography' ? Object.keys(typographyTypes).map(key => `${variable}-${kebab(key)}`) : [variable];
    for (const name of exportedNames) {
      if(names.has(name))throw new Error(`CSS variable collision: ${name}`);
      names.add(name);
    }
    const resolved=resolveToken(token.path,map);
    validate(token,resolved);
    if(token.$type==='typography') {
      const alias = reference(token.$value);
      for(const [key,type] of Object.entries(typographyTypes)) lines.push(`  ${variable}-${kebab(key)}: ${alias ? `var(${cssName(alias)}-${kebab(key)})` : cssValue(type,token.$value[key])};`);
    } else lines.push(`  ${variable}: ${cssValue(token.$type,token.$value)};`);
    return { name:token.path, designName:token.path.replaceAll('.','/'), cssVariable:variable, type:token.$type, layer:token.path.split('.')[0], category:token.path.split('.')[1], value:cssValue(token.$type,resolved,false), reference:reference(token.$value)||'', description:token.$description||'', status:token.$extensions?.['com.csa']?.status||'observed', ...(token.$type==='typography'?{properties:resolved}:{}), ...(token.$type==='color'?{color:resolved}:{}) };
  });
  lines.push('}', '');
  const quote=value=>'"'+String(value).replaceAll('"','""')+'"';
  const columns=['name','designName','cssVariable','layer','category','type','value','reference','description','status'];
  const csv=[columns.join(','),...flat.map(row=>columns.map(key=>quote(row[key])).join(','))].join('\n')+'\n';
  return { css:lines.join('\n'), flat, csv };
}

// CSS query conditions cannot read custom properties. Resolve only token()
// references at build time; every editable threshold stays in tokens.json.
export function compileStyleSheet(css, source) {
  const tokens = new Map(flattenTokens(source).map(token => [token.path, token]));
  return '/* Generated from styles/ and design-system/tokens.json. Do not edit directly. */\n' + css.replace(/token\(([\w.-]+)\)/g, (_, path) => {
    const token = tokens.get(path);
    if (!token) throw new Error(`Unknown stylesheet token: ${path}`);
    return cssValue(token.$type, resolveToken(path, tokens), false);
  });
}

async function main() {
  const dir=new URL('../dist/design-system/',import.meta.url);
  const source=JSON.parse(await readFile(new URL('tokens.json',dir),'utf8'));
  const {css,flat,csv}=compileTokens(source);
  const outputs={'tokens.css':css,'tokens-flat.json':JSON.stringify({version:source.$extensions['com.csa'].version,tokens:flat},null,2)+'\n','tokens.csv':csv};
  for (const [input, output] of [['../../styles/app.css', '../styles.css'], ['../../styles/guide.css', 'guide.css']]) {
    outputs[output] = compileStyleSheet(await readFile(new URL(input, dir), 'utf8'), source);
  }
  const exportCSS = compileStyleSheet(await readFile(new URL('../../styles/export.css', dir), 'utf8'), source);
  outputs['export-styles.js'] = '// Generated from design-system tokens and styles/export.css.\nexport const documentStyles = ' + JSON.stringify(css + exportCSS) + ';\n';
  for (const [input, output] of [['material-check.svg', '../assets/material-check.svg'], ['sidebar-expand-cursor.svg', '../sidebar-expand-cursor.svg'], ['favicon.svg', '../favicon.svg']]) {
    const asset = await readFile(new URL('../../styles/assets/' + input, dir), 'utf8');
    outputs[output] = compileStyleSheet(asset, source).replace(/^\/\*[^\n]*\*\/\n/, '');
  }
  for(const [name,content] of Object.entries(outputs)) {
    const file=new URL(name,dir);
    if(process.argv.includes('--check')) {
      if(await readFile(file,'utf8')!==content)throw new Error(`${name} is stale. Run npm run design-system:build.`);
    } else await writeFile(file,content);
  }
  console.log(`${flat.length} design tokens ${process.argv.includes('--check')?'verified':'generated'} (JSON → CSS, flat JSON, CSV).`);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
