import { createRailPanelTransition } from '../navigation.js?v=20261022-linked-stories-motion';
import { createPanelDisclosure } from '../panel-disclosure.js?v=20261022-linked-stories-motion';
import { createDraftingAnimation } from '../drafting-animation.js?v=20261022-linked-stories-motion';
import { createIcon } from '../icons.js?v=20261022-linked-stories-motion';
import { tokenNumber } from './runtime.js?v=20261022-linked-stories-motion';
import { draftOptions, populateDraftOptions, hasDraftSelection } from '../draft-options.js?v=20261022-linked-stories-motion';
import { createToolDropdowns } from '../tool-dropdowns.js?v=20261022-linked-stories-motion';

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

export function mountNavigationSpecimens(root) {
  if (!root) return;
  if (navigationMounts.has(root)) return navigationMounts.get(root);
  root.classList.add('ds-navigation-specimens');
  const actions = element('div', 'ds-navigation-actions');
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Navigation controls');
  const newProject = button('icon-button nav-button', 'New Project', 'add_circle');
  const sources = button('icon-button nav-button', 'Sources', 'folder_open');
  sources.setAttribute('aria-expanded', 'false');
  sources.setAttribute('aria-controls', 'ds-navigation-selection-preview');
  const sourceIcon = sources.querySelector('.material-symbols-outlined');
  setSelectionIcon(sourceIcon, false);
  const selectedPreview = element('section', 'recents-panel sources-panel ds-navigation-panel-preview');
  selectedPreview.append(element('p', 'ds-specimen-status', 'Sources navigation selected'));
  selectedPreview.id = 'ds-navigation-selection-preview';
  selectedPreview.hidden = true;
  selectedPreview.setAttribute('role', 'region');
  selectedPreview.setAttribute('aria-label', 'Sources navigation example');
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
  const guidance = element('p', 'ds-caption', 'The left navigation expands and collapses over 200 ms with ease timing. Sources uses the same 200 ms timing with a short slide on open and close. Closing controls leave the focus order immediately; reduced motion changes both panels immediately.');
  root.append(actions, selectedPreview, status, guidance);
  attachTooltip(newProject, 'New Project', 'ds-nav-new-project-tooltip');
  attachTooltip(sources, 'Sources', 'ds-nav-sources-tooltip');
  attachTooltip(profile, 'My account', 'ds-nav-account-tooltip');
  const mounted = { closeMenu };
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
  const guidance = element('p', 'ds-caption', 'Choose any Format, Audience, or Voice to enable Add to List. New Draft and its dropdowns open and close over 200 ms with ease timing; dropdowns use a short fade and slide. Closing dropdowns leave the focus order immediately. Reduced motion changes them immediately.');
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
  directionField.placeholder = 'Example: “Focus on the economy” or “Use a conversational tone.”';
  direction.append(directionLabel, directionField);
  body.append(direction);
  const add = button('create-variant', 'Add to List example');
  add.textContent = 'Add to List';
  body.append(add);
  panel.append(header, body);
  const empty = element('div', 'composer-empty ds-empty-specimen');
  empty.setAttribute('role', 'status');
  const emptyCopy = element('div', 'composer-empty-copy');
  emptyCopy.append(element('p', '', 'Your drafted content will appear here.'));
  empty.append(emptyCopy);
  const loading = element('div', 'ds-loading-specimen');
  loading.append(element('h4', '', 'Drafting content'));
  const drafting = createDraftingAnimation({ compact: true });
  const draftingStage = element('div', 'ds-drafting-specimen');
  draftingStage.append(drafting.element);
  loading.append(draftingStage, element('p', 'ds-caption', 'The app shows 3 messages over 15 seconds. Each message holds for 5 seconds, with an 800 ms paper handoff between messages: the first starts at 0 seconds, the second at 5 seconds, and the third at 10.8 seconds. The reference preview repeats the 3-message sequence. Reduced motion keeps a static sheet and message.'));
  const adding = element('span', 'result-adding');
  const spinner = element('span', 'output-processing-spinner');
  spinner.setAttribute('aria-hidden', 'true');
  adding.append(spinner, element('span', 'output-creating-label', 'Adding'));
  loading.append(element('h4', '', 'Adding a source'), adding);
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
    for (const select of fields.querySelectorAll('select')) select.value = '';
    dropdowns.refresh();
    updateAdd();
    status.textContent = '';
    fields.querySelector('.tool-dropdown-trigger')?.focus({ preventScroll: true });
  });
  root.append(panel, guidance, empty, loading, status);
  populateDraftOptions(panel);
  dropdowns = createToolDropdowns({ root: panel });
  const updateAdd = () => { add.disabled = !hasDraftSelection(Object.fromEntries([...fields.querySelectorAll('select')].map(select => [select.closest('.composer-field').dataset.label.toLowerCase(), select.value]))); };
  fields.addEventListener('change', updateAdd);
  updateAdd();
  const mounted = { setExpanded, destroy() { disclosure.destroy(); drafting.destroy(); dropdowns.close(); stateMounts.delete(root); } };
  stateMounts.set(root, mounted);
  return mounted;
}
