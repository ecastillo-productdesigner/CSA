import { createRailPanelTransition } from '../navigation.js?v=20261029-source-panel-open';
import { createTabPanelTransition } from '../tab-panel-transition.js?v=20261026-drafting-card-size';
import { bindTabSelection, bindRovingSelection } from '../selection-controls.js?v=20261026-drafting-card-size';
import { createPanelDisclosure } from '../panel-disclosure.js?v=20261026-drafting-card-size';
import { createDraftingAnimation, createSourceAddingAnimation } from '../drafting-animation.js?v=20261030-draft-status-and-history';
import { createSourceAlreadyAddedDialog } from '../source-already-added.js?v=20261026-drafting-card-size';
import { createSourceAdditionLoading } from '../source-addition-loading.js?v=20261026-drafting-card-size';
import { createIcon } from '../icons.js?v=20261026-drafting-card-size';
import { tokenNumber } from './runtime.js?v=20261026-drafting-card-size';
import { draftOptions, populateDraftOptions, hasDraftSelection } from '../draft-options.js?v=20261026-drafting-card-size';
import { createToolDropdowns } from '../tool-dropdowns.js?v=20261026-drafting-card-size';

const navigationMounts = new WeakMap();
const stateMounts = new WeakMap();

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function button(className, label, iconName) {
  const node = element('button', className);
  node.type = 'button';
  node.setAttribute('aria-label', label);
  if (iconName) node.append(createIcon(iconName));
  return node;
}

function setSelectionIcon(icon, selected) {
  icon.style.fontVariationSettings = `"FILL" var(--csa-component-icon-${selected ? 'fill' : 'outline-fill'}), "wght" var(--csa-foundation-font-weight-400), "GRAD" var(--csa-component-icon-grade), "opsz" var(--csa-component-icon-optical-size)`;
}

