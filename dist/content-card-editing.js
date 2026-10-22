import { createIcon } from './icons.js?v=20261022-toast-copy';

const contentOutputs = project => (Array.isArray(project?.outputs) ? project.outputs : [])
  .filter(output => output && typeof output.id === 'string');

export function createContentCardDeleteButton(output, { disabled = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'icon-button output-card-delete';
  button.dataset.deleteOutput = output.id;
  button.hidden = true;
  button.disabled = disabled;
  button.title = 'Delete Content';
  button.setAttribute('aria-label', `Delete content: ${output.title || 'Untitled content'}`);
  button.append(createIcon('delete'));
  return button;
}

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
  edit.setAttribute('aria-pressed', 'false');
  edit.append(createIcon('edit'));
  actions.append(edit, createContentCardDeleteButton(output, { disabled }));
  return actions;
}

export function createContentCardEditing({ getProject, onDelete }) {
  const panel = document.querySelector('.composer-outputs');
  const list = document.querySelector('#output-list');
  let projectId = null;
  const editingIds = new Set();

  function focusFallback() {
    panel.querySelector('[data-output-view][aria-selected="true"]')?.focus({ preventScroll: true });
  }

  function render(project) {
    if (!panel || !list) return;
    const id = project?.id || null;
    if (projectId !== id) editingIds.clear();
    projectId = id;
    const outputs = new Set(!project?.deletedAt ? contentOutputs(project).map(output => output.id) : []);
    for (const outputId of editingIds) if (!outputs.has(outputId)) editingIds.delete(outputId);
    const processing = Boolean(project?.outputProcessing);
    for (const button of list.querySelectorAll('[data-delete-output]')) {
      const editing = editingIds.has(button.dataset.deleteOutput);
      const card = button.closest('.output-card');
      const edit = card?.querySelector('[data-edit-output]');
      const hidingFocusedDelete = !editing && document.activeElement === button;
      button.hidden = !editing;
      button.disabled = processing;
      if (card) card.dataset.editing = String(editing);
      if (edit) {
        edit.disabled = processing;
        edit.title = editing ? 'Done Editing Content' : 'Edit Content';
        edit.setAttribute('aria-pressed', String(editing));
      }
      if (hidingFocusedDelete) {
        if (edit && !edit.disabled) edit.focus({ preventScroll: true });
        else focusFallback();
      }
    }
  }

  function editContent(button) {
    const project = getProject();
    const outputId = button.dataset.editOutput;
    if (!project?.id || project.deletedAt || project.outputProcessing || button.disabled || !contentOutputs(project).some(output => output.id === outputId)) return;
    if (projectId !== project.id) editingIds.clear();
    projectId = project.id;
    if (editingIds.has(outputId)) editingIds.delete(outputId);
    else editingIds.add(outputId);
    render(project);
  }

  function deleteContent(button) {
    const project = getProject();
    const outputId = button.dataset.deleteOutput;
    if (!editingIds.has(outputId) || project?.id !== projectId || project.deletedAt || project.outputProcessing || button.disabled || button.hidden) return;
    if (!contentOutputs(project).some(output => output.id === outputId)) return;
    const before = [...list.querySelectorAll('[data-edit-output]')];
    const index = before.findIndex(edit => edit.dataset.editOutput === outputId);
    if (!onDelete(outputId)) return;
    const current = getProject();
    if (current?.id !== project.id) return;
    render(current);
    const remaining = [...list.querySelectorAll('[data-edit-output]')].filter(entry => !entry.hidden && !entry.disabled);
    const next = remaining[Math.min(index, remaining.length - 1)];
    if (next) next.focus({ preventScroll: true });
    else focusFallback();
  }

  list?.addEventListener('click', event => {
    const edit = event.target.closest('[data-edit-output]');
    const remove = event.target.closest('[data-delete-output]');
    const button = edit || remove;
    if (!button || !list.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    if (edit) editContent(edit);
    else deleteContent(remove);
  });
  return { render };
}
