import { createSimilaritySourceDraft } from '../audience-similarity-source.js?v=20261120-panel-recalculation';
import { currentAudienceComparison, toggleAudienceComparison } from '../audience-comparison-selection.js?v=20261119-plan-scroll';
import { createOutputBadges } from '../outputs.js?v=20261120-chip-tooltips';
import { createAudienceSimilarityDialog } from '../audience-similarity-dialog.js?v=20261120-panel-recalculation';
import { createAudienceSimilarityLoading } from '../audience-similarity-loading.js?v=20261120-panel-recalculation';

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
  const opener = root.querySelector('[data-check-similarity]');
  const status = root.querySelector('[data-similarity-status]');
  const list = root.querySelector('[data-similarity-cards]');
  const controls = [...root.querySelectorAll('[data-similarity-state]')];
  const project = { id: 'ds-audience-similarity', outputs: sampleDrafts(), sourceStory: { title: 'Shared Garden Reopens Next Month', paragraphs: ['A shared garden will reopen next month after volunteers finish repairing the beds. Neighbors can join a planting session on Saturday.', '“Everyone can help the garden grow,” says organizer Maya Chen. The group will supply seeds and tools.', 'Residents can sign up for weekly watering shifts. Raised beds and evening sessions will welcome more neighbors.'] } };
  const comparison = createAudienceSimilarityDialog({
    id: 'ds-audience-similarity-dialog',
    onSaveDraft(draft, patch) { Object.assign(draft, patch); render(); return true; },
    onRecalculate: startComparison,
  });
  const loading = createAudienceSimilarityLoading({ list, button: opener });
  let state = 'ready';
  let selectedIds = [];

  function renderCards() {
    list.replaceChildren(...project.outputs.map(output => {
      const item = doc.createElement('li');
      const card = doc.createElement('article');
      card.className = 'output-card';
      card.dataset.ready = 'true';
      card.dataset.selected = String(selectedIds.includes(output.id));
      const badges = doc.createElement('span');
      badges.className = 'output-badges';
      badges.setAttribute('role', 'group');
      badges.setAttribute('aria-label', 'Draft settings');
      badges.append(...createOutputBadges(output, { includeWordCount: false, includeSourceCount: false }));
      const heading = doc.createElement('button');
      heading.type = 'button';
      heading.className = 'output-open';
      heading.dataset.outputId = output.id;
      heading.setAttribute('aria-pressed', String(selectedIds.includes(output.id)));
      heading.setAttribute('aria-label', `Select draft for comparison: ${output.title}`);
      const title = doc.createElement('strong');
      title.className = 'output-card-title';
      title.textContent = output.title;
      title.title = output.title;
      heading.append(title);
      card.addEventListener('click', () => {
        const restoreFocus = doc.activeElement === heading;
        const next = toggleAudienceComparison(project, selectedIds, output.id);
        selectedIds = next.ids;
        render();
        if (restoreFocus) [...list.querySelectorAll('[data-output-id]')].find(button => button.dataset.outputId === output.id)?.focus({ preventScroll: true });
      });
      card.append(badges, heading);
      item.append(card);
      return item;
    }));
  }

  function render() {
    loading.cancel();
    const selection = currentAudienceComparison(project, selectedIds);
    selectedIds = selection.ids;
    opener.disabled = !selection.group;
    status.textContent = state === 'ready' ? '3 drafts across 3 audiences' : '1 draft for Wellness Enthusiast';
    for (const control of controls) control.setAttribute('aria-pressed', String(control.dataset.similarityState === state));
    renderCards();
  }

  for (const control of controls) {
    control.addEventListener('click', () => {
      loading.cancel();
      state = control.dataset.similarityState;
      project.outputs = state === 'ready' ? sampleDrafts() : sampleDrafts().slice(0, 1);
      selectedIds = [];
      render();
    });
  }
  function startComparison(request = {}) {
    if (loading.isRunning) return false;
    const selection = currentAudienceComparison(project, selectedIds);
    if (!selection.group || (request.editedDraft && !project.outputs.includes(request.editedDraft))) return false;
    const pendingIds = Array.isArray(request.draftIds) ? [...request.draftIds] : [...selection.ids];
    if (pendingIds.length !== selection.ids.length
      || pendingIds.some((id, index) => id !== selection.ids[index])) {
      render();
      return false;
    }
    const context = { ...request, draftIds: pendingIds };
    const itemsById = new Map([...list.querySelectorAll('[data-output-id]')]
      .map(button => [button.dataset.outputId, button.closest('li')]));
    const items = pendingIds.map(id => itemsById.get(id)).filter(Boolean);
    if (items.length !== pendingIds.length) {
      render();
      return false;
    }
    return loading.start({
      items,
      onComplete() {
        const current = currentAudienceComparison(project, selectedIds);
        if (!current.group || (context.editedDraft && !project.outputs.includes(context.editedDraft))
          || current.ids.length !== pendingIds.length
          || current.ids.some((id, index) => id !== pendingIds[index])) {
          render();
          return;
        }
        comparison.open({ ...context, groups: [current.group], sourceDraft: context.sourceDraft || createSimilaritySourceDraft(project, current.group.drafts), opener });
      },
    });
  }

  opener.addEventListener('click', () => startComparison());
  render();
  window.addEventListener('pagehide', () => {
    loading.destroy();
    comparison.destroy();
  }, { once: true });
  return comparison;
}
