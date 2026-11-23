import { prepareAudienceSimilarities } from '../audience-similarity-summary.js?v=20261123-score-first';
import { createOutputBadges, createOutputSimilarityFooter } from '../outputs.js?v=20261123-score-first';
import { createAudienceSimilarityDialog } from '../audience-similarity-dialog.js?v=20261123-score-first';
import { createAudienceSimilarityLoading } from '../audience-similarity-loading.js?v=20261123-score-first';

// Isolated fictional records. The production model computes these comparisons;
// the specimen never reads or writes project storage.
const sampleDrafts = () => [
  {
    id: 'ds-similarity-garden-guide',
    title: 'What Neighbors Need to Know About the Shared Garden',
    status: 'ready',
    toolPreferences: { audience: 'wellness-enthusiast' },
    labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'Wellness Enthusiast' }],
    draftText: 'A shared garden will reopen next month after volunteers finish repairing the beds. Neighbors can join a planting session on Saturday.\n\n“Everyone can help the garden grow,” says organizer Maya Chen. The group will supply seeds and tools.\n\nResidents can sign up for a weekly watering shift or attend an introductory session. The schedule will be posted at the garden gate.',
  },
  {
    id: 'ds-similarity-garden-weekend',
    title: 'A Weekend at the Shared Garden',
    status: 'ready',
    toolPreferences: { audience: 'trend-chasing-fashion-shopper' },
    labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'Trend-Chasing Fashion Shopper' }],
    draftText: 'The shared garden will reopen next month after volunteers repair the beds. Saturday offers neighbors a chance to plant their first seeds.\n\n“Everyone can help the garden grow,” says organizer Maya Chen. Volunteers will bring tools for anyone joining the session.\n\nA shaded table will host a seed exchange. Children can decorate plant markers, and residents can meet the people organizing the watering schedule.',
  },
  {
    id: 'ds-similarity-garden-access',
    title: 'Three Ways the Garden Will Welcome Neighbors',
    status: 'ready',
    toolPreferences: { audience: 'millennial-pop-culture' },
    labels: [{ key: 'format', label: 'Listicle' }, { key: 'audience', label: 'Millennial Pop-Culture Fan' }],
    draftText: 'The neighborhood garden is making room for people with different schedules and levels of experience.\n\n1. Raised beds will make planting easier for residents who prefer to work at a table.\n\n2. Short evening sessions will give commuters time to visit after work.\n\n3. A notice board will match first-time growers with experienced volunteers. Details will be shared before opening day.',
  },
];

