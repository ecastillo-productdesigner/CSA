import { createEditorPopover } from './editor-popover.js?v=20261111-card-direction';

// Receives the direction captured on this draft, never the current composer value.
export function createEditorialDirectionMetadata() {
  const container = document.querySelector('#material-editor');
  const trigger = document.querySelector('#editor-direction-button');
  const empty = document.querySelector('#editor-direction-empty');
  const popover = document.querySelector('#editor-direction-popover');
  const copy = document.querySelector('#editor-direction-copy');
  const dismiss = document.querySelector('#editor-direction-close');
  let direction = '';
  let details = null;
  let externalDetails = null;
  // Card indicators remain available when the editor itself is hidden.
  document.body.append(popover);
  const shorterDraftNote = 'Created a shorter draft from the available sources. Add sources or use Request Revision to expand it.';
  const savedDirection = value => typeof value === 'string' && value.trim() ? value : '';
  const formatDetails = (value, shorterDraftAccepted) => {
    const text = savedDirection(value);
    return { text, shorterDraftAccepted: Boolean(text) && shorterDraftAccepted === true };
  };
  const renderDetails = detail => {
    copy.textContent = detail?.text || '';
    if (!detail?.shorterDraftAccepted) return;
    const label = document.createElement('strong');
    label.className = 'editor-direction-notice-label';
    label.textContent = 'Word count notice:';
    copy.append(document.createTextNode('\n\n'), label, document.createTextNode(` ${shorterDraftNote}`));
  };
  const controller = createEditorPopover({ container, trigger, popover, dismiss, compact: true, onOpen(anchor) {
    renderDetails(anchor === trigger ? details : externalDetails);
  } });

  function update(value, { shorterDraftAccepted = false } = {}) {
    controller.close();
    direction = savedDirection(value);
    details = formatDetails(direction, shorterDraftAccepted);
    externalDetails = null;
    renderDetails(details);
    trigger.hidden = !direction;
    empty.hidden = Boolean(direction);
  }
  update('');
  return {
    update,
    close: controller.close,
    toggleFor(button, output) {
      externalDetails = formatDetails(output?.editorialDirection, output?.shorterDraftAccepted);
      if (!externalDetails.text) { controller.close(); return; }
      controller.toggleFor(button);
    },
  };
}
