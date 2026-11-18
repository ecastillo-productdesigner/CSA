import { createEditorPopover } from './editor-popover.js?v=20261117-word-count-notice';

// Receives the direction captured on this draft, never the current composer value.
export function createEditorialDirectionMetadata({
  container = document.querySelector('#material-editor'),
  trigger = document.querySelector('#editor-direction-button'),
  empty = document.querySelector('#editor-direction-empty'),
  popover = document.querySelector('#editor-direction-popover'),
  copy = document.querySelector('#editor-direction-copy'),
  dismiss = document.querySelector('#editor-direction-close'),
} = {}) {
  let details = null;
  let externalDetails = null;
  let renderedDetails = null;
  // Card indicators remain available when the editor itself is hidden.
  document.body.append(popover);
  const shorterDraftNote = 'Your draft is ready, but shorter than requested. Add more detailed sources or use Request Revision to expand it.';
  const savedDirection = value => typeof value === 'string' && value.trim() ? value : '';
  const formatDetails = (value, { shorterDraftCreated = false, shorterDraftAccepted = false, ...callbacks } = {}) => {
    const text = savedDirection(value);
    return { text, shorterDraftCreated: Boolean(text) && (shorterDraftCreated === true || shorterDraftAccepted === true), callbacks };
  };
  const footer = document.createElement('div');
  footer.className = 'editor-publish-actions editor-direction-actions';
  footer.hidden = true;
  const actions = document.createElement('div');
  actions.className = 'revision-request-actions';
  for (const [label, className, callbackName] of [
    ['Add Sources', 'secondary-button', 'onAddSources'],
    ['Request Revision', 'primary-button', 'onRequestRevision'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = label;
    button.addEventListener('click', () => {
      if (popover.hidden || !renderedDetails?.shorterDraftCreated) return;
      // Dismissal can update the editor, so capture this draft's action first.
      const callback = renderedDetails.callbacks[callbackName];
      controller.dismiss();
      callback?.();
    });
    actions.append(button);
  }
  footer.append(actions);
  popover.append(footer);
  const renderDetails = detail => {
    renderedDetails = detail;
    copy.textContent = detail?.text || '';
    footer.hidden = !detail?.shorterDraftCreated;
    if (!detail?.shorterDraftCreated) return;
    const label = document.createElement('strong');
    label.className = 'editor-direction-notice-label';
    label.textContent = 'Word count notice:';
    copy.append(document.createTextNode('\n\n'), label, document.createTextNode(` ${shorterDraftNote}`));
  };
  const controller = createEditorPopover({ container, trigger, popover, dismiss, compact: true, onOpen(anchor) {
    renderDetails(anchor === trigger ? details : externalDetails);
  }, onDismiss() {
    renderedDetails?.callbacks.onDismiss?.();
  } });

  function update(value, options = {}) {
    controller.close();
    details = formatDetails(value, options);
    externalDetails = null;
    renderDetails(details);
    trigger.hidden = !details.text;
    empty.hidden = Boolean(details.text);
  }
  update('');
  return {
    update,
    close: controller.close,
    closeForRender() {
      if (!controller.isManualOpenFor(trigger)) { controller.close(); return false; }
      // The editor reuses this trigger when it rebuilds its draft labels.
      queueMicrotask(() => { if (controller.isManualOpenFor(trigger)) controller.refresh(); });
      return true;
    },
    showNotice(callbacks = {}) {
      if (!details?.shorterDraftCreated) return false;
      Object.assign(details.callbacks, callbacks);
      return controller.openFor(trigger, { manualDismiss: true });
    },
    toggleFor(button, output, callbacks = {}) {
      externalDetails = formatDetails(output?.editorialDirection, {
        shorterDraftCreated: output?.shorterDraftCreated,
        shorterDraftAccepted: output?.shorterDraftAccepted,
        ...callbacks,
      });
      if (!externalDetails.text) { controller.close(); return; }
      controller.toggleFor(button);
    },
  };
}
