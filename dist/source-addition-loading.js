import { createSourceAddingAnimation } from './drafting-animation.js?v=20261026-drafting-card-size';
import { tokenNumber } from './design-system/runtime.js?v=20261026-drafting-card-size';

// Keep additions tied to their project while people navigate between projects.
export function createSourceAdditionLoading({ list, createAnimation = createSourceAddingAnimation }) {
  const jobs = new Set();
  let activeProjectId = null;
  let animation = null;
  let row = null;
  let rowProjectId = null;

  const isPending = projectId => [...jobs].some(job => job.projectId === projectId);

  function clearRow() {
    animation?.destroy();
    animation = null;
    row?.remove();
    row = null;
    rowProjectId = null;
  }

  function render(projectId = activeProjectId) {
    activeProjectId = projectId;
    if (!projectId || !isPending(projectId)) { clearRow(); return; }
    if (rowProjectId !== projectId) {
      clearRow();
      rowProjectId = projectId;
      row = document.createElement('li');
      row.className = 'editor-source-addition';
      animation = createAnimation({ label: 'Adding sources' });
      row.append(animation.element);
    }
    if (list.lastElementChild !== row) list.append(row);
  }

  function wait(projectId) {
    return new Promise(resolve => {
      const job = { projectId, resolve, timer: null };
      jobs.add(job);
      render();
      if (activeProjectId === projectId) list.scrollTop = list.scrollHeight;
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
    clearRow();
  }

  return { render, wait, isPending, destroy };
}
