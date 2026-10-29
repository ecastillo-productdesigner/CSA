import { createToast } from '../toast.js?v=20261027-toast-timing';
import { createTabPanelTransition } from '../tab-panel-transition.js?v=20261026-drafting-card-size';
import { bindTabSelection } from '../selection-controls.js?v=20261026-drafting-card-size';
import { mountFeedbackSpecimens } from './feedback-specimens.js?v=20261029-revision-indicator-location';
import { mountProjectSpecimens } from './project-specimens.js?v=20261029-delete-project-dialog';
import { mountFormSpecimens } from './form-specimens.js?v=20261026-drafting-card-size';
import { mountNavigationSpecimens, mountStateSpecimens } from './navigation-specimens.js?v=20261029-preview-direction';
import { colorRoleGroups } from './color-roles.js?v=20261028-revision-indicator';
import { typographyRoleGroups } from './typography-roles.js?v=20261026-drafting-card-size';
import { createToolDropdowns } from '../tool-dropdowns.js?v=20261026-drafting-card-size';
import { populateDraftOptions } from '../draft-options.js?v=20261026-drafting-card-size';
import { iconInventory } from './icon-inventory.js?v=20261026-drafting-card-size';
import { tokenNumber } from './runtime.js?v=20261029-revision-indicator-location';
import { createOutputBadges, populateOutputContent } from '../outputs.js?v=20261026-drafting-card-size';
import { createDraftSourcesPopover } from '../draft-sources-popover.js?v=20261026-drafting-card-size';
import { createSourcePreview } from '../sources.js?v=20261029-preview-direction';
const $ = selector => document.querySelector(selector);
populateDraftOptions(document);
const toolDropdowns = createToolDropdowns();
const sourcePreview = createSourcePreview();
const toast = createToast({ root: $('#ds-toast'), message: $('#ds-toast-message'), action: $('#ds-toast-action') });
function notify(message, action = null) { toast.show(message, action); }
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
mountProjectSpecimens($('#ds-project-sample-root'));
mountFormSpecimens($('#ds-form-sample-root'));
mountNavigationSpecimens($('#ds-navigation-sample-root'), { onOpenSource: (source, opener) => sourcePreview.open(source, opener) });
mountStateSpecimens($('#ds-state-sample-root'));
mountFeedbackSpecimens($('#ds-feedback-sample-root'), toolDropdowns);
function mountDraftSourcesSpecimen(root) {
  if (!root) return;
  const usedSources = [
    {
      type: 'link', title: 'A Neighborhood Project Brings a Community Together', url: 'https://news.example.com/community-project',
      text: 'This sample source captures a neighborhood group’s plans for a shared community space. Residents discussed possible activities and how the space could be maintained.\n\nThe group collected suggestions for seating, planting, and regular volunteer sessions. These captured paragraphs remain attached to the example draft.',
    },
    {
      type: 'text', title: 'Community planning notes',
      text: 'The sample planning notes record three discussion topics: access to the space, shared maintenance, and activities for different age groups.\n\nThe next step in these example notes is to gather ideas before choosing a schedule. This is isolated DS content rather than a saved browser document.',
    },
  ];
  const project = { id: 'ds-draft-source-project', sources: [
    ...structuredClone(usedSources),
    { type: 'link', title: 'Unused project source', url: 'https://news.example.com/unused-source' },
  ] };
  const output = {
    id: 'ds-draft-source-output', status: 'ready', sourceCount: usedSources.length,
    selectedSourceIndexes: [0, 1], sourceSnapshots: structuredClone(usedSources), labels: [],
  };
  const popover = createDraftSourcesPopover({ onOpenSource: (source, opener) => sourcePreview.open(source, opener) });
  const badges = element('div', 'ds-inline');
  badges.setAttribute('role', 'group');
  badges.setAttribute('aria-label', 'Sources used by the example draft');
  badges.append(...createOutputBadges(output, { includeWordCount: false }));
  badges.addEventListener('click', event => {
    const trigger = event.target.closest('[data-variant-sources]');
    if (trigger) popover.toggle(trigger, { project, output });
  });
  root.replaceChildren(badges);
}
mountDraftSourcesSpecimen($('#ds-draft-sources-sample'));

