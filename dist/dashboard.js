import { createIcon as icon } from './icons.js?v=20261020-request-revision';
import { projectOutputs, outputIsReady } from './outputs.js?v=20261020-request-revision';

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
  return title.replace(/\s*—\s*Draft\s*$/i, '').trim() || 'Untitled story';
}

export function normalizeProjectTitles(projects) {
  let changed = false;
  for (const project of projects) {
    const title = cleanProjectTitle(project.title);
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

export function createDashboard({ onNew, onOpen, onDelete }) {
  let revealTimer;
  const home = document.querySelector('#home');
  const grid = document.querySelector('#dashboard-grid');
  const loadMore = document.querySelector('#dashboard-load-more');
  const status = document.querySelector('#dashboard-load-status');
  const layoutSwitch = document.querySelector('#dashboard-layout-switch');
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
    (trigger?.isConnected ? trigger : grid.querySelector('.project-card-menu-button') || grid.querySelector('#dashboard-new-project'))?.focus({ preventScroll: true });
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
    layout = next;
    visibleRows = 6;
    try { localStorage.setItem(layoutKey, layout); } catch { /* The layout still works for this session. */ }
    render(currentProjects);
    updateVisible(true);
  }
  for (const button of layoutButtons) button.addEventListener('click', () => setLayout(button.dataset.dashboardLayout));
  layoutSwitch.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const current = layoutButtons.indexOf(event.target.closest('button'));
    if (current < 0) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? layoutButtons.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + layoutButtons.length) % layoutButtons.length;
    setLayout(layoutButtons[next].dataset.dashboardLayout);
    layoutButtons[next].focus();
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
    revealTimer = setTimeout(() => home.classList.remove('is-entering'), 1400);
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
      document.querySelector('#delete-project-name').textContent = project.title;
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
    for (const label of ['Title', 'Sources', 'Date', 'Role', 'Actions']) {
      const cell = node('th', `project-column-${label.toLowerCase()}`);
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
      const sourceCount = project.sources.length;
      const sources = node('td', 'project-table-sources', `${sourceCount} ${sourceCount === 1 ? 'source' : 'sources'}`);
      sources.dataset.label = 'Sources';
      const date = node('td', 'project-table-date');
      date.dataset.label = 'Date';
      const updated = projectUpdatedDate(project);
      const time = node('time', '', updated.label);
      time.dateTime = new Date(updated.timestamp).toISOString();
      time.title = updated.full;
      date.append(time);
      const role = node('td', 'project-table-role', 'Owner');
      role.dataset.label = 'Role';
      const actions = node('td', 'project-row-actions');
      const { more, menu } = projectActions(project);
      actions.append(more, menu);
      row.append(title, sources, date, role, actions);
      projectItems.push(row);
      body.append(row);
    }
    if (!projects.length) {
      const row = node('tr');
      const empty = node('td', 'project-table-empty', 'No projects yet. Create a project to get started.');
      empty.colSpan = 5;
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
    for (const button of layoutButtons) button.setAttribute('aria-pressed', String(button.dataset.dashboardLayout === layout));
    const dashboardProjects = projects.filter(project => project.dashboard === true && !project.archivedAt && !project.deletedAt);
    grid.replaceChildren();
    const button = node('button', 'new-project-tile');
    button.id = 'dashboard-new-project';
    button.type = 'button';
    button.append(icon('plus'), node('span', '', 'New Project'));
    button.addEventListener('click', onNew);
    grid.append(button);

    if (layout === 'list') grid.append(projectTable(dashboardProjects));
    else for (const project of dashboardProjects) {
      const card = node('article', 'dashboard-project');
      card.setAttribute('aria-label', project.title);
      const variants = projectOutputs(project).filter(outputIsReady);
      const { more, menu } = projectActions(project);
      const title = node('h2');
      const titleButton = node('button', 'project-title-button', project.title);
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
      const count = node('span', '', `${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}`);
      const separator = node('span', 'meta-dot', '·');
      separator.setAttribute('aria-hidden', 'true');
      meta.append(date, separator, count);
      const actions = node('div', 'project-actions');
      const open = node('button', 'project-open');
      open.append(node('span', 'project-open-label', 'Open'), icon('arrow'));
      open.type = 'button';
      open.setAttribute('aria-label', `Open ${project.title}`);
      open.addEventListener('click', () => { closeMenu(); onOpen(project.id); });
      actions.append(open);
      card.append(more, menu, title, meta, actions);
      grid.append(card);
      projectItems.push(card);
    }
    updateVisible();
    for (const [index, card] of [...grid.children].entries()) card.style.setProperty('--reveal-order', Math.min(index, 7));
  }

  return { render, reveal };
}
