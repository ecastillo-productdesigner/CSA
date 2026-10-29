import { bindRovingSelection } from './selection-controls.js?v=20261026-drafting-card-size';
import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';
import { createIcon as icon } from './icons.js?v=20261026-drafting-card-size';
import { projectOutputs, outputIsReady } from './outputs.js?v=20261026-drafting-card-size';
import { sourceLinkArticles } from './source-links.js?v=20261026-drafting-card-size';

const layoutKey = 'csa.dashboard.layout.v1';
function readLayout() {
  try { return localStorage.getItem(layoutKey) === 'list' ? 'list' : 'grid'; }
  catch { return 'grid'; }
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}



export function cleanProjectTitle(title) {
  return (typeof title === 'string' ? title : '').replace(/\s*—\s*Draft\s*$/i, '').trim() || 'Untitled story';
}

function firstLinkedSource(sources) {
  const source = Array.isArray(sources) ? sources.find(source => source?.type === 'link') : null;
  if (typeof source?.url !== 'string') return null;
  try {
    const url = new URL(source.url);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? { source, url } : null;
  } catch { return null; }
}

export function projectTitleFromSources(sources) {
  const link = firstLinkedSource(sources);
  if (!link) return '';
  const title = typeof link.source.title === 'string' ? link.source.title.trim() : '';
  const domain = link.url.hostname.replace(/^www\./, '');
  const domainTitle = [domain, link.url.hostname].includes(title.toLowerCase());
  const opaqueTitle = /^(?:article\s*)?\d+(?:\.(?:html?|aspx?|php))?$/i.test(title);
  if (title && !domainTitle && !opaqueTitle && !/^https?:\/\//i.test(title) && title.toLowerCase() !== 'untitled story') return cleanProjectTitle(title);
  return sourceLinkArticles([link.url.href])[0].title;
}

export function normalizeProjectTitles(projects) {
  let changed = false;
  for (const project of projects) {
    let title = cleanProjectTitle(project.title);
    const first = project.sources?.[0];
    const link = first?.type === 'link' ? firstLinkedSource([first]) : null;
    if (link && title === link.url.hostname.replace(/^www\./, '')) title = projectTitleFromSources([first]) || title;
    if (title !== project.title) { project.title = title; changed = true; }
  }
  return changed;
}

export function projectUpdatedDate(project, now = Date.now()) {
  const wasUpdated = Number.isFinite(project.updatedAt) && project.updatedAt > project.createdAt;
  const timestamp = wasUpdated ? project.updatedAt : project.createdAt;
  const date = new Date(timestamp);
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
  const year = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric' });
  const sameYear = year.format(timestamp) === year.format(now);
  const label = day.format(timestamp) === day.format(now) ? 'Today' : new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', ...(!sameYear ? { year: 'numeric' } : {}) }).format(date);
  return { timestamp, label: wasUpdated ? `Updated ${label}` : label, full: new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }).format(date) };
}

export function projectContentCountLabel(project) {
  const count = projectOutputs(project).filter(outputIsReady).length;
  return `${count} ${count === 1 ? 'Piece' : 'Pieces'} of Content`;
}

