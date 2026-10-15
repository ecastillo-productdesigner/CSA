function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}

function projectDate(timestamp) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'numeric', day: 'numeric' });
  return day.format(timestamp) === day.format(Date.now()) ? 'Today' : new Date(timestamp).toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
}

export function createDashboard({ onNew, onOpen, onArchive, onTrash, onRestore }) {
  let collection = 'active';
  let currentProjects = [];

  function actionButton(label, symbol, callback, className = '') {
    const button = node('button', `project-action ${className}`.trim());
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    button.append(icon(symbol));
    button.addEventListener('click', callback);
    return button;
  }

  function render(projects) {
    currentProjects = projects;
    const dashboardProjects = projects.filter((project) => project.dashboard === true);
    const groups = {
      active: dashboardProjects.filter((project) => !project.archivedAt && !project.deletedAt),
      archived: dashboardProjects.filter((project) => project.archivedAt && !project.deletedAt),
      trash: dashboardProjects.filter((project) => project.deletedAt),
    };
    if (collection !== 'active' && !groups[collection].length) collection = 'active';
    const collections = document.querySelector('#dashboard-collections');
    collections.hidden = groups.archived.length === 0 && groups.trash.length === 0;
    collections.replaceChildren(...[['active', 'Projects'], ['archived', 'Archived'], ['trash', 'Trash']].map(([key, label]) => {
      const button = node('button', '', `${label}${key === 'active' ? '' : ` (${groups[key].length})`}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(collection === key));
      button.addEventListener('click', () => { collection = key; render(currentProjects); });
      return button;
    }));

    const grid = document.querySelector('#dashboard-grid');
    grid.replaceChildren();
    if (collection === 'active') {
      const button = node('button', 'new-project-tile');
      button.id = 'dashboard-new-project';
      button.type = 'button';
      button.append(icon('plus'), node('span', '', 'New Project'));
      button.addEventListener('click', onNew);
      grid.append(button);
    }

    for (const project of groups[collection]) {
      const card = node('article', 'dashboard-project');
      card.setAttribute('aria-label', project.title);
      const badges = node('div', 'project-badges');
      for (const label of ['What to know', 'Listicle']) badges.append(node('span', 'project-badge', label));
      const title = node('h2', '', project.title);
      title.title = project.title;
      const meta = node('div', 'project-meta');
      const date = node('span'); date.append(icon('history'), document.createTextNode(projectDate(project.createdAt)));
      const count = node('span'); count.append(icon('file'), document.createTextNode(`${project.sources.length} ${project.sources.length === 1 ? 'Source' : 'Sources'}`));
      meta.append(date, node('span', 'meta-dot', '·'), count);
      const actions = node('div', 'project-actions');
      const open = node('button', 'project-open', collection === 'trash' ? 'Restore' : 'Open');
      open.type = 'button';
      open.setAttribute('aria-label', `${collection === 'trash' ? 'Restore' : 'Open'} ${project.title}`);
      open.addEventListener('click', () => collection === 'trash' ? onRestore(project.id) : onOpen(project.id));
      actions.append(open);
      if (collection !== 'trash') {
        actions.append(
          actionButton(`${collection === 'archived' ? 'Restore' : 'Archive'} ${project.title}`, collection === 'archived' ? 'restore' : 'archive', () => collection === 'archived' ? onRestore(project.id) : onArchive(project.id)),
          actionButton(`Delete ${project.title}`, 'trash', () => onTrash(project.id), 'project-action--delete'),
        );
      }
      card.append(badges, title, meta, actions);
      grid.append(card);
    }
    if (!grid.children.length) grid.append(node('p', 'dashboard-empty', 'No projects here yet.'));
  }

  return { render };
}