export function mountNavigationSpecimens(root, { onOpenSource } = {}) {
  if (!root) return;
  if (navigationMounts.has(root)) return navigationMounts.get(root);
  root.classList.add('ds-navigation-specimens');
  const actions = element('div', 'ds-navigation-actions');
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Navigation controls');
  const newProject = button('icon-button nav-button', 'New Project', 'add_circle');
  const sources = button('icon-button nav-button', 'Project Sources', 'folder_open');
  sources.setAttribute('aria-expanded', 'false');
  sources.setAttribute('aria-controls', 'ds-navigation-selection-preview');
  const sourceIcon = sources.querySelector('.material-symbols-outlined');
  setSelectionIcon(sourceIcon, false);
  const selectedPreview = element('section', 'recents-panel sources-panel ds-navigation-panel-preview');
  const selectionStatus = element('p', 'editor-source-selection-status');
  selectionStatus.setAttribute('role', 'status');
  selectedPreview.append(selectionStatus);
  selectedPreview.id = 'ds-navigation-selection-preview';
  selectedPreview.hidden = true;
  selectedPreview.setAttribute('role', 'region');
  selectedPreview.setAttribute('aria-label', 'Project Sources navigation example');
  const sourcesTransition = createRailPanelTransition(selectedPreview, { trigger: sources });
  const profileStage = element('div', 'ds-profile-specimen');
  const profile = button('profile-button', 'Profile options for athena@example.com');
  profile.setAttribute('aria-haspopup', 'menu');
  profile.setAttribute('aria-expanded', 'false');
  profile.setAttribute('aria-controls', 'ds-navigation-profile-menu');
  profile.append(element('span', 'profile-avatar', 'A'));
  profile.firstElementChild.setAttribute('aria-hidden', 'true');
  const menu = element('div', 'profile-menu ds-navigation-profile-menu');
  menu.id = 'ds-navigation-profile-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Profile options specimen');
  const logout = button('profile-navigation profile-logout', 'Log Out example');
  logout.textContent = 'Log Out';
  logout.setAttribute('role', 'menuitem');
  menu.append(logout);
  profileStage.append(profile, menu);
  const status = element('p', 'ds-specimen-status');
  status.setAttribute('role', 'status');
  const sourceList = element('ul');
  sourceList.id = 'editor-source-list';
  const exampleSources = [
    { type: 'link', title: 'A Local Business Finds a Fresh Way to Connect', url: 'https://example.com/community-reporting', description: 'This example source describes a local business gathering ideas from its community.', selected: true },
    { type: 'text', title: 'Community background notes', text: 'These example notes record the community’s suggestions and the questions still to discuss. Choosing sources for a future draft does not edit this source text.', selected: true },
  ];
  const exampleDrafts = [
    { id: 'two-sources', label: '2 Sources', savedSourceIndexes: [0, 1] },
    { id: 'one-source', label: '1 Source', savedSourceIndexes: [1] },
  ];
  let activeDraft = exampleDrafts[0].id;
  let selectionEdited = false;
  const sourceCheckboxes = [];
  const sourceRows = [];
  const draftSwitch = element('div', 'ds-state-switch');
  draftSwitch.setAttribute('role', 'group');
  draftSwitch.setAttribute('aria-label', 'Example active draft');
  const draftButtons = exampleDrafts.map(draft => {
    const control = button('', draft.label);
    control.textContent = draft.label;
    control.dataset.exampleDraft = draft.id;
    control.setAttribute('aria-controls', sourceList.id);
    draftSwitch.append(control);
    return control;
  });
  selectedPreview.prepend(draftSwitch);
  function updateSelectionStatus() {
    const selected = exampleSources.filter(source => source.selected).length;
    selectionStatus.textContent = `${selected} of ${exampleSources.length} ${selectionEdited ? 'selected for new drafts' : 'used in this draft'}`;
  }
  function appendExampleSource(source) {
    const sourceRow = element('li');
    const selection = element('label', 'editor-source-selection');
    const checkbox = element('input', 'editor-source-checkbox');
    checkbox.type = 'checkbox';
    checkbox.checked = source.selected;
    checkbox.setAttribute('aria-label', `Use source for new drafts: ${source.title}`);
    checkbox.addEventListener('change', () => {
      source.selected = checkbox.checked;
      selectionEdited = true;
      updateSelectionStatus();
    });
    selection.append(checkbox);
    sourceCheckboxes.push(checkbox);
    const sourceContent = element('div', 'editor-source-content');
    const sourceOpen = button('editor-source-open', `Preview source: ${source.title}`);
    sourceOpen.setAttribute('aria-haspopup', 'dialog');
    sourceOpen.setAttribute('aria-controls', 'article-preview-dialog');
    sourceOpen.append(element('strong', '', source.title));
    sourceOpen.addEventListener('click', () => {
      if (onOpenSource) onOpenSource(source, sourceOpen);
      else status.textContent = 'Source preview action selected';
    });
    sourceContent.append(sourceOpen);
    sourceRow.append(selection, sourceContent);
    sourceList.append(sourceRow);
    sourceRows.push({ source, row: sourceRow });
  }
  exampleSources.forEach(appendExampleSource);
  const sourceAddition = createSourceAdditionLoading({ list: sourceList });
  sourceAddition.render('navigation-example', sourceRows);
  const duplicateDialog = createSourceAlreadyAddedDialog({ id: 'ds-source-already-added-dialog', onOpenSource });
  const draftSelection = bindRovingSelection({
    root: draftSwitch, items: draftButtons,
    getValue: control => control.dataset.exampleDraft,
    onSelect: value => {
      if (value === activeDraft) return;
      activeDraft = value;
      selectionEdited = false;
      const saved = exampleDrafts.find(draft => draft.id === value).savedSourceIndexes;
      exampleSources.forEach((source, index) => {
        source.selected = saved.includes(index);
        sourceCheckboxes[index].checked = source.selected;
      });
      draftSelection.sync(value);
      updateSelectionStatus();
    },
  });
  draftSelection.sync(activeDraft);
  updateSelectionStatus();
  const addSource = button('secondary-button editor-add-source-button', 'Add New Source');
  addSource.textContent = 'Add New Source';
  addSource.addEventListener('click', async () => {
    if (sourceAddition.isPending('navigation-example')) return;
    addSource.disabled = true;
    if (await sourceAddition.wait('navigation-example')) {
      const source = { type: 'text', title: `Additional source ${exampleSources.length - 1}`, text: 'This example source was added after the five-second green shimmer.', selected: true };
      exampleSources.push(source);
      appendExampleSource(source);
      sourceAddition.render('navigation-example', sourceRows);
      selectionEdited = true;
      updateSelectionStatus();
      status.textContent = 'Source added';
    }
    addSource.disabled = false;
  });
  selectedPreview.insertBefore(addSource, selectionStatus);
  const duplicateSource = button('secondary-button', 'Try duplicate source');
  duplicateSource.textContent = 'Try duplicate source';
  duplicateSource.addEventListener('click', () => duplicateDialog.open({ source: exampleSources[0], trigger: duplicateSource }));
  selectedPreview.append(sourceList, duplicateSource, element('p', 'ds-caption', 'Add New Source uses the shared outlined secondary button above the source list, with a 24 px gap before the selection count. In the app it opens the existing source picker for the current project, supporting article URLs and uploaded documents. After submission, the shared mint shimmer and Inter Medium Italic label “Adding Source” for one new source or “Adding Sources” for multiple new sources appear at the bottom of Project Sources for five seconds before the new rows appear. Newly added sources are checked automatically for new drafts without changing the current draft’s captured sources. Checking or unchecking an existing source updates its selection immediately without an adding animation. The five-second shimmer appears only when new sources are actually added to the project. Duplicate sources show “Source Already Added” with View Source as a secondary action and Close as the primary action. View Source opens the existing source preview within the app. Existing sources remain visible. Try Add New Source here to preview the same timing. Switch between the 2 Sources and 1 Source examples to show the sources captured by each active draft. Its exact saved set becomes checked and the counter says used in this draft. Editing a checkbox chooses sources for the next draft and changes the counter to selected for new drafts; it does not rewrite the current article or saved snapshots. Switching drafts restores that draft’s captured set. Every source row has the same three-dot Delete menu. Deleting a saved-only source hides it from this list while preserving the draft’s source history; Undo brings it back. Source titles open the shared read-only preview independently of their checkbox. Links without saved article text show five paragraphs of illustrative preview copy, with the publisher summary first when available; saved article text stays unchanged. The first source demonstrates the five-paragraph link preview. Their hover uses the shared light-gray surface, 8 px corners, and near-black text without an underline; keyboard focus keeps its visible outline.'));
  const tooltips = [];

  function hideTooltips() {
    for (const { tooltip } of tooltips) tooltip.hidden = true;
  }
  function attachTooltip(trigger, label, id) {
    const tooltip = element('span', 'navigation-tooltip ds-navigation-tooltip', label);
    tooltip.id = id;
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    trigger.setAttribute('aria-describedby', id);
    root.append(tooltip);
    const show = () => {
      hideTooltips();
      if (!menu.hidden) return;
      const rect = trigger.getBoundingClientRect();
      tooltip.hidden = false;
      const inset = tokenNumber('foundation.space.12');
      const left = Math.max(inset, Math.min(rect.right + inset, window.innerWidth - tooltip.offsetWidth - inset));
      tooltip.style.left = `${Math.round(left)}px`;
      tooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    };
    for (const type of ['mouseenter', 'focus']) trigger.addEventListener(type, show);
    for (const type of ['mouseleave', 'blur', 'click']) trigger.addEventListener(type, hideTooltips);
    tooltips.push({ trigger, tooltip });
  }
  function closeMenu(restoreFocus = false) {
    menu.hidden = true;
    profile.setAttribute('aria-expanded', 'false');
    if (restoreFocus) profile.focus({ preventScroll: true });
  }
  function openMenu() {
    hideTooltips();
    menu.hidden = false;
    profile.setAttribute('aria-expanded', 'true');
    const triggerBounds = profile.getBoundingClientRect();
    const stageBounds = profileStage.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const menuBounds = menu.getBoundingClientRect();
    const left = Math.max(inset, Math.min(triggerBounds.left, window.innerWidth - menuBounds.width - inset));
    const below = triggerBounds.height + gap;
    menu.style.left = `${left - stageBounds.left}px`;
    menu.style.right = 'auto';
    menu.style.top = `${triggerBounds.bottom + gap + menuBounds.height <= window.innerHeight - inset ? below : -menuBounds.height - gap}px`;
    logout.focus({ preventScroll: true });
  }
  newProject.addEventListener('click', () => {
    closeMenu();
    status.textContent = 'New Project action selected';
  });
  sources.addEventListener('click', () => {
    closeMenu();
    const selected = sources.getAttribute('aria-expanded') !== 'true';
    sources.setAttribute('aria-expanded', String(selected));
    setSelectionIcon(sourceIcon, selected);
    sourcesTransition.setVisible(selected);
  });
  profile.addEventListener('click', () => menu.hidden ? openMenu() : closeMenu(true));
  profile.addEventListener('keydown', event => {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    openMenu();
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
    } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      logout.focus();
    } else if (event.key === 'Tab') closeMenu(true);
  });
  logout.addEventListener('click', () => {
    closeMenu(true);
    status.textContent = 'Log Out example selected';
  });
  document.addEventListener('pointerdown', event => {
    if (!menu.hidden && !profileStage.contains(event.target)) closeMenu();
  });
  root.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !tooltips.some(({ tooltip }) => !tooltip.hidden)) return;
    event.preventDefault();
    hideTooltips();
  });
  window.addEventListener('resize', () => { hideTooltips(); closeMenu(); });
  window.addEventListener('scroll', hideTooltips, true);
  actions.append(newProject, sources, profileStage);
  const guidance = element('p', 'ds-caption', 'The desktop left navigation expands and collapses over 200 ms with ease timing. Desktop Project Sources uses the same 200 ms timing with a short slide on open and close; mobile New Draft, Content, and Sources open and close immediately. Closing controls leave the focus order immediately; reduced motion changes both panels immediately. The mobile workspace header has two rows: CSA on the left and New Project and the account control on the right, then a divider above equal-width New Draft, Content, and Sources controls. Navigation labels use 14 px / 20 px Inter Semibold below 20 px icons with a 6 px gap; navigation targets are 60 px tall and utility targets are at least 44 px. The header is 167 px tall with 16 px outer insets, and content and open panels begin 199 px from the top, including at 320 px widths. Keyboard order follows the visible rows. The header remains above the panel backdrop, so the selected teal control stays visible and users can switch directly between New Draft, Content, and Sources. An opaque canvas background behind the entire header region prevents scrolled content from showing above it. Mobile New Draft and Content headings are static, with close buttons; desktop headings keep their collapse controls. Desktop navigation keeps its existing layout. Mobile home, search results, and workspace headers share the stacked New Project action and account control with a 48 px gap.');
  const spacingReference = element('a', '', 'Spacing reference');
  spacingReference.href = '#spacing';
  guidance.append(' This specimen demonstrates individual controls. See the ', spacingReference, ' for measured mobile header spacing.');
  root.append(actions, selectedPreview, status, guidance);
  attachTooltip(newProject, 'New Project', 'ds-nav-new-project-tooltip');
  attachTooltip(sources, 'Project Sources', 'ds-nav-sources-tooltip');
  attachTooltip(profile, 'My account', 'ds-nav-account-tooltip');
  const mounted = { closeMenu, destroy() { sourceAddition.destroy(); duplicateDialog.destroy(); sourcesTransition.destroy(); draftSelection.destroy(); navigationMounts.delete(root); } };
  navigationMounts.set(root, mounted);
  return mounted;
}

