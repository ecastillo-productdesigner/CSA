import { createEditorialDirectionMetadata } from '../editorial-direction-metadata.js?v=20261117-word-count-popover';
import { createDraftingAnimation } from '../drafting-animation.js?v=20261111-source-paper-count';
import { tokenNumber } from './runtime.js?v=20261029-revision-indicator-location';

// Use the production completion notice with page-local sample content.
export function mountWordCountSpecimen(root, { onAddSources, onRequestRevision } = {}) {
  if (!root) return;
  const find = selector => root.querySelector(selector);
  const preview = find('#ds-word-count-notice');
  const status = find('#ds-word-count-status');
  const loading = find('#ds-word-count-loading');
  const editor = find('#ds-word-count-editor');
  const body = find('#ds-word-count-draft-copy');
  const direction = createEditorialDirectionMetadata({
    container: editor,
    trigger: find('#ds-word-count-direction-button'),
    empty: find('#ds-word-count-direction-empty'),
    popover: find('#ds-word-count-direction-popover'),
    copy: find('#ds-word-count-direction-copy'),
    dismiss: find('#ds-word-count-direction-close'),
  });
  let animation = null;
  let timer = null;
  let draft = null;

  preview.addEventListener('click', () => {
    direction.close();
    draft = null;
    editor.hidden = true;
    preview.disabled = true;
    status.textContent = 'Creating Draft';
    loading.hidden = false;
    animation = createDraftingAnimation({ selectionKeys: ['format'], label: 'Creating Draft' });
    loading.replaceChildren(animation.element);
    timer = setTimeout(() => {
      timer = null;
      animation.destroy();
      animation = null;
      loading.replaceChildren();
      loading.hidden = true;
      // Complete the sample before opening the notice, matching app ordering.
      draft = {
        editorialDirection: 'Write 750 words',
        draftText: 'Neighbors are planning a shared garden where residents can grow herbs, meet volunteers, and learn from one another. The group has collected ideas for raised beds and a regular weekend planting session. Its next step is to agree on access and maintenance before planting begins.',
        status: 'ready',
        shorterDraftCreated: true,
        wordCountNoticePending: true,
      };
      body.textContent = draft.draftText;
      editor.hidden = false;
      status.textContent = 'Draft ready in this preview';
      preview.disabled = false;
      preview.textContent = 'Replay Draft Completion';
      direction.update(draft.editorialDirection, { shorterDraftCreated: draft.shorterDraftCreated });
      direction.showNotice({
        onDismiss() { draft.wordCountNoticePending = false; },
        onAddSources,
        onRequestRevision,
      });
    }, tokenNumber('component.drafting.processing-duration'));
  });

  window.addEventListener('pagehide', () => {
    if (timer !== null) clearTimeout(timer);
    animation?.destroy();
    direction.close();
  }, { once: true });
}
