import { createEditorPopover } from './editor-popover.js?v=20261027-metadata';

// Receives the direction captured on this draft, never the current composer value.
export function createEditorialDirectionMetadata() {
  const container = document.querySelector('#material-editor');
  const trigger = document.querySelector('#editor-direction-button');
  const empty = document.querySelector('#editor-direction-empty');
  const popover = document.querySelector('#editor-direction-popover');
  const copy = document.querySelector('#editor-direction-copy');
  const dismiss = document.querySelector('#editor-direction-close');
  let direction = '';
  const controller = createEditorPopover({ container, trigger, popover, dismiss, onOpen() { copy.textContent = direction; } });

  function update(value) {
    controller.close();
    direction = typeof value === 'string' && value.trim() ? value : '';
    copy.textContent = direction;
    trigger.hidden = !direction;
    empty.hidden = Boolean(direction);
  }
  update('');
  return { update, close: controller.close };
}