export function mountStateSpecimens(root) {
  if (!root) return;
  if (stateMounts.has(root)) return stateMounts.get(root);
  root.classList.add('ds-state-specimens');
  const panel = element('section', 'composer-panel composer-tools ds-disclosure-panel');
  const header = element('div', 'composer-tools-header');
  const heading = element('h2');
  heading.setAttribute('aria-level', '4');
  const toggle = button('composer-tools-toggle', 'Collapse New Draft');
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-controls', 'ds-disclosure-body');
  const chevron = createIcon('keyboard_arrow_up');
  chevron.dataset.collapseChevron = '';
  toggle.append(createIcon('post_add'), element('span', '', 'New Draft'), chevron);
  heading.append(toggle);
  header.append(heading);
  const body = element('div', 'ds-disclosure-body');
  body.id = 'ds-disclosure-body';
  const guidance = element('p', 'ds-caption', 'Choose any Format, Audience, or Voice to enable Add to List. Adding a recipe clears the settings and Editorial Direction for the next recipe; the added recipe keeps its own saved direction. On desktop, New Draft and Content both collapse using their heading chevrons, a 200 ms height animation, and immediate changes for reduced motion. Mobile panel headings are static, with close buttons instead of collapse controls. Collapsed panels have equal 12 px top and bottom padding. Expanded spacing is unchanged. Desktop disclosures and all dropdowns open and close over 200 ms with ease timing; dropdowns use a short fade and slide. Closing dropdowns leave the focus order immediately. Reduced motion changes them immediately.');
  const fields = element('div', 'composer-fields');
  for (const { label, key } of draftOptions) {
    const field = element('div', 'composer-field');
    field.dataset.label = label;
    const select = element('select');
    select.id = `ds-new-draft-${key}`;
    select.hidden = true;
    select.setAttribute('aria-label', label);
    field.append(select);
    fields.append(field);
  }
  body.append(fields);
  const direction = element('div', 'composer-direction');
  const directionLabel = element('label', '', 'Editorial Direction ');
  directionLabel.htmlFor = 'ds-editorial-direction';
  directionLabel.append(element('span', '', '(optional)'));
  const directionField = element('textarea');
  directionField.id = 'ds-editorial-direction';
  directionField.rows = 2;
  directionField.maxLength = 8000;
  directionField.placeholder = 'Add more facts or give directions on framing (for example, "focus on the economy")';
  direction.append(directionLabel, directionField);
  body.append(direction);
  const add = button('create-variant', 'Add to List example');
  add.textContent = 'Add to List';
  body.append(add);
  panel.append(header, body);
  const emptyPreview = element('section', 'composer-panel composer-outputs ds-disclosure-panel');
  const emptyHeading = element('h2');
  emptyHeading.setAttribute('aria-level', '4');
  const contentToggle = button('composer-tools-toggle', 'Collapse Content');
  contentToggle.setAttribute('aria-controls', 'ds-content-disclosure-body');
  const contentChevron = createIcon('keyboard_arrow_up');
  contentChevron.dataset.collapseChevron = '';
  contentToggle.append(createIcon('article'), element('span', '', 'Content'), contentChevron);
  emptyHeading.append(contentToggle);
  const emptyHeader = element('div', 'composer-outputs-header');
  emptyHeader.append(emptyHeading);
  const emptyBody = element('div', 'composer-outputs-body');
  emptyBody.id = 'ds-content-disclosure-body';
  const emptyTabs = element('div', 'output-status-tabs');
  emptyTabs.setAttribute('role', 'tablist');
  emptyTabs.setAttribute('aria-label', 'Empty content state');
  const emptyPanel = element('div', 'output-status-content');
  emptyPanel.id = 'ds-empty-content';
  const empty = element('div', 'composer-empty ds-empty-specimen');
  empty.setAttribute('role', 'status');
  const emptyCopy = element('div', 'composer-empty-copy');
  const emptyMessage = element('p', '', 'Your draft recipes will appear here.');
  emptyCopy.append(emptyMessage);
  empty.append(emptyCopy);
  emptyPanel.append(empty);
  const emptyTransition = createTabPanelTransition(emptyPanel);
  const emptyMessages = { pending: 'Your draft recipes will appear here.', drafted: 'Your draft requests will appear here.' };
  for (const [value, label] of [['pending', 'Content to Draft'], ['drafted', 'Drafted']]) {
    const tab = button('', label);
    tab.textContent = label;
    tab.id = `ds-empty-${value}-tab`;
    tab.dataset.emptyView = value;
    emptyTabs.append(tab);
  }
  let emptyView = 'pending';
  const emptySelection = bindTabSelection({
    root: emptyTabs, items: [...emptyTabs.querySelectorAll('button')],
    getValue: tab => tab.dataset.emptyView, panel: emptyPanel,
    onSelect: view => {
      if (view === emptyView) return;
      emptyTransition.run(() => {
        emptyView = view;
        emptySelection.sync(view);
        emptyMessage.textContent = emptyMessages[view];
      });
    },
  });
  emptySelection.sync(emptyView);
  emptyBody.append(emptyTabs, emptyPanel);
  emptyPreview.append(emptyHeader, emptyBody);
  const contentDisclosure = createPanelDisclosure({ body: emptyBody, trigger: contentToggle, panel: emptyPreview, label: 'Content', expanded: true });
  contentToggle.addEventListener('click', () => contentDisclosure.setExpanded(!contentDisclosure.expanded));
  const loading = element('div', 'ds-loading-specimen');
  loading.append(element('h4', '', 'Drafting content'));
  const draftingPreviews = element('div', 'ds-drafting-previews');
  draftingPreviews.id = 'drafting-states';
  const draftingExamples = [
    { label: '1 category: Format — pink', selectionKeys: ['format'] },
    { label: '2 categories: Audience + Voice — lavender and peach', selectionKeys: ['audience', 'voice'] },
    { label: '3 categories: Format + Audience + Voice — pink, lavender, and peach', selectionKeys: ['format', 'audience', 'voice'] },
  ];
  const draftingAnimations = draftingExamples.map(({ label, selectionKeys }, index) => {
    const drafting = createDraftingAnimation({ compact: true, selectionKeys });
    const draftingStage = element('div', 'ds-drafting-specimen');
    draftingStage.setAttribute('role', 'group');
    draftingStage.setAttribute('aria-label', label);
    // Only the first repeated specimen announces the shared static label.
    if (index > 0) drafting.element.querySelector('.drafting-message').setAttribute('aria-live', 'off');
    draftingStage.append(drafting.element, element('p', 'ds-specimen-status', label));
    draftingPreviews.append(draftingStage);
    return drafting;
  });
  loading.append(draftingPreviews, element('p', 'ds-caption', 'These white cards match drafted content cards with a shared 90 px minimum height, 8 px corners, and the same specimen width. Loading outlines are 1 px Neutral 200 (#E5E5E5). Revision overlays preserve the active card’s outer footprint, including its 92 px selected height. The fixed label “Creating Draft” stays visible while paper and shimmer colors cycle. The examples show one selected category (Format), two (Audience + Voice), and all three. Each visual phase uses one matching selected-category color: pink for Format, lavender for Audience, or peach for Voice. Colors cycle in Format/Audience/Voice order, skipping unselected categories. One selection keeps its color, Audience + Voice alternates lavender and peach, and all three cycle pink, lavender, then peach. With no choices, legacy content uses a neutral shimmer. Each sweep lasts 2.4 seconds; each paper phase holds for 5 seconds before an 800 ms handoff. Paper sheets stay white, paper lines use Neutral 500 (#737373), and the label stays dark and unchanged. The reference previews repeat the visual phases. Reduced motion hides the shimmer sweep and keeps a static sheet and label.'));
  const sourceAdding = createSourceAddingAnimation();
  const addingStage = element('div', 'ds-drafting-specimen');
  addingStage.append(sourceAdding.element);
  loading.append(element('h4', '', 'Adding a source'), addingStage, element('p', 'ds-caption', 'A white card centers one paper beside the text “Adding Source”. A fixed Teal 50 (#F0FDFA) shimmer sweeps every 2.4 seconds. The paper and Inter Medium Italic (500) label stay centered as a row, with a fixed label and no paper handoff. Reduced motion hides the shimmer sweep and keeps the paper and text static.'));
  const status = element('p', 'ds-specimen-status');
  status.setAttribute('role', 'status');
  let dropdowns;
  const disclosure = createPanelDisclosure({ body, trigger: toggle, panel, expanded: true });
  function setExpanded(expanded, options) {
    dropdowns?.close();
    disclosure.setExpanded(expanded, options);
  }
  setExpanded(true, { animate: false });
  toggle.addEventListener('click', () => setExpanded(toggle.getAttribute('aria-expanded') !== 'true'));
  add.addEventListener('click', () => {
    if (add.disabled) return;
    dropdowns.close();
    directionField.value = '';
    for (const select of fields.querySelectorAll('select')) select.value = '';
    dropdowns.refresh();
    updateAdd();
    status.textContent = '';
    fields.querySelector('.tool-dropdown-trigger')?.focus({ preventScroll: true });
  });
  root.append(panel, guidance, emptyPreview, loading, status);
  populateDraftOptions(panel);
  dropdowns = createToolDropdowns({ root: panel });
  const updateAdd = () => { add.disabled = !hasDraftSelection(Object.fromEntries([...fields.querySelectorAll('select')].map(select => [select.closest('.composer-field').dataset.label.toLowerCase(), select.value]))); };
  fields.addEventListener('change', updateAdd);
  updateAdd();
  const mounted = { setExpanded, destroy() { disclosure.destroy(); contentDisclosure.destroy(); emptySelection.destroy(); emptyTransition.destroy(); draftingAnimations.forEach(drafting => drafting.destroy()); sourceAdding.destroy(); dropdowns.close(); stateMounts.delete(root); } };
  stateMounts.set(root, mounted);
  return mounted;
}
