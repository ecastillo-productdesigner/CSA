import { createIcon as icon } from './icons.js?v=20261020-request-revision';
import { projectOutputs, outputIsReady } from './outputs.js?v=20261020-request-revision';

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}



function projectDate(timestamp) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
  return day.format(timestamp) === day.format(Date.now()) ? 'Today' : new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
}

export function createDashboard({ onNew, onOpen, onDelete, onRename }) {
  let revealTimer;
  const home = document.querySelector('#home');
  const grid = document.querySelector('#dashboard-grid');
  const loadMore = document.querySelector('#dashboard-load-more');
  const status = document.querySelector('#dashboard-load-status');
  let visibleRows = 6;
  let columns = 3;
  let openMenu = null;
  let pendingDelete = null;
  let deleting = false;
  const deleteDialog = document.querySelector('#delete-project-dialog');
  const deleteConfirm = document.querySelector('#delete-project-confirm');
  const deleteCancel = document.querySelector('#delete-project-cancel');
  const deleteError = document.querySelector('#delete-project-error');
  let pendingRename = null;
  const renameDialog = document.querySelector('#rename-project-dialog');
  const renameForm = document.querySelector('#rename-project-form');
  const renameInput = document.querySelector('#rename-project-name');
  const renameSave = document.querySelector('#rename-project-save');
  const renameError = document.querySelector('#rename-project-error');

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

  renameInput.addEventListener('input', () => {
    renameSave.disabled = !renameInput.value.trim() || renameInput.value.trim() === pendingRename?.title;
    renameInput.removeAttribute('aria-invalid');
    renameError.hidden = true;
  });
  renameDialog.addEventListener('close', () => {
    const trigger = pendingRename?.trigger;
    const replacement = document.getElementById(pendingRename?.menuId)?.previousElementSibling;
    pendingRename = null;
    (trigger?.isConnected ? trigger : replacement)?.focus({ preventScroll: true });
  });
  renameForm.addEventListener('submit', event => {
    event.preventDefault();
    const title = renameInput.value.trim();
    if (!pendingRename || !title || title === pendingRename.title) return;
    if (onRename(pendingRename.id, title)) renameDialog.close();
    else {
      renameError.textContent = 'The name could not be saved. Please try again.';
      renameError.hidden = false;
      renameInput.setAttribute('aria-invalid', 'true');
      renameInput.focus();
    }
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
    if (home.clientWidth) {
      const tracks = getComputedStyle(grid).gridTemplateColumns.match(/[\d.]+px/g);
      if (tracks?.length) columns = tracks.length;
    }
    const tiles = [...grid.children];
    const limit = visibleRows * columns;
    tiles.forEach((tile, index) => { tile.hidden = index >= limit; });
    loadMore.hidden = tiles.length <= limit;
    if (announce || status.textContent) status.textContent = `Showing ${Math.max(0, Math.min(tiles.length, limit) - 1)} of ${Math.max(0, tiles.length - 1)} projects.`;
  }
  loadMore.addEventListener('click', () => {
    const next = grid.querySelector('[hidden] .project-open');
    visibleRows += 6;
    updateVisible(true);
    next?.focus({ preventScroll: true });
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

  function render(projects) {
    closeMenu();
    const dashboardProjects = projects.filter(project => project.dashboard === true && !project.archivedAt && !project.deletedAt);
    grid.replaceChildren();
    const button = node('button', 'new-project-tile');
    button.id = 'dashboard-new-project';
    button.type = 'button';
    button.append(icon('plus'), node('span', '', 'New Project'));
    button.addEventListener('click', onNew);
    grid.append(button);

    for (const project of dashboardProjects) {
      const card = node('article', 'dashboard-project');
      card.setAttribute('aria-label', project.title);
      const variants = projectOutputs(project).filter(outputIsReady);
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
      const rename = node('button', 'project-card-menu-item');
      rename.type = 'button';
      rename.setAttribute('role', 'menuitem');
      rename.append(icon('edit-output'), node('span', '', 'Edit name'));
      rename.addEventListener('click', () => {
        closeMenu();
        pendingRename = { id: project.id, title: project.title, trigger: more, menuId: menu.id };
        renameForm.reset();
        renameInput.value = project.title;
        renameInput.removeAttribute('aria-invalid');
        renameError.hidden = true;
        renameSave.disabled = true;
        renameDialog.showModal();
        renameInput.focus();
        renameInput.select();
      });
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
      menu.append(rename, remove);
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
      const title = node('h2', '', project.title);
      title.title = project.title;
      const meta = node('div', 'project-meta');
      const date = node('span'); date.append(document.createTextNode(projectDate(project.createdAt)));
      const count = node('span'); count.append(icon('variants'), document.createTextNode(`${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}`));
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
    }
    updateVisible();
    for (const [index, card] of [...grid.children].entries()) card.style.setProperty('--reveal-order', Math.min(index, 7));
  }

  return { render, reveal };
}
