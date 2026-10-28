import { createSourceAddingAnimation } from './drafting-animation.js?v=20261026-drafting-card-size';
import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';

// Jobs keep their original deadline when a source list rerenders or changes project.
export function createSourceAdditionLoading({ list, createAnimation = createSourceAddingAnimation }) {
  const jobs = new Set();
  const views = new Map();
  let activeProjectId = null;
  let sourceRows = [];
  const isPending = projectId => [...jobs].some(job => job.projectId === projectId);

  function clearView(source, view) {
    view.animation.destroy();
    view.animation.element.remove();
    if (source) {
      view.row.classList.toggle('is-adding-source', false);
      view.row.removeAttribute('tabindex');
      if (document.activeElement === view.row) view.row.querySelector('input')?.focus({ preventScroll: true });
    } else view.row.remove();
    views.delete(source);
  }

  function render(projectId = activeProjectId, rows = sourceRows) {
    if (activeProjectId !== projectId) for (const [source, view] of views) clearView(source, view);
    activeProjectId = projectId;
    sourceRows = rows;
    const pending = new Set([...jobs].filter(job => job.projectId === projectId).map(job => job.source));
    for (const [source, view] of views) {
      const currentRow = source && rows.find(entry => entry.source === source)?.row;
      if (!pending.has(source) || (source && currentRow !== view.row)) clearView(source, view);
    }
    for (const source of pending) {
      let view = views.get(source);
      if (!view) {
        const row = source ? rows.find(entry => entry.source === source)?.row : document.createElement('li');
        if (!row) continue;
        const animation = createAnimation({ label: source ? 'Adding Source' : 'Adding sources' });
        if (source) {
          row.classList.toggle('is-adding-source', true);
          row.setAttribute('tabindex', '-1');
          if (row.contains(document.activeElement)) row.focus({ preventScroll: true });
        } else row.className = 'editor-source-addition';
        row.append(animation.element);
        view = { row, animation };
        views.set(source, view);
      }
      if (!source && list.lastElementChild !== view.row) list.append(view.row);
    }
  }

  function wait(projectId, source = null) {
    return new Promise(resolve => {
      const job = { projectId, source, resolve, timer: null };
      jobs.add(job);
      render();
      if (!source && activeProjectId === projectId) list.scrollTop = list.scrollHeight;
      job.timer = setTimeout(() => {
        jobs.delete(job);
        render();
        resolve(true);
      }, tokenNumber('component.drafting.source-add-duration'));
    });
  }

  function destroy() {
    for (const job of jobs) { clearTimeout(job.timer); job.resolve(false); }
    jobs.clear();
    for (const [source, view] of views) clearView(source, view);
  }

  return { render, wait, isPending, destroy };
}
