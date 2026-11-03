import { createOutputBadges } from './outputs.js?v=20261102-saved-drafts';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { tokenNumber } from './design-system/runtime.js?v=20261029-revision-indicator-location';
import { createDropdownTransition } from './dropdown-transition.js?v=20261026-drafting-card-size';

export function createSavedDrafts({ getEntries, getSelection, isDisabled, onApply, onClear, onRename, onRemove, onBeforeOpen }) {
  const root = document.querySelector('#saved-drafts');
  const trigger = document.querySelector('#saved-drafts-trigger');
  const label = trigger.querySelector('[data-saved-drafts-label]');
  const menu = document.createElement('div');
  menu.id = 'saved-drafts-menu';
  menu.className = 'saved-drafts-menu';
  menu.dataset.workspaceDropdown = 'true';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-label', 'My Saved Drafts');
  menu.tabIndex = -1;
  const list = document.createElement('div');
  list.className = 'saved-drafts-list';
  const empty = document.createElement('p');
  empty.className = 'saved-drafts-empty';
  empty.textContent = 'No saved drafts yet. Use a heart on a content card to save its settings.';
  menu.append(list, empty);
  document.body.append(menu);
  const transition = createDropdownTransition(menu);
  const dialog = document.createElement('dialog');
  dialog.id = 'saved-draft-name-dialog';
  dialog.className = 'saved-draft-name-dialog';
  dialog.setAttribute('aria-labelledby', 'saved-draft-name-heading');
  dialog.innerHTML = `<form><div class="saved-draft-dialog-header"><h2 id="saved-draft-name-heading">Rename Saved Draft</h2><button class="icon-button" type="button" data-close-saved-name aria-label="Close Rename Saved Draft"><span class="material-symbols-outlined" aria-hidden="true">close</span></button></div><p>Give these draft settings a name you can find again.</p><label for="saved-draft-name">Name</label><input id="saved-draft-name" name="name" type="text" maxlength="180" required autocomplete="off"><div class="saved-draft-dialog-actions"><button class="secondary-button" type="button" data-close-saved-name>Cancel</button><button class="primary-button" type="submit">Save Name</button></div></form>`;
  document.body.append(dialog);
  const name = dialog.querySelector('input');
  let renaming = null;
  let signature = '';

  function close(restoreFocus = false) {
    trigger.setAttribute('aria-expanded', 'false');
    transition.close();
    if (restoreFocus && trigger.isConnected && !trigger.disabled) trigger.focus({ preventScroll: true });
  }
  function position() {
    if (!transition.expanded) return;
    const anchor = trigger.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.12');
    const gap = tokenNumber('foundation.space.8');
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    const below = height - anchor.bottom - inset - gap;
    const above = anchor.top - inset - gap;
    const opensUp = below < tokenNumber('foundation.size.160') && above > below;
    menu.style.width = `${Math.min(anchor.width, width - inset * 2)}px`;
    menu.style.maxHeight = `${Math.max(0, opensUp ? above : below)}px`;
    menu.style.left = `${Math.max(inset, Math.min(anchor.left, width - menu.getBoundingClientRect().width - inset))}px`;
    menu.style.top = opensUp ? 'auto' : `${anchor.bottom + gap}px`;
    menu.style.bottom = opensUp ? `${height - anchor.top + gap}px` : 'auto';
    return opensUp;
  }
  function render() {
    const entries = getEntries();
    const selected = getSelection();
    trigger.disabled = Boolean(isDisabled());
    const active = entries.find(entry => entry.project.id === selected?.projectId && entry.output.id === selected?.outputId);
    label.textContent = active?.name || (entries.length ? `My Saved Drafts (${entries.length})` : 'My Saved Drafts');
    trigger.title = active ? `Saved draft: ${active.name}` : 'My Saved Drafts';
    if (trigger.disabled) close();
    const nextSignature = JSON.stringify([selected, entries.map(entry => [entry.project.id, entry.output.id, entry.name, entry.configuration])]);
    if (signature === nextSignature) { position(); return; }
    signature = nextSignature;
    const oldButtons = [...list.querySelectorAll('button')];
    const focusedIndex = oldButtons.indexOf(document.activeElement);
    const noneRow = document.createElement('div');
    noneRow.className = 'saved-draft-row';
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'saved-draft-apply saved-draft-none';
    none.setAttribute('aria-pressed', String(!active));
    const noneLabel = document.createElement('span');
    noneLabel.textContent = 'None Selected';
    const noneCheck = createIcon('check');
    noneCheck.hidden = Boolean(active);
    none.append(noneLabel, noneCheck);
    none.addEventListener('click', () => { close(); onClear(); trigger.focus({ preventScroll: true }); });
    noneRow.append(none);
    list.replaceChildren(noneRow, ...entries.map(entry => {
      const { project, output, name: entryName, configuration } = entry;
      const row = document.createElement('div');
      row.className = 'saved-draft-row';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'saved-draft-apply';
      apply.setAttribute('aria-label', `Use saved draft: ${entryName}`);
      apply.setAttribute('aria-pressed', String(selected?.projectId === project.id && selected?.outputId === output.id));
      const heading = document.createElement('strong');
      heading.textContent = entryName;
      const badges = document.createElement('span');
      badges.className = 'saved-draft-badges';
      badges.append(...createOutputBadges(configuration, { maxLabelLength: 0, includeSourceCount: false, includeWordCount: false }));
      apply.append(heading);
      if (badges.childElementCount) apply.append(badges);
      apply.addEventListener('click', () => { close(); onApply(project.id, output.id); });
      const rename = document.createElement('button');
      rename.type = 'button';
      rename.className = 'icon-button saved-draft-rename';
      rename.setAttribute('aria-label', `Rename saved draft: ${entryName}`);
      rename.title = 'Rename Saved Draft';
      rename.append(createIcon('edit'));
      rename.addEventListener('click', () => {
        close();
        renaming = { projectId: project.id, outputId: output.id };
        name.value = entryName;
        dialog.querySelector('[type="submit"]').disabled = false;
        dialog.showModal();
        name.focus();
        name.select();
      });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'icon-button saved-draft-remove';
      remove.setAttribute('aria-label', `Remove saved draft: ${entryName}`);
      remove.title = 'Remove Saved Draft';
      remove.append(createIcon('delete'));
      remove.addEventListener('click', () => onRemove(project.id, output.id));
      row.append(apply, rename, remove);
      return row;
    }));
    empty.hidden = entries.length > 0;
    list.hidden = false;
    if (focusedIndex >= 0 && transition.expanded) {
      const next = [...list.querySelectorAll('button')];
      (next[Math.min(focusedIndex, next.length - 1)] || menu).focus({ preventScroll: true });
    }
    position();
  }
  function open() {
    if (trigger.disabled) return;
    onBeforeOpen();
    render();
    transition.open({ animate: false });
    const opensUp = position();
    transition.close({ animate: false });
    transition.open({ opensUp });
    trigger.setAttribute('aria-expanded', 'true');
    (list.querySelector('[aria-pressed="true"]') || list.querySelector('button') || menu).focus({ preventScroll: true });
  }
  trigger.addEventListener('click', () => transition.expanded ? close(true) : open());
  trigger.addEventListener('keydown', event => {
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); open(); }
    if (event.key === 'Escape') { event.preventDefault(); close(true); }
  });
  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); return; }
    const buttons = [...list.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement);
    if (event.key === 'Tab' && ((!event.shiftKey && index === buttons.length - 1) || (event.shiftKey && index <= 0) || !buttons.length)) {
      close();
      trigger.focus({ preventScroll: true });
      return;
    }
    const rows = [...list.querySelectorAll('.saved-draft-row')].map(row => [...row.querySelectorAll('button')]);
    const rowIndex = rows.findIndex(row => row.includes(document.activeElement));
    const row = rows[rowIndex] || [];
    const column = Math.max(0, row.indexOf(document.activeElement));
    let target = null;
    if (['ArrowDown', 'ArrowUp'].includes(event.key) && rows.length) {
      const nextRow = rows[(Math.max(0, rowIndex) + (event.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length];
      target = nextRow[Math.min(column, nextRow.length - 1)];
    } else if (['ArrowRight', 'ArrowLeft'].includes(event.key) && row.length) {
      target = row[(column + (event.key === 'ArrowRight' ? 1 : -1) + row.length) % row.length];
    } else if (event.key === 'Home') target = rows[0]?.[0];
    else if (event.key === 'End') target = rows[rows.length - 1]?.[0];
    if (target) { event.preventDefault(); target.focus({ preventScroll: true }); }
  });
  document.addEventListener('pointerdown', event => {
    if (transition.expanded && !root.contains(event.target) && !menu.contains(event.target)) close();
  });
  document.addEventListener('focusin', event => {
    if (transition.expanded && !root.contains(event.target) && !menu.contains(event.target)) close();
  });
  document.addEventListener('scroll', event => { if (!menu.contains(event.target)) position(); }, true);
  window.addEventListener('resize', position);
  name.addEventListener('input', () => { dialog.querySelector('[type="submit"]').disabled = !name.value.trim(); });
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    if (renaming && name.value.trim() && onRename(renaming.projectId, renaming.outputId, name.value.trim())) dialog.close();
  });
  for (const button of dialog.querySelectorAll('[data-close-saved-name]')) button.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) { const box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close(); } });
  dialog.addEventListener('close', () => { renaming = null; trigger.focus({ preventScroll: true }); });
  return { render, close };
}
