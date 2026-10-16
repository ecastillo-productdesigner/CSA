function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

export function createRecentProjects({ onOpen }) {
  const content = document.querySelector('#history-content');
  let renderKey = '';

  function render(projects, activeProjectId) {
    const recent = projects.filter(project => project.dashboard === true && !project.archivedAt && !project.deletedAt);
    const nextKey = JSON.stringify(recent.map(project => [project.id, project.title, project.id === activeProjectId]));
    if (nextKey === renderKey) return;
    renderKey = nextKey;
    const focusedTitle = content.contains(document.activeElement) ? document.activeElement.getAttribute('aria-label') : null;
    if (!recent.length) {
      content.replaceChildren(node('p', 'empty-history', 'Your projects will appear here once you begin.'));
    } else {
      const list = node('ul', 'history-list');
      for (const project of recent) {
        const row = node('li', 'history-row');
        const button = node('button', 'history-item');
        button.type = 'button';
        button.title = project.title;
        button.setAttribute('aria-label', project.title);
        const title = node('span', 'history-item-title', project.title.replace(/(?:\.{3}|…)\s*$/, ''));
        const ellipsis = node('span', 'history-item-ellipsis', '...');
        ellipsis.setAttribute('aria-hidden', 'true');
        button.append(title, ellipsis);
        if (project.id === activeProjectId) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', () => onOpen(project.id));
        row.append(button);
        list.append(row);
      }
      content.replaceChildren(list);
    }
    if (focusedTitle) [...content.querySelectorAll('.history-item')].find(button => button.getAttribute('aria-label') === focusedTitle)?.focus({ preventScroll: true });
  }

  return { render, close() {} };
}
