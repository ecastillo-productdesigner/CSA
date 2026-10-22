import { createToolDropdowns } from '../tool-dropdowns.js?v=20261021-editor-subhead';
import { iconInventory } from './icon-inventory.js?v=20261021-editor-subhead';
const $ = selector => document.querySelector(selector);
createToolDropdowns();
let toastTimer;
function notify(message) {
  const toast = $('#ds-toast');
  $('#ds-toast-message').textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function renderIconInventory() {
  const grid = $('#ds-icon-grid');
  if (!grid) return;
  const items = iconInventory.map(([symbol, name]) => {
    const item = element('div', 'ds-icon-item');
    const states = element('div', 'ds-icon-states');
    for (const [fill, label] of [[0, 'Unselected'], [1, 'Selected']]) {
      const state = element('div', 'ds-icon-state');
      const icon = element('span', 'material-symbols-outlined', symbol);
      icon.dataset.iconFill = fill;
      icon.setAttribute('aria-hidden', 'true');
      state.append(icon, element('small', '', label));
      states.append(state);
    }
    item.append(element('h4', 'ds-icon-name', name), element('code', '', symbol), states);
    return item;
  });
  grid.replaceChildren(...items);
  $('#ds-icon-count').textContent = `${iconInventory.length} product icons`;
}
renderIconInventory();
$('#ds-toast-undo').addEventListener('click', () => {
  const toast = $('#ds-toast-specimen');
  toast.querySelector('.toast-message').textContent = 'Source restored.';
  toast.querySelector('.toast-icon').hidden = true;
  $('#ds-toast-undo').hidden = true;
  $('#ds-show-toast').focus({ preventScroll: true });
});
$('#ds-show-toast').addEventListener('click', () => {
  const toast = $('#ds-toast-specimen');
  toast.querySelector('.toast-message').textContent = 'Source deleted.';
  toast.querySelector('.toast-icon').hidden = false;
  $('#ds-toast-undo').hidden = false;
});
for (const button of document.querySelectorAll('[data-specimen-action]')) button.addEventListener('click', () => notify('Component preview · no project changes'));
const contentCard = $('#ds-variant');
const contentSelection = $('#ds-content-select');
const contentOpen = $('#ds-content-open');
const contentTitle = contentCard.querySelector('.output-card-title').textContent;
function setContentCardState(state) {
  const pending = state === 'pending';
  const selected = state === 'selected';
  contentCard.dataset.ready = String(!pending);
  contentCard.dataset.selected = String(selected);
  contentCard.dataset.active = String(selected);
  contentCard.querySelector('.output-card-dash').toggleAttribute('hidden', !pending);
  contentSelection.hidden = !pending;
  contentSelection.setAttribute('aria-checked', 'false');
  contentSelection.setAttribute('aria-label', `Select content: ${contentTitle}`);
  contentOpen.setAttribute('aria-label', `${pending ? 'Select' : 'Open'} content: ${contentTitle}`);
  contentOpen.title = pending ? 'Select this content to create' : selected ? 'This content is selected' : 'Open this content';
  if (selected) contentOpen.setAttribute('aria-current', 'true');
  else contentOpen.removeAttribute('aria-current');
  for (const button of document.querySelectorAll('[data-card-state]')) button.setAttribute('aria-pressed', String(button.dataset.cardState === state));
}
function togglePendingContentSelection() {
  if (contentCard.dataset.ready === 'true') { setContentCardState('selected'); return; }
  const selected = contentCard.dataset.selected !== 'true';
  contentCard.dataset.selected = String(selected);
  contentSelection.setAttribute('aria-checked', String(selected));
  contentSelection.setAttribute('aria-label', `${selected ? 'Deselect' : 'Select'} content: ${contentTitle}`);
}
for (const button of document.querySelectorAll('[data-card-state]')) button.addEventListener('click', () => setContentCardState(button.dataset.cardState));
contentSelection.addEventListener('click', togglePendingContentSelection);
contentOpen.addEventListener('click', togglePendingContentSelection);
setContentCardState('selected');
$('#ds-source-check').addEventListener('change', event => { event.target.closest('.result-card').dataset.selected = String(event.target.checked); });
for (const button of document.querySelectorAll('[data-format-preview]')) button.addEventListener('click', () => button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')));
function luminance(hex) {
  const values = hex.slice(1,7).match(/../g).map(byte => parseInt(byte,16)/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4);
  return values[0]*.2126+values[1]*.7152+values[2]*.0722;
}
const ratio = (a,b) => { const values=[luminance(a),luminance(b)].sort((x,y)=>y-x); return ((values[0]+.05)/(values[1]+.05)).toFixed(2)+':1'; };
try {
  const response = await fetch('tokens-flat.json', {cache: 'no-cache'});
  if (!response.ok) throw new Error('Token inventory unavailable');
  const {tokens} = await response.json();
  const byName = new Map(tokens.map(token => [token.name,token]));
  $('#ds-token-total').textContent = tokens.length;
  const palette = [
    ['Canvas','semantic.color.background.canvas'], ['Surface','semantic.color.surface.default'],
    ['Text','semantic.color.text.primary'], ['Muted','semantic.color.text.muted'],
    ['Border','semantic.color.border.default'], ['Primary','semantic.color.action.primary'],
    ['Selected card','component.variant-card.selected-background'], ['Format','component.chip.format.background'],
    ['Audience','component.chip.audience.background'], ['Voice','component.chip.voice.background'],
    ['Avatar background','component.avatar.background'], ['Avatar initial','component.avatar.foreground']
  ];
  for (const [label,name] of palette) {
    const token=byName.get(name);
    const swatch=element('div','ds-swatch');
    const sample=element('div','ds-swatch-sample'); sample.style.backgroundColor=token.value;
    swatch.append(sample,element('h4','',label),element('code','',token.value.toUpperCase()),element('small','',name));
    $('#ds-palette').append(swatch);
  }
  for (const [path,label,text] of [["greeting.desktop", "Display — serif · desktop", "Hello Athena,"], ["greeting.mobile", "Display — serif · mobile", "Hello Athena,"], ["editor-heading.desktop", "Page title · desktop", "A story worth sharing"], ["editor-heading.compact", "Page title · compact", "A story worth sharing"], ["project-title.desktop", "Homepage card title · desktop", "A creative chapter begins"], ["project-title.mobile", "Homepage card title · mobile", "A creative chapter begins"], ["panel-heading", "Panel heading", "New Content"], ["dialog-heading", "Dialog heading", "New Project"], ["project-list-title", "Homepage list title", "A creative chapter begins"], ["source-title", "Source title", "The approved source behind the story"], ["variant-title", "Variant title", "A fresh perspective on the week"], ["result-title", "Article card title", "A creative project brings neighbors together"], ["article-h2", "Article heading · H2", "A new perspective"], ["article-h3", "Article heading · H3", "The details that matter"], ["body", "Body text", "Bring your notes, an article, or a rough idea."], ["project-meta.desktop", "Card metadata · desktop", "Updated today · 2 variants"], ["project-meta.mobile", "Card metadata · mobile", "Updated today · 2 variants"], ["label", "Field label", "Target Word Count"], ["field-value", "Field value", "Listicle"], ["button", "Primary button label", "Add Content"], ["secondary-button", "Secondary / tertiary label", "Cancel"], ["navigation", "Navigation label", "Sources"], ["chip", "Settings chip", "General Audience"], ["status", "Status badge", "Draft"], ["caption", "Caption / status message", "Ready to Create Content"], ["metadata", "Supporting text", "235 words · Created Oct 19, 2026"]]) {
    const token=byName.get('semantic.typography.'+path);
    const type=token.properties;
    const row=element('div','ds-type-row'); const specimen=element('p','',text);
    for(const prop of ['fontFamily','fontSize','fontWeight','lineHeight','letterSpacing']) {
      const suffix=prop.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
      specimen.style[prop]=`var(${token.cssVariable}-${suffix})`;
    }
    row.append(specimen,element('small','',`${label} · ${type.fontSize.value} / ${+(type.fontSize.value*type.lineHeight).toFixed(2)} · ${type.fontWeight}`));
    $('#ds-type-specimens').append(row);
  }
  for (const value of [4,8,12,16,24,32,48,64]) {
    const row=element('div','ds-space'); const bar=element('i');
    bar.style.width=`calc(var(--csa-foundation-space-${value}) * 3)`;
    row.append(element('span','',value+' px'),bar,element('code','',`space.${value}`));
    $('#ds-spacing').append(row);
  }
  $('#ds-muted-contrast').textContent=ratio(byName.get('semantic.color.text.muted').value,byName.get('semantic.color.surface.default').value);
  $('#ds-primary-contrast').textContent=ratio(byName.get('semantic.color.surface.default').value,byName.get('semantic.color.action.primary').value);
  function copiedValue(token) {
    if(token.type !== 'typography') return `var(${token.cssVariable})`;
    return Object.keys(token.properties).map(prop=>{
      const suffix=prop.replace(/[A-Z]/g,m=>'-'+m.toLowerCase());
      return `${suffix}: var(${token.cssVariable}-${suffix});`;
    }).join('\n');
  }
  function render() {
    const term=$('#ds-token-search').value.toLowerCase().trim(); const layer=$('#ds-token-layer').value;
    const filtered=tokens.filter(token=>(layer==='all'||token.layer===layer)&&[token.name,token.value,token.description,token.reference].join(' ').toLowerCase().includes(term));
    $('#ds-token-rows').replaceChildren();
    for(const token of filtered) {
      const row=element('tr'); const name=element('td');
      name.append(element('code','ds-token-name',token.name));
      name.append(element('code','ds-token-css',token.type==='typography'?token.cssVariable+'-{property}':token.cssVariable));
      if(token.reference) name.append(element('span','ds-token-alias','→ '+token.reference));
      const value=element('td'); const valueWrap=element('div','ds-token-value');
      if(token.type==='color') {const dot=element('span','ds-token-dot');dot.style.backgroundColor=token.value;dot.setAttribute('aria-hidden','true');valueWrap.append(dot);}
      valueWrap.append(element('code','',token.value)); value.append(valueWrap);
      if(token.type==='typography') value.append(element('span','ds-token-alias','Expands to font-family, font-size, font-weight, line-height, letter-spacing.'));
      const purpose=element('td','',token.description);
      if(token.status==='observed-exception') purpose.append(element('span','ds-token-exception','Observed exception'));
      const action=element('td');const copy=element('button','ds-copy','Copy'); copy.type='button';copy.setAttribute('aria-label','Copy CSS for '+token.name);
      copy.addEventListener('click',async()=>{
        try {await navigator.clipboard.writeText(copiedValue(token));notify('CSS copied');}
        catch {notify('Copy unavailable. Select the CSS variable in the table.');}
      });
      action.append(copy); row.append(name,value,purpose,action); $('#ds-token-rows').append(row);
    }
    $('#ds-token-count').textContent=`${filtered.length} of ${tokens.length} tokens`;
    $('#ds-token-empty').hidden=filtered.length!==0;
  }
  $('#ds-token-search').addEventListener('input',render);
  $('#ds-token-layer').addEventListener('change',render);
  render();
} catch (error) {
  $('#ds-token-count').textContent='Preview server required';
  $('#ds-token-empty').hidden=false;
  $('#ds-token-empty').textContent='Serve this folder over HTTP to load the token inventory. The JSON, CSS, and CSV downloads remain available.';
  console.error(error);
}

for (const button of document.querySelectorAll('[data-segment-specimen]')) {
  button.addEventListener('click', () => {
    for (const peer of button.parentElement.querySelectorAll('button')) peer.setAttribute('aria-pressed', String(peer === button));
  });
}
