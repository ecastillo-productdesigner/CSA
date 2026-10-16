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

export function createRecentProjects({ onOpen, onArchive, onTrash }) {
  const content = document.querySelector('#history-content');
  let renderKey = '';
  let activeMenu = null;

  function close(restoreFocus = false) {
    if (!activeMenu) return;
    const { button, menu } = activeMenu;
    activeMenu = null;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
  }

  function open(button, menu, last = false) {
    const wasOpen = activeMenu?.button === button;
    close();
    if (wasOpen) return;
    button.setAttribute('aria-expanded', 'true');
    menu.classList.remove('opens-up');
    menu.hidden = false;
    if (menu.getBoundingClientRect().bottom > content.getBoundingClientRect().bottom - 8) menu.classList.add('opens-up');
    activeMenu = { button, menu };
    const items = menu.querySelectorAll('button');
    items[last ? items.length - 1 : 0].focus();
  }

  content.addEventListener('scroll', () => close(), { passive: true });
  content.addEventListener('focusout', event => {
    if (activeMenu && !activeMenu.menu.contains(event.relatedTarget) && event.relatedTarget !== activeMenu.button) close();
  });
  document.addEventListener('pointerdown', event => {
    if (!event.target.closest('.history-menu, .history-options')) close();
  });

  function render(projects, activeProjectId) {
    const recent = projects.filter(project => project.dashboard === true && !project.archivedAt && !project.deletedAt);
    const nextKey = JSON.stringify(recent.map(project => [project.id, project.title, project.id === activeProjectId]));
    if (nextKey === renderKey) return;
    renderKey = nextKey;
    const focusIndex = [...content.querySelectorAll('.history-row')].findIndex(row => row.contains(document.activeElement));
    close();
    if (!recent.length) {
      content.replaceChildren(node('p', 'empty-history', 'Your projects will appear here once you begin.'));
    } else {
      const list = node('ul', 'history-list');
      for (const project of recent) {
        const row = node('li', 'history-row');
        const projectButton = node('button', 'history-item');
        projectButton.type = 'button';
        projectButton.title = project.title;
        projectButton.setAttribute('aria-label', project.title);
        const title = node('span', 'history-item-title', project.title.replace(/(?:\.{3}|…)\s*$/, ''));
        const ellipsis = node('span', 'history-item-ellipsis', '...');
        ellipsis.setAttribute('aria-hidden', 'true');
        projectButton.append(icon('file'), title, ellipsis);
        if (project.id === activeProjectId) projectButton.setAttribute('aria-current', 'page');
        projectButton.addEventListener('click', () => { close(); onOpen(project.id); });

        const button = node('button', 'icon-button history-options');
        button.type = 'button';
        button.setAttribute('aria-label', `Project options: ${project.title}`);
        button.setAttribute('aria-haspopup', 'menu');
        button.setAttribute('aria-expanded', 'false');
        button.setAttribute('aria-controls', `recent-options-${project.id}`);
        button.append(icon('more'));
        const menu = node('div', 'history-menu');
        menu.id = `recent-options-${project.id}`;
        menu.hidden = true;
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-label', `Options for ${project.title}`);
        for (const [label, symbol, callback] of [['Archive', 'archive', onArchive], ['Delete', 'trash', onTrash]]) {
          const action = node('button', `history-menu-item${label === 'Delete' ? ' history-delete' : ''}`);
          action.type = 'button';
          action.setAttribute('role', 'menuitem');
          action.setAttribute('aria-label', `${label} ${project.title}`);
          action.append(icon(symbol), node('span', '', label));
          action.addEventListener('click', () => { close(); callback(project.id); });
          menu.append(action);
        }
        button.addEventListener('click', () => open(button, menu));
        button.addEventListener('keydown', event => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            open(button, menu, event.key === 'ArrowUp');
          } else if (event.key === 'Escape' && activeMenu) {
            event.preventDefault(); event.stopPropagation(); close(true);
          }
        });
        menu.addEventListener('keydown', event => {
          if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
          else if (event.key === 'Tab') close(true);
          else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); event.stopPropagation();
            const items = [...menu.querySelectorAll('button')];
            const index = items.indexOf(document.activeElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
            items[next].focus();
          }
        });
        row.append(projectButton, button, menu);
        list.append(row);
      }
      content.replaceChildren(list);
    }
    if (focusIndex >= 0) {
      const options = content.querySelectorAll('.history-options');
      (options[Math.min(focusIndex, options.length - 1)] || document.querySelector('[data-close-navigation="history"]')).focus();
    }
  }

  return { render, close };
}
