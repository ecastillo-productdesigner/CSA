import { createIcon } from './icons.js?v=20261022-linked-stories-motion';
import { tokenNumber } from './design-system/runtime.js?v=20261022-linked-stories-motion';

const contentOutputs = project => (Array.isArray(project?.outputs) ? project.outputs : [])
  .filter(output => output && typeof output.id === 'string');
const menuId = 'content-card-menu';

export function createContentCardActions(output, { disabled = false } = {}) {
  const actions = document.createElement('span');
  actions.className = 'output-card-actions';
  actions.setAttribute('role', 'group');
  actions.setAttribute('aria-label', 'Content actions');
  const edit = document.createElement('button');
  edit.type = 'button';
  edit.className = 'icon-button output-card-edit';
  edit.dataset.editOutput = output.id;
  edit.disabled = disabled;
  edit.title = 'Edit Content';
  edit.setAttribute('aria-label', `Edit content: ${output.title || 'Untitled content'}`);
  edit.setAttribute('aria-haspopup', 'menu');
  edit.setAttribute('aria-expanded', 'false');
  edit.setAttribute('aria-controls', menuId);
  edit.append(createIcon('edit'));
  actions.append(edit);
  return actions;
}

export function createContentCardEditing({ getProject, onDelete }) {
  const panel = document.querySelector('.composer-outputs');
  const list = document.querySelector('#output-list');
  const menu = document.createElement('div');
  menu.id = menuId;
  menu.className = 'project-card-menu output-card-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', 'Content actions');
  menu.hidden = true;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'project-card-menu-item project-card-delete output-card-delete';
  remove.setAttribute('role', 'menuitem');
  remove.disabled = true;
  const label = document.createElement('span');
  label.textContent = 'Delete';
  remove.append(createIcon('delete'), label);
  menu.append(remove);
  document.body.append(menu);
  let active = null;

  function trigger() {
    if (!active || getProject()?.id !== active.projectId) return null;
    return [...list.querySelectorAll('[data-edit-output]')].find(button => button.dataset.editOutput === active.outputId) || null;
  }

  function focusFallback() {
    panel?.querySelector('[data-output-view][aria-selected="true"]')?.focus({ preventScroll: true });
  }

  function close(restoreFocus = false) {
    if (!active) return;
    const button = trigger();
    active.trigger?.setAttribute('aria-expanded', 'false');
    button?.setAttribute('aria-expanded', 'false');
    active = null;
    menu.hidden = true;
    remove.disabled = true;
    delete remove.dataset.deleteOutput;
    if (restoreFocus) {
      if (button && !button.disabled) button.focus({ preventScroll: true });
      else focusFallback();
    }
  }

  function position() {
    const button = trigger();
    if (!button || menu.hidden) return;
    const anchor = button.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.4');
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const below = anchor.bottom + gap;
    const top = below + bounds.height <= height - inset ? below : anchor.top - bounds.height - gap;
    menu.style.left = `${Math.max(inset, Math.min(anchor.right - bounds.width, width - bounds.width - inset))}px`;
    menu.style.top = `${Math.max(inset, Math.min(top, height - bounds.height - inset))}px`;
  }

  function render(project) {
    if (!panel || !list) return;
    const processing = Boolean(project?.outputProcessing);
    for (const button of list.querySelectorAll('[data-edit-output]')) {
      button.disabled = processing;
      button.setAttribute('aria-expanded', String(Boolean(active && project?.id === active.projectId && button.dataset.editOutput === active.outputId)));
    }
    if (!active) return;
    const output = contentOutputs(project).find(entry => entry.id === active.outputId);
    const button = trigger();
    if (project?.id !== active.projectId || project.deletedAt || processing || !output || !button) {
      close(menu.contains(document.activeElement));
      return;
    }
    if (active.trigger !== button) active.trigger.setAttribute('aria-expanded', 'false');
    active.trigger = button;
    menu.setAttribute('aria-label', `Actions for ${output.title || 'Untitled content'}`);
    remove.setAttribute('aria-label', `Delete content: ${output.title || 'Untitled content'}`);
    position();
  }

  function open(button, { toggle = true } = {}) {
    const project = getProject();
    const outputId = button.dataset.editOutput;
    const output = contentOutputs(project).find(entry => entry.id === outputId);
    if (!project?.id || project.deletedAt || project.outputProcessing || button.disabled || !output) return;
    if (active?.projectId === project.id && active.outputId === outputId) {
      if (toggle) close(true);
      else remove.focus({ preventScroll: true });
      return;
    }
    close();
    active = { projectId: project.id, outputId, trigger: button };
    button.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-label', `Actions for ${output.title || 'Untitled content'}`);
    remove.setAttribute('aria-label', `Delete content: ${output.title || 'Untitled content'}`);
    remove.dataset.deleteOutput = outputId;
    remove.disabled = false;
    menu.hidden = false;
    position();
    remove.focus({ preventScroll: true });
  }

  remove.addEventListener('click', () => {
    const target = active;
    const project = getProject();
    if (!target || remove.disabled || project?.id !== target.projectId || project.deletedAt || project.outputProcessing
      || !contentOutputs(project).some(output => output.id === target.outputId)) { close(true); return; }
    const before = [...list.querySelectorAll('[data-edit-output]')];
    const index = before.findIndex(button => button.dataset.editOutput === target.outputId);
    close();
    if (!onDelete(target.outputId)) {
      if (getProject()?.id !== target.projectId) return;
      const button = [...list.querySelectorAll('[data-edit-output]')].find(entry => entry.dataset.editOutput === target.outputId && !entry.disabled);
      if (button) button.focus({ preventScroll: true });
      else focusFallback();
      return;
    }
    if (getProject()?.id !== target.projectId) return;
    const remaining = [...list.querySelectorAll('[data-edit-output]')].filter(button => !button.disabled);
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) next.focus({ preventScroll: true });
    else focusFallback();
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); remove.focus({ preventScroll: true }); }
    else if (event.key === 'Tab') close(true);
  });
  menu.addEventListener('focusout', event => {
    if (active && event.relatedTarget && !menu.contains(event.relatedTarget) && event.relatedTarget !== trigger()) close();
  });
  list?.addEventListener('click', event => {
    const button = event.target.closest('[data-edit-output]');
    if (!button || !list.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    open(button);
  });
  list?.addEventListener('keydown', event => {
    const button = event.target.closest('[data-edit-output]');
    if (!button || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    open(button, { toggle: false });
  });
  document.addEventListener('pointerdown', event => {
    if (active && !menu.contains(event.target) && !trigger()?.contains(event.target)) close();
  });
  document.addEventListener('keydown', event => {
    if (active && event.key === 'Escape') { event.preventDefault(); close(true); }
  });
  document.addEventListener('scroll', event => {
    if (active && !menu.contains(event.target)) close(menu.contains(document.activeElement));
  }, true);
  window.addEventListener('resize', position);
  return { render, close };
}
