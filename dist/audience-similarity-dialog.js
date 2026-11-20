import { createSimilarityDraftEditor } from './audience-similarity-editor.js?v=20261120-recalculate';
import { setCompactChipLabel } from './chip-label.js?v=20261120-chip-tooltips';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { compareAudienceDrafts, draftAudienceLabel, audienceSimilarityVerdict } from './audience-similarity.js?v=20261119-similarity-rings';

const text = value => typeof value === 'string' ? value.trim() : '';

export function similarityScoreBand(value) {
  if (!Number.isFinite(value)) return null;
  return value > 75 ? 'high' : value > 50 ? 'medium' : 'low';
}

export function createAudienceSimilarityDialog({ host = document.body, id = 'audience-similarity-dialog', closePanels = () => {}, onSaveDraft = () => true, createEditor = createSimilarityDraftEditor, onRecalculate = () => {} } = {}) {
  const doc = host.ownerDocument || document;
  const node = (tag, className = '', content) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  };
  const button = (className, content) => {
    const element = node('button', className, content);
    element.type = 'button';
    return element;
  };
  const dialog = node('dialog', 'audience-similarity-dialog');
  dialog.id = id;
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  const header = node('div', 'audience-similarity-header');
  const heading = node('div', 'audience-similarity-heading');
  const title = node('h2', '', 'Audience Similarity');
  title.id = `${id}-title`;
  heading.append(title);
  const dismiss = button('icon-button');
  dismiss.setAttribute('aria-label', 'Close audience similarity');
  dismiss.append(createIcon('close'));
  header.append(heading, dismiss);
  const body = node('div', 'audience-similarity-body');
  const strip = node('div', 'audience-similarity-card-strip');
  const pairs = node('div', 'audience-similarity-pairs');
  pairs.setAttribute('role', 'group');
  pairs.setAttribute('aria-label', 'Choose a reference draft');
  strip.append(pairs);
  const results = node('section', 'audience-similarity-results');
  results.setAttribute('aria-label', 'Similarity scores');
  const status = node('p', 'audience-similarity-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  body.append(strip, results, status);
  const footer = node('div', 'dialog-footer audience-similarity-dialog-footer');
  const done = button('primary-button', 'Done');
  footer.append(done);
  const editorHost = node('div', 'audience-similarity-editor-host');
  editorHost.hidden = true;
  dialog.append(header, body, editorHost, footer);
  host.append(dialog);

  const view = doc.defaultView || globalThis;
  let drafts = [];
  let referenceDraft = null;
  let allowedPairs = new Map();
  let cards = [];
  let opener = null;
  let destroyed = false;
  let resizeObserver = null;
  let edgeFrame = null;
  let editor = null;
  let editingDraft = null;
  let editTriggerId = null;
  let editTriggerOrigin = null;
  const rowEditButtons = new Map();
  let editorSession = 0;
  let pendingRecalculation = null;

  function updateEdges() {
    const maximum = Math.max(0, pairs.scrollWidth - pairs.clientWidth);
    const offset = Math.max(0, Math.min(maximum, pairs.scrollLeft));
    // Ignore subpixel rounding at the ends of the scroll viewport.
    strip.dataset.fadeStart = String(offset > 1);
    strip.dataset.fadeEnd = String(maximum - offset > 1);
    for (const { chips } of cards) {
      chips.dataset.fadeStart = String(chips.scrollLeft > 1);
      chips.dataset.fadeEnd = String(chips.scrollWidth - chips.clientWidth - chips.scrollLeft > 1);
    }
  }

  function scheduleEdges() {
    if (!dialog.open || edgeFrame !== null) return;
    if (typeof view.requestAnimationFrame !== 'function') {
      updateEdges();
      return;
    }
    edgeFrame = view.requestAnimationFrame(() => {
      edgeFrame = null;
      if (dialog.open && !destroyed) updateEdges();
    });
  }

  function stopObservingEdges() {
    resizeObserver?.disconnect();
    resizeObserver = null;
    view.removeEventListener?.('resize', scheduleEdges);
    if (edgeFrame !== null) view.cancelAnimationFrame?.(edgeFrame);
    edgeFrame = null;
    strip.dataset.fadeStart = 'false';
    strip.dataset.fadeEnd = 'false';
  }

  function observeEdges() {
    if (typeof view.ResizeObserver === 'function') {
      resizeObserver = new view.ResizeObserver(scheduleEdges);
      resizeObserver.observe(pairs);
      for (const { field } of cards) resizeObserver.observe(field);
    }
    view.addEventListener?.('resize', scheduleEdges);
    updateEdges();
    scheduleEdges();
  }
  pairs.addEventListener('scroll', scheduleEdges, { passive: true });

  function canCompare(left, right) {
    return Boolean(allowedPairs.get(left.id)?.has(right.id));
  }

  function selectDraft(draft) {
    referenceDraft = draft;
    renderSelection();
    renderResults();
  }

  function renderSelection() {
    for (const { draft, field, card } of cards) {
      const selected = String(referenceDraft === draft);
      field.dataset.selected = selected;
      card.dataset.selected = selected;
      field.setAttribute('aria-pressed', selected);
    }
  }

  function createAudienceLabel(draft, className = 'audience-similarity-draft-audience') {
    const label = draft.isSimilaritySource ? 'Source Draft' : draftAudienceLabel(draft);
    const audienceLabel = node('span', className);
    if (draft.isSimilaritySource) {
      audienceLabel.className += ' audience-similarity-source-label';
    } else if (label === 'None Selected') {
      audienceLabel.className += ' audience-similarity-draft-audience--empty';
      if (className !== 'audience-similarity-draft-audience') audienceLabel.className += ` ${className}--empty`;
    } else {
      audienceLabel.className += ' output-badge output-badge--audience';
    }
    return setCompactChipLabel(audienceLabel, label, { ariaLabel: draft.isSimilaritySource ? 'Source Draft' : `Audience: ${label}` });
  }

  function createEditButton(draft, className, origin) {
    const edit = button(`output-badge output-badge--sources ${className}`, 'Edit');
    edit.setAttribute('aria-label', `Edit draft: ${text(draft.title) || 'Untitled story'}`);
    edit.title = 'Edit Draft';
    edit.addEventListener('click', () => openEditor(draft, origin));
    return edit;
  }

  function renderPairs() {
    pairs.replaceChildren();
    cards = drafts.filter(draft => !draft.isSimilaritySource).map((draft, index) => {
      const titleText = text(draft.title) || 'Untitled story';
      const card = node('div', 'output-card audience-similarity-draft-card');
      card.dataset.ready = 'true';
      const field = button('audience-similarity-draft-select');
      field.dataset.draftId = draft.id;
      field.dataset.ready = 'true';
      field.setAttribute('aria-label', `Compare draft: ${titleText}`);
      const chips = node('span', 'audience-similarity-draft-chips');
      chips.addEventListener('scroll', scheduleEdges, { passive: true });
      chips.append(createAudienceLabel(draft));
      const cardTitle = node('span', 'output-card-title audience-similarity-draft-title', titleText);
      cardTitle.title = titleText;
      field.append(chips, cardTitle);
      field.addEventListener('click', () => selectDraft(draft));
      field.addEventListener('focus', () => {
        field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        scheduleEdges();
      });
      field.addEventListener('keydown', event => {
        let target;
        if (event.key === 'ArrowLeft') target = Math.max(0, index - 1);
        else if (event.key === 'ArrowRight') target = Math.min(cards.length - 1, index + 1);
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = cards.length - 1;
        else return;
        event.preventDefault();
        cards[target].field.focus({ preventScroll: true });
        cards[target].field.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
        scheduleEdges();
      });
      const edit = createEditButton(draft, 'audience-similarity-draft-edit', 'card');
      edit.addEventListener('focus', () => { card.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); scheduleEdges(); });
      card.append(field, edit);
      pairs.append(card);
      return { draft, field, card, edit, chips };
    });
    renderSelection();
  }

  function showComparison() {
    const triggerId = editTriggerId;
    const triggerOrigin = editTriggerOrigin;
    editorSession += 1;
    editingDraft = null;
    editTriggerId = null;
    editTriggerOrigin = null;
    editor?.destroy();
    editor = null;
    editorHost.hidden = true;
    body.hidden = false;
    footer.hidden = false;
    dialog.dataset.view = 'comparison';
    title.textContent = 'Audience Similarity';
    dismiss.setAttribute('aria-label', 'Close audience similarity');
    observeEdges();
    const trigger = triggerOrigin === 'row' ? rowEditButtons.get(triggerId) : cards.find(card => card.draft.id === triggerId)?.edit;
    trigger?.focus({ preventScroll: true });
  }

  function openEditor(draft, origin) {
    if (!dialog.open || editingDraft || draft.isSimilaritySource) return;
    const session = ++editorSession;
    // Hidden scroll containers may report zero, so remember the comparison position before editing.
    const comparisonScroll = { scrollLeft: pairs.scrollLeft, scrollTop: body.scrollTop };
    editingDraft = draft;
    editTriggerId = draft.id;
    editTriggerOrigin = origin;
    stopObservingEdges();
    body.hidden = true;
    footer.hidden = true;
    editorHost.hidden = false;
    dialog.dataset.view = 'editor';
    title.textContent = 'Edit Draft';
    dismiss.setAttribute('aria-label', 'Close draft editor');
    editor = createEditor({
      host: editorHost,
      onBack: showComparison,
      async onSave(target, patch) {
        if (!dialog.open || editingDraft !== target || editorSession !== session || pendingRecalculation) return false;
        const saved = await onSaveDraft(target, patch);
        if (saved === false) return false;
        // An asynchronous save may finish after the popup has closed.
        if (!dialog.open || editingDraft !== target || editorSession !== session) return true;
        Object.assign(target, patch);
        pendingRecalculation = {
          draftIds: cards.map(({ draft }) => draft.id),
          sourceDraft: drafts.find(draft => draft.isSimilaritySource) || null,
          editedDraft: target,
          referenceId: referenceDraft.id,
          focusDraftId: editTriggerId,
          focusOrigin: editTriggerOrigin,
          ...comparisonScroll,
        };
        // The Content panel starts its shared loading state only after the native close event cleans up.
        close();
        return true;
      },
    });
    editor.open(draft);
  }

  function renderResults() {
    rowEditButtons.clear();
    results.replaceChildren();
    if (!referenceDraft) return;
    const referenceTitle = referenceDraft.isSimilaritySource ? 'Source Draft' : text(referenceDraft.title) || 'Untitled story';
    const comparisons = drafts.filter(draft => draft !== referenceDraft && canCompare(referenceDraft, draft));
    if (comparisons.length) {
      const scroll = node('div', 'audience-similarity-table-scroll');
      scroll.setAttribute('role', 'region');
      scroll.setAttribute('aria-label', 'Comparison table');
      scroll.setAttribute('tabindex', '0');
      const table = node('table', 'audience-similarity-table');
      table.append(node('caption', 'audience-similarity-table-caption', `Draft similarities compared with ${referenceTitle}`));
      const metrics = [
        ['body', 'Body overlap'], ['headline', 'Headline'], ['opening', 'Opening'],
        ['quotes', 'Shared quotes'], ['structure', 'Structure'],
      ];
      const tableHead = node('thead');
      const headers = node('tr');
      for (const label of ['Compared with', 'Overall', ...metrics.map(([, label]) => label)]) {
        const cell = node('th', '', label);
        cell.setAttribute('scope', 'col');
        headers.append(cell);
      }
      tableHead.append(headers);
      const tableBody = node('tbody');
      for (const draft of comparisons) {
        const row = node('tr', 'audience-similarity-comparison');
        row.dataset.referenceId = referenceDraft.id;
        row.dataset.comparisonId = draft.id;
        const heading = node('th', 'audience-similarity-comparison-heading');
        heading.setAttribute('scope', 'row');
        heading.setAttribute('aria-label', `Comparison: ${referenceTitle} and ${draft.isSimilaritySource ? 'Source Draft' : text(draft.title) || 'Untitled story'}`);
        const label = node('div', 'audience-similarity-comparison-label');
        label.append(createAudienceLabel(draft, 'audience-similarity-comparison-audience'));
        if (!draft.isSimilaritySource) {
          const edit = createEditButton(draft, 'audience-similarity-row-edit', 'row');
          rowEditButtons.set(draft.id, edit);
          label.append(edit);
        }
        heading.append(label);
        row.append(heading);
        const comparison = compareAudienceDrafts(referenceDraft, draft);
        const verdict = comparison ? audienceSimilarityVerdict(comparison.metrics) : { score: null, label: 'Not available', band: null };
        const overall = node('td');
        const badge = node('span', 'audience-similarity-verdict', verdict.score === null ? '—' : `${verdict.score}%`);
        if (verdict.band) badge.dataset.band = verdict.band;
        const verdictLabel = verdict.score === null ? 'Similarity: Not available' : `Similarity: ${verdict.score}%. ${verdict.label}`;
        badge.setAttribute('aria-label', verdictLabel);
        badge.title = verdictLabel;
        overall.append(badge);
        row.append(overall);
        for (const [key, label] of metrics) {
          const metric = comparison?.metrics.find(metric => metric.key === key);
          const value = Number.isFinite(metric?.value) ? Math.max(0, Math.min(100, Math.round(metric.value))) : null;
          const cell = node('td');
          cell.dataset.metric = key;
          const score = node('span', 'audience-similarity-table-value', value === null ? '—' : `${value}%`);
          if (value !== null) score.dataset.band = similarityScoreBand(value);
          score.setAttribute('aria-label', `${label}: ${value === null ? 'Not available' : `${value}%`}`);
          cell.append(score);
          row.append(cell);
        }
        tableBody.append(row);
      }
      table.append(tableHead, tableBody);
      scroll.append(table);
      results.append(scroll);
    } else {
      results.append(node('p', 'audience-similarity-empty', 'No drafts available to compare.'));
    }
    status.textContent = `Comparing “${referenceTitle}” with ${comparisons.length} other ${comparisons.length === 1 ? 'draft' : 'drafts'}`;
  }

  function close() {
    if (dialog.open) dialog.close();
  }
  function handlePageHide() {
    pendingRecalculation = null;
    close();
  }
  view.addEventListener?.('pagehide', handlePageHide);
  dismiss.addEventListener('click', close);
  done.addEventListener('click', close);
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    const recalculation = pendingRecalculation;
    pendingRecalculation = null;
    const trigger = opener;
    opener = null;
    editorSession += 1;
    editor?.destroy();
    editor = null;
    editingDraft = null;
    editTriggerId = null;
    editTriggerOrigin = null;
    rowEditButtons.clear();
    editorHost.hidden = true;
    body.hidden = false;
    footer.hidden = false;
    title.textContent = 'Audience Similarity';
    dismiss.setAttribute('aria-label', 'Close audience similarity');
    dialog.dataset.view = 'comparison';
    stopObservingEdges();
    drafts = [];
    referenceDraft = null;
    allowedPairs.clear();
    cards = [];
    pairs.replaceChildren();
    results.replaceChildren();
    status.textContent = '';
    if (trigger?.isConnected && !trigger.disabled && !trigger.closest('[hidden], [inert]')) trigger.focus({ preventScroll: true });
    if (recalculation && !destroyed) onRecalculate(recalculation);
  });

  return {
    element: dialog,
    get isOpen() { return Boolean(dialog.open); },
    open({ groups: sourceGroups, sourceDraft = null, opener: trigger = doc.activeElement, referenceId = null, focusDraftId = null, focusOrigin = null, scrollLeft = 0, scrollTop = 0 } = {}) {
      if (destroyed || dialog.open || pendingRecalculation || !Array.isArray(sourceGroups)) return false;
      const valid = sourceGroups.filter(group => group && text(group.key) && text(group.label) && Array.isArray(group.drafts) && group.drafts.length > 1
        && group.drafts.every(draft => draft && !draft.isSimilaritySource && text(draft.id))
        && new Set(group.drafts.map(draft => draft.id)).size === group.drafts.length
        && group.drafts.slice(1).every(draft => compareAudienceDrafts(group.drafts[0], draft)));
      if (!valid.length) return false;
      closePanels();
      const byId = new Map();
      allowedPairs = new Map();
      for (const group of valid) {
        for (const draft of group.drafts) {
          if (!byId.has(draft.id)) byId.set(draft.id, draft);
          if (!allowedPairs.has(draft.id)) allowedPairs.set(draft.id, new Set());
          for (const other of group.drafts) {
            if (other.id !== draft.id) allowedPairs.get(draft.id).add(other.id);
          }
        }
      }
      drafts = [...byId.values()];
      if (sourceDraft?.isSimilaritySource && !byId.has(sourceDraft.id) && drafts.every(draft => compareAudienceDrafts(sourceDraft, draft))) {
        allowedPairs.set(sourceDraft.id, new Set(drafts.map(draft => draft.id)));
        for (const draft of drafts) allowedPairs.get(draft.id).add(sourceDraft.id);
        drafts.unshift(sourceDraft);
      }
      referenceDraft = drafts.find(draft => !draft.isSimilaritySource && draft.id === referenceId) || drafts.find(draft => !draft.isSimilaritySource);
      opener = trigger;
      renderPairs();
      renderResults();
      dialog.showModal();
      observeEdges();
      const focusTarget = focusOrigin === 'row' ? rowEditButtons.get(focusDraftId) : focusOrigin === 'card' ? cards.find(card => card.draft.id === focusDraftId)?.edit : null;
      (focusTarget || dismiss).focus({ preventScroll: true });
      pairs.scrollLeft = Number.isFinite(scrollLeft) ? Math.max(0, scrollLeft) : 0;
      body.scrollTop = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
      updateEdges();
      return true;
    },
    close,
    destroy() {
      if (destroyed) return;
      pendingRecalculation = null;
      destroyed = true;
      close();
      stopObservingEdges();
      view.removeEventListener?.('pagehide', handlePageHide);
      dialog.remove();
    },
  };
}
