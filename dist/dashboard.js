import { projectOutputs, outputIsReady, outputIsSent } from './outputs.js?v=20261017-created-label';

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

export function createDashboard({ onNew, onOpen }) {
  let revealTimer;
  const home = document.querySelector('#home');
  const grid = document.querySelector('#dashboard-grid');
  const loadMore = document.querySelector('#dashboard-load-more');
  const status = document.querySelector('#dashboard-load-status');
  let visibleRows = 6;
  let columns = 3;

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
      const sentCount = variants.filter(outputIsSent).length;
      const badges = node('div', 'project-badges');
      badges.append(node('span', `project-badge${sentCount ? ' project-badge--sent' : ''}`, sentCount ? `${sentCount} ${sentCount === 1 ? 'variant' : 'variants'} sent to CMS` : 'Draft'));
      const title = node('h2', '', project.title);
      title.title = project.title;
      const meta = node('div', 'project-meta');
      const date = node('span'); date.append(icon('history'), document.createTextNode(projectDate(project.createdAt)));
      const count = node('span'); count.append(icon('file'), document.createTextNode(`${variants.length} ${variants.length === 1 ? 'variant' : 'variants'}`));
      meta.append(date, node('span', 'meta-dot', '·'), count);
      const actions = node('div', 'project-actions');
      const open = node('button', 'project-open', 'Open');
      open.type = 'button';
      open.setAttribute('aria-label', `Open ${project.title}`);
      open.addEventListener('click', () => onOpen(project.id));
      actions.append(open);
      card.append(badges, title, meta, actions);
      grid.append(card);
    }
    updateVisible();
    for (const [index, card] of [...grid.children].entries()) card.style.setProperty('--reveal-order', Math.min(index, 7));
  }

  return { render, reveal };
}