export function createDashboard({ onNew, onOpen, onDelete }) {
  let revealTimer;
  let layoutAnimation;
  const home = document.querySelector('#home');
  home.classList.add('project-browser');
  const grid = document.querySelector('#dashboard-grid');
  const loadMore = document.querySelector('#dashboard-load-more');
  const status = document.querySelector('#dashboard-load-status');
  const layoutSwitch = document.querySelector('#dashboard-layout-switch');
  const layoutTools = document.querySelector('.dashboard-layout-tools');
  const layoutButtons = [...layoutSwitch.querySelectorAll('[data-dashboard-layout]')];
  let layout = readLayout();
  let currentProjects = [];
  let projectItems = [];
  let visibleRows = 6;
  let columns = 3;
  let openMenu = null;
  let pendingDelete = null;
  let deleting = false;
  const deleteDialog = document.querySelector('#delete-project-dialog');
  const deleteConfirm = document.querySelector('#delete-project-confirm');
  const deleteCancel = document.querySelector('#delete-project-cancel');
  const deleteError = document.querySelector('#delete-project-error');

  function closeMenu(restoreFocus = false) {
    if (!openMenu) return;
    const { trigger, menu } = openMenu;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
    if (restoreFocus) trigger.focus();
  }

  function showMenu(trigger, menu) {
    closeMenu();
    menu.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = { trigger, menu };
    menu.querySelector('button').focus();
  }

  document.addEventListener('pointerdown', event => {
    if (openMenu && !openMenu.menu.contains(event.target) && !openMenu.trigger.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (!openMenu) return;
    if (event.key === 'Escape') { event.preventDefault(); closeMenu(true); }
    else if (event.key === 'Tab') closeMenu(true);
  });

  deleteCancel.addEventListener('click', () => deleteDialog.close());
  deleteDialog.addEventListener('cancel', event => { if (deleting) event.preventDefault(); });
  deleteDialog.addEventListener('close', () => {
    const trigger = pendingDelete?.trigger;
    pendingDelete = null;
    (trigger?.isConnected ? trigger : grid.querySelector('.project-card-menu-button') || home.querySelector('#dashboard-new-project'))?.focus({ preventScroll: true });
  });
  deleteConfirm.addEventListener('click', async () => {
    if (!pendingDelete || deleting) return;
    deleting = true;
    deleteDialog.setAttribute('aria-busy', 'true');
    deleteCancel.disabled = deleteConfirm.disabled = true;
    deleteConfirm.querySelector('span').textContent = 'Deleting…';
    try {
      if (!await onDelete(pendingDelete.id)) throw new Error('Deletion failed');
      deleteDialog.close();
    } catch {
      deleteError.textContent = 'This project could not be deleted. Please try again.';
      deleteError.hidden = false;
    } finally {
      deleting = false;
      deleteDialog.removeAttribute('aria-busy');
      deleteCancel.disabled = deleteConfirm.disabled = false;
      deleteConfirm.querySelector('span').textContent = 'Delete';
      if (deleteDialog.open) deleteCancel.focus();
    }
  });

  function updateVisible(announce = false) {
    if (layout === 'grid' && home.clientWidth) {
      const tracks = getComputedStyle(grid).gridTemplateColumns.match(/[\d.]+px/g);
      if (tracks?.length) columns = tracks.length;
    }
    const limit = visibleRows * (layout === 'list' ? 3 : columns) - (layout === 'grid' ? 1 : 0);
    projectItems.forEach((item, index) => { item.hidden = index >= limit; });
    loadMore.hidden = projectItems.length <= limit;
    if (announce || status.textContent) status.textContent = `Showing ${Math.min(projectItems.length, limit)} of ${projectItems.length} projects.`;
  }
  loadMore.addEventListener('click', () => {
    const next = projectItems.find(item => item.hidden)?.querySelector('.project-title-button');
    visibleRows += 6;
    updateVisible(true);
    next?.focus({ preventScroll: true });
  });
  function setLayout(next) {
    if (!['grid', 'list'].includes(next) || next === layout) return;
    closeMenu();
    clearTimeout(revealTimer);
    home.classList.remove('is-entering');
    const previousHeight = grid.getBoundingClientRect().height;
    layoutAnimation?.cancel();
    grid.classList.remove('is-switching-layout');
    layout = next;
    visibleRows = 6;
    try { localStorage.setItem(layoutKey, layout); } catch { /* The layout still works for this session. */ }
    render(currentProjects);
    updateVisible(true);
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const nextHeight = grid.getBoundingClientRect().height;
      const styles = getComputedStyle(grid);
      grid.classList.add('is-switching-layout');
      const animation = grid.animate([
        { height: `${previousHeight}px`, opacity: tokenNumber('component.layout.switch-start-opacity') },
        { height: `${nextHeight}px`, opacity: 1 }
      ], { duration: parseFloat(styles.getPropertyValue('--csa-foundation-motion-duration-200')), easing: styles.getPropertyValue('--csa-foundation-motion-easing-arrive').trim() });
      layoutAnimation = animation;
      animation.finished.then(() => {
        if (layoutAnimation !== animation) return;
        grid.classList.remove('is-switching-layout');
        layoutAnimation = null;
      }).catch(() => { /* A newer layout choice cancelled this transition. */ });
    }
  }
  const layoutSelection = bindRovingSelection({
    root: layoutSwitch,
    items: layoutButtons,
    getValue: button => button.dataset.dashboardLayout,
    onSelect: setLayout,
  });
  new ResizeObserver(() => updateVisible()).observe(home);
  window.addEventListener('scroll', () => {
    home.classList.toggle('is-scrolled', !home.hidden && window.scrollY > 0);
  }, { passive: true });

  function reveal() {
    clearTimeout(revealTimer);
    home.classList.remove('is-entering', 'is-scrolled');
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    void home.offsetWidth;
    home.classList.add('is-entering');
    revealTimer = setTimeout(() => home.classList.remove('is-entering'), tokenNumber('component.layout.enter-cleanup'));
  }

  function projectActions(project) {
    const more = node('button', 'icon-button project-card-menu-button');
    more.type = 'button';
    more.setAttribute('aria-label', `Project options: ${project.title}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.append(icon('more'));
    const menu = node('div', 'project-card-menu');
    menu.id = `project-menu-${project.id}`;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Options for ${project.title}`);
    menu.hidden = true;
    more.setAttribute('aria-controls', menu.id);
    const remove = node('button', 'project-card-menu-item project-card-delete');
    remove.type = 'button';
    remove.setAttribute('role', 'menuitem');
    remove.append(icon('delete-project'), node('span', '', 'Delete'));
    remove.addEventListener('click', () => {
      closeMenu();
      pendingDelete = { id: project.id, trigger: more };
      deleteError.hidden = true;
      deleteDialog.showModal();
      deleteCancel.focus();
    });
    menu.append(remove);
    menu.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...menu.querySelectorAll('button')];
      const current = items.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next].focus();
    });
    more.addEventListener('click', () => openMenu?.trigger === more ? closeMenu(true) : showMenu(more, menu));
    more.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); showMenu(more, menu); }
    });
    return { more, menu };
  }

  function projectTable(projects) {
    const table = node('table', 'project-table');
    const caption = node('caption', 'visually-hidden', 'Projects');
    const head = node('thead');
    const headerRow = node('tr');
    for (const [label, column] of [['Title', 'title'], ['Pieces of Content', 'variants'], ['Date', 'date'], ['Actions', 'actions']]) {
      const cell = node('th', `project-column-${column}`);
      cell.scope = 'col';
      cell.append(node('span', label === 'Actions' ? 'visually-hidden' : '', label));
      headerRow.append(cell);
    }
    head.append(headerRow);
    const body = node('tbody');
    for (const project of projects) {
      const row = node('tr', 'project-table-row');
      const title = node('td', 'project-table-title');
      const open = node('button', 'project-title-button', project.title);
      open.type = 'button';
      open.title = project.title;
      open.setAttribute('aria-label', `Open project: ${project.title}`);
      open.addEventListener('click', () => { closeMenu(); onOpen(project.id); });
      title.append(open);
      const variants = node('td', 'project-table-variants', projectContentCountLabel(project));
      variants.dataset.label = 'Pieces of Content';
      const date = node('td', 'project-table-date');
      date.dataset.label = 'Date';
      const updated = projectUpdatedDate(project);
      const time = node('time', '', updated.label);
      time.dateTime = new Date(updated.timestamp).toISOString();
      time.title = updated.full;
      date.append(time);
      const actions = node('td', 'project-row-actions');
      const { more, menu } = projectActions(project);
      actions.append(more, menu);
      row.append(title, variants, date, actions);
      projectItems.push(row);
      body.append(row);
    }
    if (!projects.length) {
      const row = node('tr');
      const empty = node('td', 'project-table-empty', 'No projects yet. Create a project to get started.');
      empty.colSpan = 4;
      row.append(empty);
      body.append(row);
    }
    table.append(caption, head, body);
    return table;
  }

  function render(projects) {
    closeMenu();
    currentProjects = projects;
    projectItems = [];
    home.dataset.layout = layout;
    layoutSelection.sync(layout);
    const dashboardProjects = projects.filter(project => project.dashboard === true && !project.archivedAt && !project.deletedAt);
    grid.replaceChildren();
    layoutTools.querySelector('#dashboard-new-project')?.remove();
    const button = node('button', 'new-project-tile');
    button.id = 'dashboard-new-project';
    button.type = 'button';
    button.append(icon('plus'), node('span', '', 'New Project'));
    button.addEventListener('click', onNew);
    (layout === 'list' ? layoutTools : grid).append(button);

    if (layout === 'list') grid.append(projectTable(dashboardProjects));
    else for (const project of dashboardProjects) {
      const card = node('article', 'dashboard-project');
      card.setAttribute('aria-label', project.title);
      const { more, menu } = projectActions(project);
      const title = node('h2');
      const titleButton = node('button', 'project-title-button');
      titleButton.append(node('span', 'project-title-label', project.title));
      titleButton.type = 'button';
      titleButton.title = project.title;
      titleButton.setAttribute('aria-label', `Open project: ${project.title}`);
      titleButton.addEventListener('click', () => { closeMenu(); onOpen(project.id); });
      title.append(titleButton);
      const meta = node('div', 'project-meta');
      const updated = projectUpdatedDate(project);
      const date = node('time', '', updated.label);
      date.dateTime = new Date(updated.timestamp).toISOString();
      date.title = updated.full;
      const count = node('span', '', projectContentCountLabel(project));
      const separator = node('span', 'meta-dot', '·');
      separator.setAttribute('aria-hidden', 'true');
      meta.append(date, separator, count);
      card.append(title, meta, more, menu);
      grid.append(card);
      projectItems.push(card);
    }
    updateVisible();
  }

  return { render, reveal };
}
