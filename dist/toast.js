import { tokenNumber } from './design-system/runtime.js?v=20261027-toast-timing';

export function createToast({ root, message, action }) {
  let timer = null;
  let undo = null;
  function hide() {
    clearTimeout(timer);
    timer = null;
    undo = null;
    root.hidden = true;
    action.hidden = true;
  }
  function onUndo() {
    if (!undo) return;
    const callback = undo;
    hide();
    callback?.();
  }
  action.addEventListener('click', onUndo);
  return {
    show(text, callback = null) {
      hide();
      undo = typeof callback === 'function' ? callback : null;
      message.textContent = String(text).trim().replace(/\.\s*$/, '');
      action.hidden = !undo;
      root.hidden = false;
      timer = setTimeout(hide, tokenNumber(undo ? 'component.toast.undo-duration' : 'component.toast.message-duration'));
    },
    hide,
    destroy() { hide(); action.removeEventListener('click', onUndo); },
  };
}