export function mountAudienceSimilaritySpecimen(root) {
  if (!root) return;
  const doc = root.ownerDocument || document;
  const status = root.querySelector('[data-similarity-status]');
  const list = root.querySelector('[data-similarity-cards]');
  const controls = [...root.querySelectorAll('[data-similarity-state]')];
  const project = { id: 'ds-audience-similarity', outputs: sampleDrafts(), sourceStory: { title: 'Shared Garden Reopens Next Month', paragraphs: ['A shared garden will reopen next month after volunteers finish repairing the beds. Neighbors can join a planting session on Saturday.', '“Everyone can help the garden grow,” says organizer Maya Chen. The group will supply seeds and tools.', 'Residents can sign up for weekly watering shifts. Raised beds and evening sessions will welcome more neighbors.'] } };
  const comparison = createAudienceSimilarityDialog({
    id: 'ds-audience-similarity-dialog',
    onSaveDraft(draft, patch) { Object.assign(draft, patch); render(); return true; },
    onRecalculate: recalculate,
  });
  let loading = null;
  let state = 'ready';
  let activeId = project.outputs[0].id;
  let prepared = null;

  const findViewAction = id => [...list.querySelectorAll('[data-view-similarities]')]
    .find(button => button.dataset.viewSimilarities === id);

  function renderCards() {
    list.replaceChildren(...project.outputs.map(output => {
      const item = doc.createElement('li');
      const card = doc.createElement('article');
      card.className = 'output-card';
      card.dataset.ready = 'true';
      card.dataset.selected = String(activeId === output.id);
      const badges = doc.createElement('span');
      badges.className = 'output-badges';
      badges.setAttribute('role', 'group');
      badges.setAttribute('aria-label', 'Draft settings');
      badges.append(...createOutputBadges(output, { includeWordCount: false, includeSourceCount: false }));
      const heading = doc.createElement('button');
      heading.type = 'button';
      heading.className = 'output-open';
      heading.dataset.outputId = output.id;
      heading.setAttribute('aria-pressed', String(activeId === output.id));
      heading.setAttribute('aria-label', `Preview draft: ${output.title}`);
      const title = doc.createElement('strong');
      title.className = 'output-card-title';
      title.textContent = output.title;
      title.title = output.title;
      heading.append(title);
      card.addEventListener('click', event => {
        if (event.target.closest('[data-view-similarities]')) return;
        const restoreFocus = doc.activeElement === heading;
        activeId = output.id;
        render();
        if (restoreFocus) [...list.querySelectorAll('[data-output-id]')].find(button => button.dataset.outputId === output.id)?.focus({ preventScroll: true });
      });
      card.append(badges, heading);
      const summary = prepared.summaries.get(output.id);
      if (summary) {
        const footer = createOutputSimilarityFooter(output, summary);
        const action = footer.querySelector('[data-view-similarities]');
        action.setAttribute('aria-controls', 'ds-audience-similarity-dialog');
        action.addEventListener('click', event => {
          event.stopPropagation();
          openComparison(output.id, action);
        });
        card.append(footer);
      }
      item.append(card);
      return item;
    }));
  }

  function render() {
    loading?.destroy();
    loading = null;
    prepared = prepareAudienceSimilarities(project);
    status.textContent = state === 'ready' ? '3 drafts · Similarities ready' : '1 draft for Wellness Enthusiast';
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.similarityState === state));
    renderCards();
  }

  for (const control of controls) {
    control.addEventListener('click', () => {
      loading?.destroy();
      loading = null;
      state = control.dataset.similarityState;
      project.outputs = state === 'ready' ? sampleDrafts() : sampleDrafts().slice(0, 1);
      activeId = project.outputs[0].id;
      render();
    });
  }
  function openComparison(referenceId, opener, context = {}) {
    if (!prepared.group || loading?.isRunning) return false;
    return comparison.open({
      ...context, groups: [prepared.group], comparisonResults: prepared.comparisons,
      sourceDraft: prepared.sourceDraft,
      referenceId, opener,
    });
  }

  // Initial results are already prepared with the drafts. The existing timed
  // loading treatment is reserved for an explicit recalculation after editing.
  function recalculate(request = {}) {
    if (loading?.isRunning || !prepared.group
      || (request.editedDraft && !project.outputs.includes(request.editedDraft))) return false;
    const ids = prepared.drafts.map(draft => draft.id);
    const pendingIds = Array.isArray(request.draftIds) ? [...request.draftIds] : ids;
    if (pendingIds.length !== ids.length || pendingIds.some((id, index) => id !== ids[index])) return false;
    const context = { ...request, draftIds: pendingIds };
    const itemsById = new Map([...list.querySelectorAll('[data-output-id]')]
      .map(button => [button.dataset.outputId, button.closest('li')]));
    const items = pendingIds.map(id => itemsById.get(id)).filter(Boolean);
    const opener = findViewAction(request.referenceId) || findViewAction(ids[0]);
    if (items.length !== pendingIds.length || !opener) return false;
    loading = createAudienceSimilarityLoading({ list, button: opener, status });
    return loading.start({
      items,
      onComplete() {
        const current = prepareAudienceSimilarities(project);
        const currentIds = current.drafts.map(draft => draft.id);
        if (!current.group || (context.editedDraft && !project.outputs.includes(context.editedDraft))
          || currentIds.length !== pendingIds.length
          || currentIds.some((id, index) => id !== pendingIds[index])) {
          render();
          return;
        }
        render();
        openComparison(context.referenceId, findViewAction(context.referenceId) || findViewAction(currentIds[0]), context);
      },
    });
  }

  render();
  window.addEventListener('pagehide', () => {
    loading?.destroy();
    comparison.destroy();
  }, { once: true });
  return comparison;
}
