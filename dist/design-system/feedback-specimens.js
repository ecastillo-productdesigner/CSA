import { createFeedbackPill, createVariantFeedback } from '../variant-feedback.js?v=20261026-ds-consolidation';
import { sendDestinations } from '../send-destination.js?v=20261026-ds-consolidation';

// The app controller operates on one in-memory draft here. No project storage,
// content editor, server submission, or prototype controllers are mounted.
export function mountFeedbackSpecimens(root, dropdowns) {
  if (!root) return;
  const document = root.ownerDocument;
  const dialog = document.querySelector('#experience-feedback-dialog');
  const project = { id: 'ds-feedback-project', updatedAt: Date.now() };
  const variant = { id: 'ds-feedback-draft', status: 'ready' };
  let invokingControl = null;

  const heading = document.createElement('h4');
  heading.className = 'ds-button-example-title';
  heading.id = 'ds-draft-feedback-title';
  heading.textContent = 'Draft Feedback';
  const guidance = document.createElement('p');
  guidance.className = 'ds-caption';
  guidance.textContent = 'Choose a thumb to open the app’s feedback form. Rating, Category, and Describe the issue are required; Severity and Additional comments are optional. The issue summary allows 500 characters.';
  const pill = createFeedbackPill(variant);
  const previewExport = document.createElement('button');
  previewExport.type = 'button';
  previewExport.className = 'secondary-button';
  previewExport.textContent = 'Preview after export';
  const actions = document.createElement('div');
  actions.className = 'ds-inline';
  actions.append(pill, previewExport);
  const status = document.createElement('p');
  status.className = 'ds-specimen-status';
  status.setAttribute('role', 'status');
  status.textContent = 'Submit Report shows a confirmation and Done. Reopen to review the saved sample; this example keeps feedback only while this page is open.';
  root.classList.add('ds-button-example');
  root.setAttribute('aria-labelledby', heading.id);
  root.replaceChildren(heading, guidance, actions, status);

  const controller = createVariantFeedback({
    save() {
      status.textContent = 'Sample feedback saved for this page. Reopen either thumb to review or change it.';
      return true;
    },
    refreshDropdowns: () => dropdowns.refresh(),
    closeDropdowns: () => dropdowns.close(),
  });
  pill.addEventListener('click', event => {
    const trigger = event.target.closest('[data-variant-feedback]');
    if (!trigger || trigger.disabled) return;
    invokingControl = trigger;
    controller.open(project, variant, trigger.dataset.feedbackRating);
  });
  previewExport.addEventListener('click', () => {
    invokingControl = previewExport;
    const exportUrl = sendDestinations.find(destination => destination.id === 'us-weekly').url;
    controller.open(project, variant, undefined, { exportUrl });
  });
  dialog.addEventListener('click', event => {
    if (event.target.closest('[data-close="experience-feedback-dialog"]')) {
      dialog.close();
      return;
    }
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    invokingControl?.focus({ preventScroll: true });
    invokingControl = null;
  });
  return controller;
}
