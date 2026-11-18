import { createEditorTabs } from '../editor-tabs.js?v=20261117-whole-tabs';

// Share the production tab controller while keeping every draft in page-local memory.
export function mountEditorTabsSpecimen(root) {
  if (!root) return;
  const tabs = root.querySelector('[data-editor-tabs]');
  const panel = root.querySelector('[data-editor-tabs-panel]');
  const title = root.querySelector('[data-editor-tabs-title]');
  const copy = root.querySelector('[data-editor-tabs-copy]');
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
  const controller = createEditorTabs({
    root: tabs,
    panel,
    onSelect(id) {
      const output = project.outputs.find(output => output.id === id);
      if (!output) return;
      project.selectedOutputId = id;
      output.revisionRequestUnread ??= output.revisionUnread;
      output.revisionUnread = false;
      render();
    },
  });

  function render() {
    const output = project.outputs.find(output => output.id === project.selectedOutputId);
    title.textContent = output.title;
    copy.textContent = output.draftText;
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
