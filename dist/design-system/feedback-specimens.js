import { revisionChangeSummary } from '../revision-change-summary.js?v=20261030-declined-revision-details';
import { createFeedbackPill, createVariantFeedback } from '../variant-feedback.js?v=20261026-drafting-card-size';
import { createRevisionButton, updateRevisionButton, createRevisionRequests } from '../revision-requests.js?v=20261030-revision-headings';
import { createEditorTabs } from '../editor-tabs.js?v=20261029-revision-indicator-location';
import { createStoryMetadata, storyMetadata } from '../story-metadata.js?v=20261027-metadata';
import { createRevisionLoading } from '../revision-loading.js?v=20261027-revision-loading';
import { tokenNumber } from './runtime.js?v=20261029-revision-indicator-location';
import { createOutputBadges, outputLoadingSelectionKeys, reviseSampleOutput } from '../outputs.js?v=20261030-declined-revision-details';
import { sendDestinations } from '../send-destination.js?v=20261026-drafting-card-size';

// The app controller operates on isolated in-memory drafts here. No project storage,
// content storage or server submission is used.
export function mountFeedbackSpecimens(root, dropdowns) {
  if (!root) return;
  const document = root.ownerDocument;
  const dialog = document.querySelector('#experience-feedback-dialog');
  const project = { id: 'ds-feedback-project', updatedAt: Date.now() };
  const sampleParagraphs = ['The library opens on Saturday. Doors open at nine.', 'Visitors can join a guided tour. Families can register for the reading club.', 'Registration is free.'];
  const sampleContent = paragraphs => ({ draftText: paragraphs.join('\n\n'), document: { ops: paragraphs.map(text => ({ insert: `${text}\n` })) } });
  const variant = { id: 'ds-feedback-draft', title: 'The Town Library Opens Its Doors', ...sampleContent(sampleParagraphs), status: 'ready', labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'General Audience' }, { key: 'voice', label: 'Us Weekly' }] };
  const otherVariant = { id: 'ds-feedback-other-draft', title: 'Neighbors Turn a Shared Idea Into a New Tradition', ...sampleContent(['Neighbors are planning a weekend book exchange.', 'Readers can bring a book and choose another to take home. Volunteers will arrange the books on shared tables.', 'The exchange will take place in the community hall.']), status: 'ready', labels: [{ key: 'format', label: 'Listicle' }] };
  project.outputs = [variant, otherVariant];
  project.selectedOutputId = variant.id;
  let invokingControl = null;

  const heading = document.createElement('h4');
  heading.className = 'ds-button-example-title';
  heading.id = 'ds-draft-feedback-title';
  heading.textContent = 'Draft Feedback & Revision';
  const guidance = document.createElement('p');
  guidance.className = 'ds-caption';
  guidance.textContent = 'Request Revision uses edit_document, outlined when closed and filled while its popup is open, matching Sources. Revision History sits at the left of the dialog footer, aligned with its buttons, and expands the selected draft’s saved requests with the shared closed chevron; it appears only after that draft has a saved revision. One revision uses Revision History; multiple revisions add a count, such as Revision History (3). Submitting the popup previews the editor’s Revising Draft state below. The matching Content card also says Revising Draft and uses the same shared revision animation. Its shimmer follows the saved draft settings: Format is pink, Audience is lavender, and Voice is peach. Only selected categories cycle, in that order; a single category keeps its color and drafts without settings use neutral. The 5-second revision cycle shows each selected color before completion. The loading layer aligns with the settings and text edges, covers their full height without collapsing the layout, and uses 8 px corners. Metadata opens the sample draft’s SEO Title, Meta Description, and SEO Keywords. Revision History in Request Revision is the place to review saved revisions; the editor footer has no duplicate revision link. Entries appear newest first. A single revision has no numbered heading. When there are multiple revisions, each starts with its original Revision N heading, so Revision 2 appears above Revision 1. These headings use semantic.color.text.primary (#404040), matching New Draft. The completion date and time follow without a Revised label. Requested Revision shows the exact original request, followed by a separate Result field containing the saved outcome. These fields apply to both successful and declined revisions. If no outcome was saved, Result says “The result was not recorded.” Successful results name the observed edit and where it happened, such as splitting the opening paragraph, shortening a paragraph, or changing a list format. They come from before-and-after content, not assumptions that the request was fulfilled, and finish with “; left all other content unchanged.” A completed no-op can report “Left all content unchanged.” Unsupported requests leave the content unchanged and explain why the request could not be applied. Previously saved notes retain the outcome recorded at the time. Elephant requests leave the draft untouched. Requested Revision preserves their original request, and Result contains the exact refusal, including the title of the story being revised. This isolated sample uses the app’s revision function. Try “add bullet points” to convert the body, “add bullet points to the first paragraph” to target the opening, or “add bullet points to the second paragraph” to turn its two sentences into two visible list items. It also supports specified paragraphs and numbered lists. Other requests leave its content unchanged and report the limitation. Switch to the second tab while revising to see the first tab’s paper animation, category shimmer, and Revising Draft label. Completion keeps your current tab selected. For the open revised draft, an 8 px blue (#3B82F6) dot appears at the top right of Request Revision and stays until that action is opened. The tab notification keeps its existing acknowledgement rules: inactive tabs keep their dot until opened, and a draft that remains selected acknowledges its tab notification after 10 seconds. Opening a tab clears only its tab notification; the separate Request Revision dot stays until clicked. Opening an unread Request Revision action automatically expands Revision History when saved entries exist and acknowledges the dot. Opening the action again starts with history collapsed; the chevron still toggles it manually. Loading labels use Inter Medium Italic (500). Tabs and Send to your CMS remain visible; editing and sending resume when the revision completes. This sample keeps requests only while this page is open. Choose a thumb to open the app’s feedback form. Rating, Category, and Describe the issue are required. Severity is required only for Could be better; it is optional for Good feedback. Additional comments are optional. The issue summary allows 500 characters. Description and comment fields use the white field surface. The export heading-to-button and button-to-divider gaps are both 32 px.';
  const noteExamples = document.createElement('details');
  noteExamples.className = 'ds-writing-rule';
  noteExamples.id = 'ds-revision-note-examples';
  const examplesSummary = document.createElement('summary');
  examplesSummary.innerHTML = '<span>Revision Note Examples</span><span class="material-symbols-outlined" aria-hidden="true">chevron_forward</span>';
  const examplesBody = document.createElement('div');
  examplesBody.className = 'ds-writing-rule-body';
  const examplesIntro = document.createElement('p');
  examplesIntro.textContent = 'Name the edit and its location. These outcomes are calculated from sample before-and-after content; a requested change alone is not evidence that it happened.';
  const examplesList = document.createElement('dl');
  examplesList.className = 'editor-seo-metadata';
  const sampleOpening = 'The library opens on Saturday. Visitors can join a guided tour.';
  const listExampleBefore = sampleContent(sampleParagraphs);
  const listExampleAfter = structuredClone(listExampleBefore);
  reviseSampleOutput(listExampleAfter, 'Add bullet points to the second paragraph', 0, 1);
  const firstListExampleAfter = structuredClone(listExampleBefore);
  reviseSampleOutput(firstListExampleAfter, 'Add bullet points to the first paragraph', 0, 1);
  for (const example of [
    { label: 'First Paragraph: ', instructions: 'Add bullet points to the first paragraph', before: listExampleBefore, after: firstListExampleAfter },
    { label: 'Bulleted Paragraph: ', instructions: 'Add bullet points to the second paragraph', before: listExampleBefore, after: listExampleAfter },
    { label: 'Paragraph Split: ', instructions: 'Split the opening paragraph.', before: { draftText: sampleOpening + '\n\nRegistration is free.' }, after: { draftText: 'The library opens on Saturday.\n\nVisitors can join a guided tour.\n\nRegistration is free.' } },
    { label: 'Shorter Opening: ', instructions: 'Shorten the opening.', before: { draftText: 'The public library will open its doors to visitors on Saturday.\n\nRegistration is free.' }, after: { draftText: 'The library opens on Saturday.\n\nRegistration is free.' } },
  ]) {
    const row = document.createElement('div');
    const label = document.createElement('dt');
    label.textContent = example.label;
    const copy = document.createElement('dd');
    copy.textContent = revisionChangeSummary(example.before, example.after, example.instructions);
    row.append(label, copy);
    examplesList.append(row);
  }
  examplesBody.append(examplesIntro, examplesList);
  noteExamples.append(examplesSummary, examplesBody);
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
  const previewCopy = document.createElement('div');
  function renderPreviewCopy(output) {
    previewCopy.replaceChildren();
    let line = '', list = null, listType = null;
    const appendLine = (attributes = {}) => {
      if (!line.trim()) { line = ''; list = null; listType = null; return; }
      const type = attributes.list === 'bullet' ? 'ul' : attributes.list === 'ordered' ? 'ol' : null;
      const block = document.createElement(type ? 'li' : 'p');
      block.textContent = line;
      if (type) {
        if (!list || listType !== type) {
          list = document.createElement(type);
          listType = type;
          previewCopy.append(list);
        }
        list.append(block);
      } else {
        list = null;
        listType = null;
        previewCopy.append(block);
      }
      line = '';
    };
    const ops = Array.isArray(output.document?.ops) ? output.document.ops : [{ insert: output.draftText || '' }];
    for (const op of ops) {
      if (typeof op.insert !== 'string') continue;
      for (const part of op.insert.split(/(\n)/)) {
        if (part === '\n') appendLine(op.attributes);
        else line += part;
      }
    }
    if (line) appendLine();
  }
  renderPreviewCopy(variant);
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
  publish.textContent = 'Send to your CMS';
  publish.disabled = true;
  publish.title = 'Preview only';
  publishActions.append(publish);
  const previewArea = document.createElement('div');
  previewArea.className = 'editor-document-content';
  previewArea.append(previewContent, revisionHost);
  const previewFooter = document.createElement('footer');
  previewFooter.className = 'editor-footer';
  previewFooter.innerHTML = '<button class="editor-metadata-trigger" id="editor-metadata-button" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="editor-metadata-popover">Metadata<span class="material-symbols-outlined editor-flyover-chevron" aria-hidden="true">chevron_forward</span></button>';
  preview.append(previewArea, publishActions, previewFooter);
  const revisionLoading = createRevisionLoading({ host: revisionHost, content: [previewContent, previewFooter] });
  let revisionTimer;
  let pendingRevision = null;
  function refreshPreview() {
    const selected = project.outputs.find(output => output.id === project.selectedOutputId) || variant;
    const busy = project.outputProcessing?.kind === 'revision';
    previewTitle.textContent = selected.title;
    previewLabels.replaceChildren(...createOutputBadges(selected, { includeWordCount: false }));
    renderPreviewCopy(selected);
    revisionLoading.setBusy(busy && selected === variant, outputLoadingSelectionKeys(variant));
    updateRevisionButton(revisionButton, variant, busy || selected !== variant);
    for (const button of pill.querySelectorAll('button')) button.disabled = selected !== variant;
    previewExport.disabled = selected !== variant;
    previewTabs.render(project);

  }
  function finishRevisionPreview() {
    clearTimeout(revisionTimer);
    if (pendingRevision) {
      reviseSampleOutput(variant, pendingRevision.instructions, pendingRevision.requestedAt);
      pendingRevision = null;
    }
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
  root.replaceChildren(heading, guidance, noteExamples, actions, tabs, preview, status);
  const previewTabs = createEditorTabs({ onRevisionRead() { refreshPreview(); }, onSelect(id) {
    const selected = project.outputs.find(output => output.id === id);
    if (!selected) return;
    selected.revisionUnread = false;
    project.selectedOutputId = selected.id;
    metadata.close();

    refreshPreview();
  } });
  previewTabs.render(project);
  const metadata = createStoryMetadata({ container: preview, closePanels: () => dropdowns.close(), read: () => {
    const selected = project.outputs.find(output => output.id === project.selectedOutputId) || variant;
    return storyMetadata(selected.title, selected.draftText || '');
  } });

  const revisionDialog = document.querySelector('#revision-request-dialog');
  const revisions = createRevisionRequests({
    onRevisionRead() { refreshPreview(); },
    closePanels: () => dropdowns.close(),
    onSubmit(request) {
      if (pendingRevision || project.outputProcessing) return false;
      pendingRevision = { instructions: request.instructions, requestedAt: Date.now() };
      project.outputProcessing = { kind: 'revision', ids: [variant.id] };
      metadata.close();

      refreshPreview();
      status.textContent = '';
      revisionTimer = setTimeout(() => {
        finishRevisionPreview();
        status.textContent = 'Sample revision complete. ' + variant.revisionRequests.at(-1).changeSummary;
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
