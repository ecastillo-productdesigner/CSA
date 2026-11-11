import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { INITIAL_DRAFT_WORD_LIMIT, requestedEditorialWordCount } from './editorial-word-count.js?v=20261111-word-count-notice';

export function createEditorialWordCountNotice({ host = document.body, id = 'editorial-word-count-dialog' } = {}) {
  const node = (tag, className, text) => {
    const element = document.createElement(tag);
    element.className = className || '';
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const dialog = node('dialog', 'revision-request-dialog editorial-word-count-dialog');
  dialog.id = id;
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-labelledby', `${id}-heading`);
  dialog.setAttribute('aria-describedby', `${id}-description ${id}-recommendation`);
  dialog.setAttribute('data-manual-dismiss', 'true');
  const heading = node('div', 'revision-request-heading');
  const title = node('h2', '', 'Word Count Notice');
  title.id = `${id}-heading`;
  const dismiss = node('button', 'icon-button');
  dismiss.type = 'button';
  dismiss.setAttribute('aria-label', 'Close word count notice');
  dismiss.append(createIcon('close'));
  heading.append(title, dismiss);
  const description = node('p', '', 'An initial draft can’t guarantee the requested length from the available source material.');
  description.id = `${id}-description`;
  const recommendation = node('p', '', 'Try adding more detailed sources, or use Request Revision to expand a shorter draft.');
  recommendation.id = `${id}-recommendation`;
  const footer = node('div', 'dialog-footer');
  const back = node('button', 'secondary-button', 'Go Back');
  back.type = 'button';
  const proceed = node('button', 'primary-button', 'Continue with Shorter Draft');
  proceed.type = 'button';
  footer.append(back, proceed);
  dialog.append(heading, description, recommendation, footer);
  host.append(dialog);
  let pending = null;
  let resolvePending = null;
  let returnFocus = null;
  let accepted = false;
  const close = () => { if (dialog.open) dialog.close(); };
  dismiss.addEventListener('click', close);
  back.addEventListener('click', close);
  proceed.addEventListener('click', () => { accepted = true; close(); });
  // Escape is an explicit dismissal. Backdrop clicks and timers never dismiss it.
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    const resolve = resolvePending;
    const result = accepted;
    resolvePending = null;
    pending = null;
    accepted = false;
    if (returnFocus?.isConnected && !returnFocus.disabled && !returnFocus.closest('[hidden], [inert]')) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
    resolve?.(result);
  });
  function confirm(directions, { trigger = document.activeElement } = {}) {
    if (pending) return pending;
    const requests = Array.isArray(directions) ? directions : [directions];
    if (!requests.some(text => requestedEditorialWordCount(text) > INITIAL_DRAFT_WORD_LIMIT)) return Promise.resolve(true);
    returnFocus = trigger;
    accepted = false;
    pending = new Promise(resolve => { resolvePending = resolve; });
    dialog.showModal();
    back.focus({ preventScroll: true });
    return pending;
  }
  return { confirm, close, destroy() { close(); dialog.remove(); } };
}
