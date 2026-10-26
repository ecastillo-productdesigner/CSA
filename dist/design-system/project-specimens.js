import { createIcon } from '../icons.js?v=20261026-listicle-format';
import { bindRovingSelection } from '../selection-controls.js?v=20261026-listicle-format';
import { projectUpdatedDate, projectContentCountLabel } from '../dashboard.js?v=20261026-listicle-format';

// Isolated documentation data. This specimen never mounts the app dashboard
// controller, reads browser storage, or changes a saved project.
export function mountProjectSpecimens(root) {
  if (!root) return;
  const document = root.ownerDocument;
  const prefix = root.id || 'ds-project-sample';
  const now = Date.now();
  const project = {
    id: `${prefix}-project`, title: 'A Neighborhood Project Brings a Community Together',
    createdAt: now - 86400000, updatedAt: now,
    outputs: [
      { id: 'sample-draft', title: 'A Creative Chapter Begins', status: 'ready' },
      { id: 'sample-sent', title: 'Neighbors Share a New Perspective', status: 'ready', cmsSentAt: now },
      { id: 'sample-pending', title: 'A Story Waiting to Be Adapted', status: 'pending' },
    ],
  };
  let layout = 'grid';
  let deleted = false;
  let openMenu = null;
  let pendingDeleteTrigger = null;
  function node(tag, className = '', text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }
  root.classList.add('ds-project-specimens', 'project-browser');
  const toolbar = node('div', 'dashboard-layout-tools ds-project-toolbar');
  const viewSwitch = node('div', 'dashboard-layout-switch');
  viewSwitch.setAttribute('role', 'group');
  viewSwitch.setAttribute('aria-label', 'Project specimen view');
  const content = node('div', 'dashboard-grid ds-project-grid');
  content.id = `${prefix}-content`;
  const status = node('p', 'ds-caption ds-project-status', 'Project preview only; your saved projects are unchanged.');
  status.setAttribute('role', 'status');
  const undo = node('button', 'ds-text-action ds-project-undo', 'Undo Delete');
  undo.type = 'button';
  undo.hidden = true;
  const deleteDialog = node('dialog', 'delete-project-dialog');
  deleteDialog.id = `${prefix}-delete-dialog`;
  deleteDialog.setAttribute('role', 'alertdialog');
  deleteDialog.setAttribute('aria-labelledby', `${prefix}-delete-heading`);
  deleteDialog.setAttribute('aria-describedby', `${prefix}-delete-name`);
  const deleteHeading = node('div', 'panel-heading');
  const deleteTitle = node('h2', '', 'Delete Project?');
  deleteTitle.id = `${prefix}-delete-heading`;
  const dismissDelete = node('button', 'icon-button');
  dismissDelete.type = 'button';
  dismissDelete.setAttribute('aria-label', 'Close Delete Project Dialog');
  dismissDelete.append(createIcon('close'));
  deleteHeading.append(deleteTitle, dismissDelete);
  const deleteName = node('p', 'delete-project-name', project.title);
  deleteName.id = `${prefix}-delete-name`;
  const deleteActions = node('div', 'dialog-footer confirmation-actions');
  const cancelDelete = node('button', 'secondary-button', 'Cancel');
  cancelDelete.type = 'button';
  cancelDelete.autofocus = true;
  const confirmDelete = node('button', 'danger-button');
  confirmDelete.type = 'button';
  confirmDelete.append(node('span', '', 'Delete'));
  deleteActions.append(cancelDelete, confirmDelete);
  deleteDialog.append(deleteHeading, deleteName, deleteActions);
  const viewButtons = ['grid', 'list'].map(view => {
    const button = node('button');
    button.type = 'button';
    button.dataset.dashboardLayout = view;
    button.title = view === 'grid' ? 'Grid View' : 'List View';
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-controls', content.id);
    button.append(createIcon(view === 'grid' ? 'view_module' : 'menu'));
    viewSwitch.append(button);
    return button;
  });
  toolbar.append(viewSwitch, undo);
  root.replaceChildren(toolbar, content, status, deleteDialog);
  const layoutSelection = bindRovingSelection({
    root: viewSwitch, items: viewButtons,
    getValue: button => button.dataset.dashboardLayout,
    selectedAttribute: 'aria-pressed', roving: false,
    onSelect: view => {
      if (layout === view) return;
      layout = view;
      render();
    },
  });

  function closeMenu(restoreFocus = false) {
    if (!openMenu) return;
    const { trigger, menu } = openMenu;
    menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
    if (restoreFocus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function projectActions() {
    const more = node('button', 'icon-button project-card-menu-button');
    more.type = 'button';
    more.setAttribute('aria-label', `Project options: ${project.title}`);
    more.setAttribute('aria-haspopup', 'menu');
    more.setAttribute('aria-expanded', 'false');
    more.append(createIcon('more'));
    const menu = node('div', 'project-card-menu');
    menu.id = `${prefix}-menu`;
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', `Options for ${project.title}`);
    more.setAttribute('aria-controls', menu.id);
    const remove = node('button', 'project-card-menu-item project-card-delete');
    remove.type = 'button';
    remove.setAttribute('role', 'menuitem');
    remove.append(createIcon('delete-project'), node('span', '', 'Delete'));
    remove.addEventListener('click', () => {
      closeMenu();
      pendingDeleteTrigger = more;
      deleteDialog.showModal();
      cancelDelete.focus({ preventScroll: true });
    });
    menu.append(remove);
    function showMenu() {
      closeMenu();
      menu.hidden = false;
      more.setAttribute('aria-expanded', 'true');
      openMenu = { trigger: more, menu };
      remove.focus({ preventScroll: true });
    }
    more.addEventListener('click', () => openMenu?.trigger === more ? closeMenu(true) : showMenu());
    more.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); showMenu(); }
    });
    menu.addEventListener('keydown', event => {
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); remove.focus({ preventScroll: true }); }
    });
    return { more, menu };
  }
  function titleButton(grid = false) {
    const button = node('button', 'project-title-button');
    button.type = 'button';
    button.title = project.title;
    button.setAttribute('aria-label', `Open project: ${project.title}`);
    if (grid) button.append(node('span', 'project-title-label', project.title));
    else button.textContent = project.title;
    button.addEventListener('click', () => { closeMenu(); status.textContent = 'Project selected in this specimen'; });
    return button;
  }
  function projectTime() {
    const updated = projectUpdatedDate(project, now);
    const time = node('time', '', updated.label);
    time.dateTime = new Date(updated.timestamp).toISOString();
    time.title = updated.full;
    return time;
  }
  function projectCard() {
    const card = node('article', 'dashboard-project');
    card.setAttribute('aria-label', project.title);
    const title = node('h2');
    title.append(titleButton(true));
    const meta = node('div', 'project-meta');
    const separator = node('span', 'meta-dot', '·');
    separator.setAttribute('aria-hidden', 'true');
    meta.append(projectTime(), separator, node('span', '', projectContentCountLabel(project)));
    const { more, menu } = projectActions();
    card.append(title, meta, more, menu);
    return card;
  }
  function newProjectTile() {
    const button = node('button', 'new-project-tile');
    button.type = 'button';
    button.append(createIcon('plus'), node('span', '', 'New Project'));
    button.addEventListener('click', () => { closeMenu(); status.textContent = 'New Project selected in this specimen'; });
    return button;
  }
  function projectTable() {
    const table = node('table', 'project-table');
    const head = node('thead');
    const header = node('tr');
    for (const [label, column] of [['Title', 'title'], ['Pieces of Content', 'variants'], ['Date', 'date'], ['Actions', 'actions']]) {
      const cell = node('th', `project-column-${column}`);
      cell.scope = 'col';
      cell.append(node('span', column === 'actions' ? 'visually-hidden' : '', label));
      header.append(cell);
    }
    head.append(header);
    const body = node('tbody');
    const row = node('tr', 'project-table-row');
    if (deleted) {
      const empty = node('td', 'project-table-empty', 'No projects yet. Create a project to get started.');
      empty.colSpan = 4;
      row.append(empty);
    } else {
      const title = node('td', 'project-table-title');
      title.append(titleButton());
      const count = node('td', 'project-table-variants', projectContentCountLabel(project));
      count.dataset.label = 'Pieces of Content';
      const date = node('td', 'project-table-date');
      date.dataset.label = 'Date';
      date.append(projectTime());
      const actions = node('td', 'project-row-actions');
      const { more, menu } = projectActions();
      actions.append(more, menu);
      row.append(title, count, date, actions);
    }
    body.append(row);
    table.append(node('caption', 'visually-hidden', 'Project list specimen'), head, body);
    return table;
  }
  function render() {
    closeMenu();
    root.dataset.layout = layout;
    layoutSelection.sync(layout);
    undo.hidden = !deleted;
    toolbar.querySelector('.new-project-tile')?.remove();
    const create = newProjectTile();
    if (layout === 'list') toolbar.append(create);
    content.replaceChildren(...(layout === 'list' ? [projectTable()] : deleted ? [create] : [create, projectCard()]));
  }
  dismissDelete.addEventListener('click', () => deleteDialog.close());
  cancelDelete.addEventListener('click', () => deleteDialog.close());
  confirmDelete.addEventListener('click', () => {
    deleted = true;
    deleteDialog.close();
    render();
    status.textContent = 'Project deleted from this specimen';
    undo.focus({ preventScroll: true });
  });
  deleteDialog.addEventListener('close', () => {
    const target = deleted ? undo : pendingDeleteTrigger;
    pendingDeleteTrigger = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  });
  deleteDialog.addEventListener('click', event => {
    if (event.target !== deleteDialog) return;
    const bounds = deleteDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) deleteDialog.close();
  });
  undo.addEventListener('click', () => {
    deleted = false;
    render();
    status.textContent = 'Project restored in this specimen';
    content.querySelector('.project-title-button')?.focus({ preventScroll: true });
  });
  document.addEventListener('pointerdown', event => {
    if (openMenu && !openMenu.menu.contains(event.target) && !openMenu.trigger.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (!openMenu || !['Escape', 'Tab'].includes(event.key)) return;
    if (event.key === 'Escape') event.preventDefault();
    closeMenu(true);
  });
  render();
}
