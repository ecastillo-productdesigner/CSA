import { createFeedbackPill, createVariantFeedback } from '../variant-feedback.js?v=20261026-drafting-card-size';
import { createRevisionButton, createRevisionRequests } from '../revision-requests.js?v=20261026-drafting-card-size';
import { createEditorTabs } from '../editor-tabs.js?v=20261027-revision-notifications';
import { createLastRevisionNote } from '../last-revision-note.js?v=20261027-metadata';
import { createStoryMetadata, storyMetadata } from '../story-metadata.js?v=20261027-metadata';
import { createRevisionLoading } from '../revision-loading.js?v=20261027-revision-loading';
import { tokenNumber } from './runtime.js?v=20261026-drafting-card-size';
import { createOutputBadges, outputLoadingSelectionKeys } from '../outputs.js?v=20261026-drafting-card-size';
import { sendDestinations } from '../send-destination.js?v=20261026-drafting-card-size';

// The app controller operates on isolated in-memory drafts here. No project storage,
// content storage or server submission is used.
export function mountFeedbackSpecimens(root, dropdowns) {
  if (!root) return;
  const document = root.ownerDocument;
  const dialog = document.querySelector('#experience-feedback-dialog');
  const project = { id: 'ds-feedback-project', updatedAt: Date.now() };
  const variant = { id: 'ds-feedback-draft', title: 'A Local Business Finds a Fresh Way to Connect', status: 'ready', labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'General Audience' }, { key: 'voice', label: 'Us Weekly' }] };
  const otherVariant = { id: 'ds-feedback-other-draft', title: 'Neighbors Turn a Shared Idea Into a New Tradition', status: 'ready', labels: [{ key: 'format', label: 'Listicle' }] };
  project.outputs = [variant, otherVariant];
  project.selectedOutputId = variant.id;
  let invokingControl = null;

  const heading = document.createElement('h4');
  heading.className = 'ds-button-example-title';
  heading.id = 'ds-draft-feedback-title';
  heading.textContent = 'Draft Feedback & Revision';
  const guidance = document.createElement('p');
  guidance.className = 'ds-caption';
  guidance.textContent = 'Request Revision uses edit_document, outlined when closed and filled while its popup is open, matching Sources; submitting the popup previews the editor’s Revising Draft state below. Its shimmer follows the saved draft settings: Format is pink, Audience is lavender, and Voice is peach. Only selected categories cycle, in that order; a single category keeps its color and drafts without settings use neutral. The 5-second revision cycle shows each selected color before completion. The loading layer aligns with the settings and text edges, covers their full height without collapsing the layout, and uses 8 px corners. Metadata opens the sample draft’s SEO title, meta description, and SEO keywords. After a revision, Requested Revision appears at the end of the footer (Requested Revisions for multiple entries) and opens every revision in chronological order, oldest first, with its completion time and requested change. Switch to the second tab while revising to see the first tab’s paper animation, category shimmer, and Revising Draft label. Completion keeps your current tab selected and adds an 8 px red unread dot to the revised tab; activate that tab to clear it. If you stay on the revised tab, its dot clears automatically after 10 seconds. Switching away cancels that timer and keeps the dot until you return. Loading labels use Inter Medium Italic (500). Tabs and Send to CMS remain visible; editing and sending resume when the revision completes. This sample keeps requests only while this page is open. Choose a thumb to open the app’s feedback form. Rating, Category, and Describe the issue are required. Severity is required only for Could be better; it is optional for Good feedback. Additional comments are optional. The issue summary allows 500 characters. Description and comment fields use the white field surface. The export heading-to-button and button-to-divider gaps are both 32 px.';
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
  preview.id = 'editor-canvas-content';
  const tabs = document.createElement('div');
  tabs.id = 'editor-variant-tabs';
  tabs.className = 'editor-variant-tabs ds-revision-preview-tabs';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Sample draft tabs');
  preview.setAttribute('aria-label', 'Revision editor preview');
  const previewContent = document.createElement('div');
  previewContent.className = 'ds-revision-preview-content';
  const previewTitle = document.createElement('h5');
  previewTitle.textContent = variant.title;
  const previewCopy = document.createElement('p');
  previewCopy.textContent = 'Submit Request Revision to preview the loading state in this draft area.';
  const previewLabels = document.createElement('div');
  previewLabels.className = 'editor-variant-labels';
  previewLabels.append(...createOutputBadges(variant, { includeWordCount: false }));
  previewContent.append(previewLabels, previewTitle, previewCopy);
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
  const previewArea = document.createElement('div');
  previewArea.className = 'editor-document-content';
  previewArea.append(previewContent, revisionHost);
  const previewFooter = document.createElement('footer');
  previewFooter.className = 'editor-footer';
  previewFooter.innerHTML = '<button class="editor-metadata-trigger" id="editor-metadata-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="editor-metadata-popover">Metadata<span class="material-symbols-outlined editor-flyover-chevron" aria-hidden="true">chevron_forward</span></button><button class="editor-metadata-trigger" id="editor-revision-note-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="editor-revision-note-popover" hidden><span id="editor-revision-note-label">Requested Revision</span><span class="material-symbols-outlined editor-flyover-chevron" aria-hidden="true">chevron_forward</span></button>';
  preview.append(previewArea, publishActions, previewFooter);
  const revisionLoading = createRevisionLoading({ host: revisionHost, content: [previewContent, previewFooter] });
  let revisionTimer;
  function refreshPreview() {
    const selected = project.outputs.find(output => output.id === project.selectedOutputId) || variant;
    const busy = project.outputProcessing?.kind === 'revision';
    previewTitle.textContent = selected.title;
    previewLabels.replaceChildren(...createOutputBadges(selected, { includeWordCount: false }));
    previewCopy.textContent = selected === variant
      ? 'Submit Request Revision to preview the loading state, then switch to the other draft tab.'
      : 'The first draft keeps revising while you review this draft. Return to its tab to see the full loading area.';
    revisionLoading.setBusy(busy && selected === variant, outputLoadingSelectionKeys(variant));
    revisionButton.disabled = busy || selected !== variant;
    for (const button of pill.querySelectorAll('button')) button.disabled = selected !== variant;
    previewExport.disabled = selected !== variant;
    previewTabs.render(project);
    revisionNote.update(selected);
  }
  function finishRevisionPreview() {
    clearTimeout(revisionTimer);
    const latest = variant.revisionRequests?.at(-1);
    if (latest?.status === 'processing') { latest.completedAt = Date.now(); latest.status = 'complete'; variant.revisionUnread = true; }
    delete project.outputProcessing;
    refreshPreview();
  }
  window.addEventListener('pagehide', () => { clearTimeout(revisionTimer); revisionLoading.destroy(); previewTabs.destroy(); });
  const status = document.createElement('p');
  status.className = 'ds-specimen-status';
  status.setAttribute('role', 'status');
  status.textContent = 'The export form and confirmation share a close icon at the top right. Submit Report shows a centered confirmation using the same 14 px / 20 px Semibold style as the rating question. Use the close icon to dismiss the confirmation. Reopen to review the saved sample; this example keeps feedback only while this page is open.';
  root.classList.add('ds-button-example');
  root.setAttribute('aria-labelledby', heading.id);
  root.replaceChildren(heading, guidance, actions, tabs, preview, status);
  const previewTabs = createEditorTabs({ onSelect(id) {
    const selected = project.outputs.find(output => output.id === id);
    if (!selected) return;
    selected.revisionUnread = false;
    project.selectedOutputId = selected.id;
    metadata.close();
    revisionNote.close();
    refreshPreview();
  } });
  previewTabs.render(project);
  const metadata = createStoryMetadata({ container: preview, closePanels: () => dropdowns.close(), read: () => storyMetadata(previewTitle.textContent, 'A neighborhood café is bringing local musicians and listeners together for an afternoon of unfinished songs. The sessions give neighbors a chance to exchange ideas and enjoy music.') });
  const revisionNote = createLastRevisionNote({ container: preview, closePanels() { metadata.close(); dropdowns.close(); } });

  const revisionDialog = document.querySelector('#revision-request-dialog');
  const revisions = createRevisionRequests({
    closePanels: () => dropdowns.close(),
    onSubmit(request) {
      project.outputProcessing = { kind: 'revision', ids: [variant.id] };
      variant.revisionRequests = [...(variant.revisionRequests || []), { ...request, requestedAt: Date.now(), status: 'processing' }];
      metadata.close();
      revisionNote.close();
      refreshPreview();
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
