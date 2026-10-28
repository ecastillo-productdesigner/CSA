import { createIcon } from './icons.js?v=20261026-drafting-card-size';

export function createSourceAlreadyAddedDialog({ host = document.body, id = 'source-already-added-dialog' } = {}) {
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className || '';
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const dialog = node('dialog', 'source-already-added-dialog');
  dialog.id = id;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-labelledby', `${id}-heading`);
  const heading = node('div', 'source-already-added-heading');
  const title = node('h2', '', 'Source Already Added');
  title.id = `${id}-heading`;
  const dismiss = node('button', 'icon-button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Close duplicate source dialog');
  dismiss.append(createIcon('close'));
  heading.append(title, dismiss);
  const footer = node('div', 'dialog-footer');
  const closeButton = node('button', 'primary-button', 'Close');
  closeButton.type = 'button';
  closeButton.autofocus = true;
  footer.append(closeButton);
  dialog.append(heading, footer);
  host.append(dialog);
  let returnFocus = null;
  const close = () => dialog.close();
  dismiss.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
  });
  dialog.addEventListener('close', () => {
    if (returnFocus?.isConnected && !returnFocus.disabled && !returnFocus.closest('[hidden], [inert]')) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  });

  function open({ trigger = document.activeElement } = {}) {
    returnFocus = trigger;
    if (!dialog.open) dialog.showModal();
    closeButton.focus({ preventScroll: true });
  }

  return { open, close, destroy() { if (dialog.open) close(); dialog.remove(); } };
}
