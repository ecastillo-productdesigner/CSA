const sampleHeadlines = [
  'A Surprise Studio Session Sparks a New Creative Chapter',
  'The Small-Town Café Behind an Unexpected Pop Culture Moment',
  'Inside a Creative Collaboration That Started With a Simple Idea',
  'An Unplanned Performance Turns an Ordinary Evening Into a Memorable Night',
  'A Fresh Perspective on the Stories Shaping the Week',
  'Behind the Scenes of a Weekend Project With a Big Impact',
  'How a Vintage Camera Inspired an Entirely New Creative Direction',
  'The Unexpected Connection Between Music, Community and a Neighborhood Café',
];

export function projectOutputs(project) {
  return Array.isArray(project?.outputs) ? project.outputs.filter(output => output && typeof output.id === 'string' && typeof output.title === 'string') : [];
}

export function sampleVariant(project, selections) {
  const used = new Set(projectOutputs(project).map(output => output.title));
  const available = sampleHeadlines.filter(title => !used.has(title));
  const choices = available.length ? available : sampleHeadlines;
  return {
    id: crypto.randomUUID(),
    title: choices[Math.floor(Math.random() * choices.length)],
    createdAt: Date.now(),
    labels: selections.map(({ key, label }) => ({ key, label })),
    toolPreferences: Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, selections.find(selection => selection.key === key)?.value || ''])),
    editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '',
    draftText: '',
    metadata: { author: '', tags: '' },
  };
}

export function renderOutputs(project) {
  const outputs = projectOutputs(project);
  const list = document.querySelector('#output-list');
  document.querySelector('#outputs-empty').hidden = outputs.length > 0;
  list.hidden = outputs.length === 0;
  list.replaceChildren(...outputs.map(output => {
    const item = document.createElement('li');
    const card = document.createElement('article');
    const selected = project.selectedOutputId === output.id;
    card.className = 'output-card';
    card.dataset.selected = String(selected);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'output-open';
    open.dataset.outputId = output.id;
    open.setAttribute('aria-label', `${selected ? 'Return to workspace from' : 'Open variant'}: ${output.title}`);
    open.setAttribute('aria-pressed', String(selected));
    open.title = selected ? 'Return to your workspace' : 'Open this variant in the editor';
    const top = document.createElement('span');
    top.className = 'output-card-top';
    const badges = document.createElement('span');
    badges.className = 'output-badges';
    const labels = Array.isArray(output.labels) ? output.labels : [];
    for (const label of labels) {
      if (!label || !['format', 'audience', 'voice'].includes(label.key) || typeof label.label !== 'string') continue;
      const badge = document.createElement('span');
      badge.className = `output-badge output-badge--${label.key}`;
      badge.textContent = label.label;
      badges.append(badge);
    }
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', '#icon-edit-output');
    icon.append(use);
    top.append(badges);
    const heading = document.createElement('strong');
    heading.className = 'output-card-title';
    heading.textContent = output.title;
    open.append(top, heading);
    const menuButton = document.createElement('button');
    menuButton.type = 'button';
    menuButton.className = 'output-menu-button';
    menuButton.dataset.outputMenu = output.id;
    menuButton.setAttribute('aria-label', `Variant options: ${output.title}`);
    menuButton.setAttribute('aria-haspopup', 'menu');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-controls', `output-menu-${output.id}`);
    menuButton.title = 'Variant options';
    menuButton.append(icon);
    const menu = document.createElement('div');
    menu.id = `output-menu-${output.id}`;
    menu.className = 'output-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Variant options');
    menu.hidden = true;
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'output-delete';
    remove.dataset.deleteOutput = output.id;
    remove.setAttribute('role', 'menuitem');
    remove.textContent = 'Delete';
    menu.append(remove);
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeOutputMenus(true); }
      else if (event.key === 'Tab') closeOutputMenus(true);
      else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); remove.focus(); }
    });
    card.append(open, menuButton, menu);
    item.append(card);
    return item;
  }));
}

export function closeOutputMenus(restoreFocus = false) {
  for (const button of document.querySelectorAll('[data-output-menu]')) {
    const wasOpen = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', 'false');
    document.getElementById(button.getAttribute('aria-controls')).hidden = true;
    if (restoreFocus && wasOpen) button.focus();
  }
}

export function toggleOutputMenu(button) {
  const open = button.getAttribute('aria-expanded') !== 'true';
  closeOutputMenus();
  if (!open) return;
  button.setAttribute('aria-expanded', 'true');
  const menu = document.getElementById(button.getAttribute('aria-controls'));
  menu.hidden = false;
  menu.querySelector('[role="menuitem"]').focus();
}

document.addEventListener('pointerdown', event => {
  if (!event.target.closest('.output-menu, .output-menu-button')) closeOutputMenus();
});
