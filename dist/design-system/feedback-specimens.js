import { createFeedbackPill, createVariantFeedback } from '../variant-feedback.js?v=20261026-drafting-card-size';
import { createRevisionButton, createRevisionRequests } from '../revision-requests.js?v=20261026-drafting-card-size';
import { createRevisionLoading } from '../revision-loading.js?v=20261027-revision-loading';
import { tokenNumber } from './runtime.js?v=20261026-drafting-card-size';
import { sendDestinations } from '../send-destination.js?v=20261026-drafting-card-size';

// The app controller operates on one in-memory draft here. No project storage,
// content storage or server submission is used.
export function mountFeedbackSpecimens(root, dropdowns) {
  if (!root) return;
  const document = root.ownerDocument;
  const dialog = document.querySelector('#experience-feedback-dialog');
  const project = { id: 'ds-feedback-project', updatedAt: Date.now() };
  const variant = { id: 'ds-feedback-draft', title: 'A Local Business Finds a Fresh Way to Connect', status: 'ready' };
  let invokingControl = null;

  const heading = document.createElement('h4');
  heading.className = 'ds-button-example-title';
  heading.id = 'ds-draft-feedback-title';
  heading.textContent = 'Draft Feedback & Revision';
  const guidance = document.createElement('p');
  guidance.className = 'ds-caption';
  guidance.textContent = 'Request Revision uses edit_document, outlined when closed and filled while its popup is open, matching Sources; submitting the popup previews the editor’s mint Revising Draft state below, using the same shimmer as Adding your Source. Tabs and Send to CMS remain visible; editing and sending resume when the revision completes. This sample keeps requests only while this page is open. Choose a thumb to open the app’s feedback form. Rating, Category, and Describe the issue are required. Severity is required only for Could be better; it is optional for Good feedback. Additional comments are optional. The issue summary allows 500 characters. Description and comment fields use the white field surface. The export heading-to-button and button-to-divider gaps are both 32 px.';
  const revisionButton = createRevisionButton(variant);
  const pill = createFeedbackPill(variant);
  const previewExport = document.createElement('button');
  previewExport.type = 'button';
  previewExport.className = 'secondary-button';
  previewExport.textContent = 'Preview after export';
  const actions = document.createElement('div');
  actions.className = 'ds-inline';
  actions.append(revisionButton, pill, previewExport);
  const preview = document.createElement('div');
  preview.className = 'editor-sheet ds-revision-preview';
  preview.setAttribute('aria-label', 'Revision editor preview');
  const previewContent = document.createElement('div');
  previewContent.className = 'ds-revision-preview-content';
  const previewTitle = document.createElement('h5');
  previewTitle.textContent = variant.title;
  const previewCopy = document.createElement('p');
  previewCopy.textContent = 'Submit Request Revision to preview the loading state in this draft area.';
  previewContent.append(previewTitle, previewCopy);
  const revisionHost = document.createElement('div');
  revisionHost.className = 'editor-revision-loading';
  revisionHost.hidden = true;
  const publishActions = document.createElement('div');
  publishActions.className = 'editor-publish-actions';
  const publish = document.createElement('button');
  publish.className = 'editor-wordpress-button';
  publish.type = 'button';
  publish.textContent = 'Send to CMS';
  publish.disabled = true;
  publish.title = 'Preview only';
  publishActions.append(publish);
  preview.append(previewContent, revisionHost, publishActions);
  const revisionLoading = createRevisionLoading({ host: revisionHost, content: [previewContent] });
  let revisionTimer;
  function finishRevisionPreview() {
    clearTimeout(revisionTimer);
    revisionLoading.setBusy(false);
    revisionButton.disabled = false;
  }
  window.addEventListener('pagehide', finishRevisionPreview);
  const status = document.createElement('p');
  status.className = 'ds-specimen-status';
  status.setAttribute('role', 'status');
  status.textContent = 'The export form and confirmation share a close icon at the top right. Submit Report shows a centered confirmation using the same 14 px / 20 px Semibold style as the rating question. Use the close icon to dismiss the confirmation. Reopen to review the saved sample; this example keeps feedback only while this page is open.';
  root.classList.add('ds-button-example');
  root.setAttribute('aria-labelledby', heading.id);
  root.replaceChildren(heading, guidance, actions, preview, status);

  const revisionDialog = document.querySelector('#revision-request-dialog');
  const revisions = createRevisionRequests({
    closePanels: () => dropdowns.close(),
    onSubmit(request) {
      variant.revisionRequests = [...(variant.revisionRequests || []), request];
      revisionLoading.setBusy(true);
      revisionButton.disabled = true;
      status.textContent = '';
      revisionTimer = setTimeout(() => {
        finishRevisionPreview();
        status.textContent = 'Sample revision complete: ' + request.instructions;
      }, tokenNumber('component.drafting.revision-duration'));
      return true;
    },
  });
  revisionButton.addEventListener('click', () => revisions.open(project, variant));
  revisionDialog.addEventListener('click', event => {
    if (event.target.closest('[data-close="revision-request-dialog"]')) { revisionDialog.close(); return; }
    if (event.target !== revisionDialog) return;
    const bounds = revisionDialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) revisionDialog.close();
  });

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