function showToastSpecimen(restored = false) {
  const toast = $('#ds-toast-specimen');
  toast.querySelector('.toast-message').textContent = restored ? 'Source restored' : 'Source deleted';
  $('#ds-toast-undo').hidden = restored;
}
function restoreToastSpecimen() {
  showToastSpecimen(true);
  notify('Source restored');
  $('#ds-show-toast').focus({ preventScroll: true });
}
$('#ds-toast-undo').addEventListener('click', restoreToastSpecimen);
$('#ds-show-toast').addEventListener('click', () => {
  showToastSpecimen();
  notify('Source deleted', restoreToastSpecimen);
});

for (const button of document.querySelectorAll('[data-specimen-action]')) button.addEventListener('click', () => notify('Preview only'));
const contentCard = $('#ds-variant');
const contentOpen = $('#ds-content-open');
const contentBadges = contentCard.querySelector('.output-badges');
const contentEdit = $('#ds-content-edit');
const contentMenu = $('#ds-content-menu');
const contentDelete = $('#ds-content-delete');
const contentRestore = $('#ds-content-restore');
const contentContext = $('#ds-content-context');
const contentAdaptFooter = $('#ds-content-adapt-footer');
const contentAdapt = $('#ds-content-adapt');
const pendingContent = {
  id: 'ds-content-example', title: 'A Surprise Studio Session Sparks a New Creative Chapter', status: 'pending', draftText: '',
  labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'General Audience' }, { key: 'voice', label: 'Us Weekly' }],
  sourceSnapshots: [
    { type: 'text', title: 'Studio session reporting notes', text: 'A local musician invited two collaborators to an informal studio session. The group recorded an early version of a new song and agreed to meet again.' },
    { type: 'text', title: 'Creative collaboration interview', text: 'In this example interview, a collaborator describes how sharing unfinished ideas helped the group find a new direction for the project.' },
  ],
};
const contentSourcesPopover = createDraftSourcesPopover({ onOpenSource: (source, opener) => sourcePreview.open(source, opener) });
const adaptedContent = structuredClone(pendingContent);
populateOutputContent(adaptedContent);
adaptedContent.status = 'ready';
let contentState = 'selected';
let pendingContentSelected = true;
let contentDeleted = false;
function updateContentBadgeOverflow() {
  const overflows = contentBadges.scrollWidth > contentBadges.clientWidth + 1;
  contentBadges.dataset.fadeStart = String(overflows && contentBadges.scrollLeft > 1);
  contentBadges.dataset.fadeEnd = String(overflows && contentBadges.scrollLeft + contentBadges.clientWidth < contentBadges.scrollWidth - 1);
  contentBadges.tabIndex = overflows ? 0 : -1;
}
function renderContentCard() {
  const pending = contentState === 'pending';
  const selected = pending ? pendingContentSelected : contentState === 'selected';
  const output = pending ? pendingContent : adaptedContent;
  contentCard.hidden = contentDeleted;
  contentRestore.hidden = !contentDeleted;
  contentCard.dataset.ready = String(!pending);
  contentCard.dataset.selected = String(selected);
  contentCard.dataset.active = String(selected);
  contentCard.querySelector('.output-card-dash').toggleAttribute('hidden', !pending);
  contentBadges.replaceChildren(...createOutputBadges(output, { includeWordCount: false }));
  const heading = contentCard.querySelector('.output-card-title');
  heading.textContent = output.title;
  heading.title = output.title;
  if (pending) contentOpen.setAttribute('aria-pressed', String(selected));
  else contentOpen.removeAttribute('aria-pressed');
  contentOpen.setAttribute('aria-label', `${pending ? 'Select' : 'Open'} content: ${output.title}`);
  contentOpen.title = pending ? 'Select this content to draft' : selected ? 'This content is open in the editor' : 'Open this content in the editor';
  if (!pending && selected) contentOpen.setAttribute('aria-current', 'true');
  else contentOpen.removeAttribute('aria-current');
  contentContext.textContent = pending ? (contentDeleted ? 'To Draft' : 'Content to Draft') : 'Drafted';
  contentAdaptFooter.hidden = !pending || contentDeleted;
  contentAdapt.disabled = !selected;
  contentAdapt.textContent = 'Draft';
  contentAdapt.title = selected ? 'Draft selected content' : 'Select content to draft';
  for (const button of document.querySelectorAll('[data-card-state]')) button.setAttribute('aria-pressed', String(button.dataset.cardState === contentState));
  updateContentBadgeOverflow();
}
function setContentCardState(state) {
  contentSourcesPopover.close();
  contentState = state;
  pendingContentSelected = true;
  contentDeleted = false;
  renderContentCard();
}
function togglePendingContentSelection() {
  if (contentCard.dataset.ready === 'true') { setContentCardState('selected'); return; }
  pendingContentSelected = !pendingContentSelected;
  renderContentCard();
}
for (const button of document.querySelectorAll('[data-card-state]')) button.addEventListener('click', () => { closeContentMenu(false); setContentCardState(button.dataset.cardState); });
contentOpen.addEventListener('click', togglePendingContentSelection);
contentCard.addEventListener('click', event => {
  const sources = event.target.closest('[data-variant-sources]');
  if (sources) {
    closeContentMenu(false);
    contentSourcesPopover.toggle(sources, { output: contentState === 'pending' ? pendingContent : adaptedContent });
    return;
  }
  if (event.target.closest('.output-open, .output-card-actions, .variant-source')) return;
  togglePendingContentSelection();
});
contentAdapt.addEventListener('click', () => {
  if (contentState !== 'pending' || !pendingContentSelected || contentDeleted) return;
  setContentCardState('selected');
  contentOpen.focus({ preventScroll: true });
});
setContentCardState('selected');
contentBadges.addEventListener('scroll', updateContentBadgeOverflow, { passive: true });
const contentBadgeObserver = new ResizeObserver(updateContentBadgeOverflow);
contentBadgeObserver.observe(contentBadges);
for (const badge of contentBadges.children) contentBadgeObserver.observe(badge);
function closeContentMenu(restoreFocus = true) {
  if (contentMenu.hidden) return;
  contentMenu.hidden = true;
  contentEdit.setAttribute('aria-expanded', 'false');
  if (restoreFocus && contentEdit.isConnected) contentEdit.focus({ preventScroll: true });
}
function openContentMenu() {
  const rect = contentEdit.getBoundingClientRect();
  const inset = tokenNumber('foundation.space.12');
  const gap = tokenNumber('foundation.space.4');
  contentMenu.hidden = false;
  const width = contentMenu.offsetWidth;
  const height = contentMenu.offsetHeight;
  const left = Math.max(inset, Math.min(rect.right - width, window.innerWidth - width - inset));
  const below = rect.bottom + gap;
  const top = below + height <= window.innerHeight - inset ? below : Math.max(inset, rect.top - height - gap);
  contentMenu.style.left = `${Math.round(left)}px`;
  contentMenu.style.top = `${Math.round(top)}px`;
  contentEdit.setAttribute('aria-expanded', 'true');
  contentDelete.focus({ preventScroll: true });
}
contentEdit.addEventListener('click', () => {
  if (contentMenu.hidden) openContentMenu();
  else closeContentMenu();
});
contentEdit.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault();
  openContentMenu();
});
contentMenu.addEventListener('keydown', event => {
  if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    contentDelete.focus();
  }
});
document.addEventListener('keydown', event => {
  if (contentMenu.hidden) return;
  if (event.key === 'Escape') { event.preventDefault(); closeContentMenu(); }
  else if (event.key === 'Tab') closeContentMenu();
});
document.addEventListener('pointerdown', event => {
  if (!contentMenu.hidden && !contentMenu.contains(event.target) && !contentEdit.contains(event.target)) closeContentMenu(false);
});
window.addEventListener('resize', () => closeContentMenu());
window.addEventListener('scroll', () => closeContentMenu(), true);
contentDelete.addEventListener('click', () => {
  closeContentMenu(false);
  contentDeleted = true;
  renderContentCard();
  contentRestore.focus();
  notify('Draft deleted');
});
contentRestore.addEventListener('click', () => {
  contentDeleted = false;
  renderContentCard();
  contentEdit.focus();
  notify('Draft restored');
});
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
  const colorCount = colorRoleGroups.reduce((count, group) => count + group.colors.length, 0);
  $('#ds-color-count').textContent = `${colorCount} colors · usage and opacity`;
  for (const group of colorRoleGroups) {
    const section = element('section', 'ds-color-group');
    section.id = `colors-${group.id}`;
    const heading = element('h4', 'ds-foundation-group-title', group.title);
    heading.id = `${section.id}-title`;
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading, element('p', 'ds-foundation-group-description', group.description));
    const grid = element('div', 'ds-palette');
    for (const role of group.colors) {
      const token = byName.get(role.token);
      const swatch = element('article', 'ds-swatch');
      swatch.dataset.colorToken = role.token;
      const sample = element('div', 'ds-swatch-sample');
      sample.setAttribute('aria-hidden', 'true');
      const fill = element('span', 'ds-swatch-fill');
      fill.style.backgroundColor = token.value;
      sample.append(fill);
      swatch.append(sample, element('h5', '', role.name), element('code', '', token.value.toUpperCase()));
      if (role.opacity !== undefined) swatch.append(element('span', 'ds-swatch-opacity', `${+(role.opacity * 100).toFixed(1)}% opacity`));
      swatch.append(element('p', 'ds-swatch-use', role.description), element('small', '', role.token));
      grid.append(swatch);
    }
    section.append(grid);
    $('#ds-palette').append(section);
  }
  for (const group of typographyRoleGroups) {
    const section = element('section', 'ds-type-group');
    section.id = `type-${group.id}`;
    const heading = element('h4', 'ds-foundation-group-title', group.title);
    heading.id = `${section.id}-title`;
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading, element('p', 'ds-foundation-group-description', group.description));
    for (const role of group.roles) {
      const row = element('article', 'ds-type-role');
      const purpose = element('div', 'ds-type-purpose');
      purpose.append(element('h5', '', role.name), element('p', '', role.usage));
      const examples = element('div', 'ds-type-examples');
      for (const style of role.styles) {
        const token = byName.get(style.token);
        const type = token.properties;
        const item = element('div', 'ds-type-example');
        item.dataset.typographyToken = style.token;
        const specimen = element('p', 'ds-type-sample', role.example);
        for (const prop of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing']) {
          const suffix = prop.replace(/[A-Z]/g, match => '-' + match.toLowerCase());
          specimen.style[prop] = `var(${token.cssVariable}-${suffix})`;
        }
        for (const [property, name] of Object.entries(style.overrides || {})) {
          specimen.style[property] = `var(${byName.get(name).cssVariable})`;
        }
        const fontSize = style.overrides?.fontSize ? Number.parseFloat(byName.get(style.overrides.fontSize).value) : type.fontSize.value;
        const lineHeight = style.overrides?.lineHeight ? Number.parseFloat(byName.get(style.overrides.lineHeight).value) : +(fontSize * type.lineHeight).toFixed(2);
        const fontWeight = style.overrides?.fontWeight ? byName.get(style.overrides.fontWeight).value : type.fontWeight;
        const specs = `${fontSize} px size · ${lineHeight} px line height · weight ${fontWeight}`;
        const details = element('details', 'ds-type-details');
        const tracking = style.overrides?.letterSpacing ? byName.get(style.overrides.letterSpacing).value : typeof type.letterSpacing === 'object' ? `${type.letterSpacing.value}${type.letterSpacing.unit}` : type.letterSpacing;
        details.append(element('summary', '', 'Token and letter spacing'), element('code', '', token.name), element('p', '', `Letter spacing: ${tracking}`));
        item.append(element('p', 'ds-type-variant-label', style.label), specimen, element('p', 'ds-type-specs', specs), details);
        if (style.note) item.append(element('p', 'ds-type-specs', style.note));
        examples.append(item);
      }
      row.append(purpose, examples);
      section.append(row);
    }
    $('#ds-type-specimens').append(section);
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
        catch {notify('Couldn’t copy CSS. Select its value in the table');}
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

const segmentPreview = $('#ds-segment-content');
const segmentTransition = createTabPanelTransition(segmentPreview);
let segmentView = 'drafted';
const segmentSelection = bindTabSelection({
  root: $('#ds-status-tabs'),
  items: [...document.querySelectorAll('[data-segment-specimen]')],
  getValue: button => button.dataset.segmentSpecimen,
  panel: segmentPreview,
  onSelect: view => {
    if (view === segmentView) return;
    segmentTransition.run(() => {
      segmentView = view;
      segmentSelection.sync(view);
      segmentPreview.textContent = view === 'drafted' ? 'Your draft requests will appear here.' : 'Your draft recipes will appear here.';
    });
  },
});
segmentSelection.sync(segmentView);
