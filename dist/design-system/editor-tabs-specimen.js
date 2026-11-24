import { createEditorTabs } from '../editor-tabs.js?v=20261124-closable-tabs';

import { reopenEditorOutput, closeEditorOutput } from '../editor-tab-state.js?v=20261124-closable-tabs';

// Share the production tab controller while keeping every draft in page-local memory.
export function mountEditorTabsSpecimen(root) {
  if (!root) return;
  const tabs = root.querySelector('[data-editor-tabs]');
  const panel = root.querySelector('[data-editor-tabs-panel]');
  const title = root.querySelector('[data-editor-tabs-title]');
  const copy = root.querySelector('[data-editor-tabs-copy]');
  const drafted = root.querySelector('[data-editor-tabs-drafted]');
  const announcement = root.querySelector('[data-editor-tabs-status]');
  const project = {
    id: 'ds-whole-tabs-project',
    selectedOutputId: 'ds-whole-tabs-studio',
    outputs: [
      {
        id: 'ds-whole-tabs-studio', status: 'ready',
        title: 'A Surprise Studio Session Sparks a New Creative Chapter',
        draftText: 'Local musicians share unfinished ideas during a studio session. An unexpected collaboration helps them find a new direction for their next recording.',
      },
      {
        id: 'ds-whole-tabs-cafe', status: 'ready', cmsSentAt: 1794916800000,
        title: 'A Neighborhood Café',
        draftText: 'A neighborhood café opens its doors for an evening of music and conversation. Residents share stories about the places and people that bring them together.',
      },
      {
        id: 'ds-whole-tabs-camera', status: 'ready', revisionUnread: true,
        title: 'How a Vintage Camera Inspired an Entirely New Creative Direction',
        draftText: 'A photographer revisits familiar streets with a vintage camera. Working with one roll of film creates room to notice details that usually pass by.',
      },
      {
        id: 'ds-whole-tabs-weekend', status: 'ready',
        title: 'The Weekend Project',
        draftText: 'Neighbors spend a weekend restoring a shared courtyard. Their plans bring together planting, seating, and regular volunteer sessions.',
      },
      {
        id: 'ds-whole-tabs-community', status: 'ready', cmsSentAt: 1794916800000,
        title: 'The Unexpected Connection Between Music, Community and a Neighborhood Café',
        draftText: 'An informal listening session gives local musicians a place to try new songs. The gathering offers a fresh way for neighbors to connect.',
      },
    ],
  };
  const cards = new Map();
  for (const output of project.outputs) {
    const item = document.createElement('li');
    const card = document.createElement('article');
    card.className = 'output-card';
    card.dataset.ready = 'true';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'output-open';
    button.title = output.title;
    const label = document.createElement('strong');
    label.className = 'output-card-title';
    label.textContent = output.title;
    button.append(label);
    button.addEventListener('click', () => {
      select(output.id);
      announcement.textContent = 'Draft tab opened';
    });
    card.append(button);
    item.append(card);
    drafted.append(item);
    cards.set(output.id, { card, button });
  }

  function select(id) {
    const output = project.outputs.find(output => output.id === id);
    if (!output) return;
    reopenEditorOutput(project, id);
    project.selectedOutputId = id;
    output.revisionRequestUnread ??= output.revisionUnread;
    output.revisionUnread = false;
    render();
  }

  const controller = createEditorTabs({
    root: tabs,
    panel,
    onSelect: select,
    onClose(id) {
      closeEditorOutput(project, id);
      render();
      announcement.textContent = 'Tab closed. The draft remains in Drafted.';
      if (!project.selectedOutputId) cards.get(id)?.button.focus({ preventScroll: true });
    },
  });

  function render() {
    const output = project.outputs.find(output => output.id === project.selectedOutputId);
    title.hidden = !output;
    title.textContent = output?.title || '';
    copy.classList.toggle('project-welcome', !output);
    panel.classList.toggle('ds-editor-tabs-empty', !output);
    copy.textContent = output?.draftText || 'No open drafts. Select a card in Drafted to reopen one.';
    for (const draft of project.outputs) {
      const { card, button } = cards.get(draft.id);
      const selected = draft.id === project.selectedOutputId;
      card.dataset.selected = String(selected);
      button.setAttribute('aria-pressed', String(selected));
      button.setAttribute('aria-label', `Open draft: ${draft.title}`);
    }
    controller.render(project);
  }

  for (const button of root.querySelectorAll('[data-editor-tabs-width]')) {
    button.addEventListener('click', () => {
      root.dataset.width = button.dataset.editorTabsWidth;
      for (const choice of root.querySelectorAll('[data-editor-tabs-width]')) {
        choice.setAttribute('aria-pressed', String(choice === button));
      }
    });
  }
  render();
  window.addEventListener('pagehide', () => controller.destroy(), { once: true });
}
