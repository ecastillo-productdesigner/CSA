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

export function outputIsReady(output) {
  return output.status === 'ready' || (!output.status && Boolean(output.document || output.draftText));
}

export function populateOutputContent(output) {
  if (output.contentInitialized) return false;
  const hasRichText = Array.isArray(output.document?.ops) && output.document.ops.some(op => typeof op.insert === 'string' ? op.insert.trim() : op.insert);
  if (!hasRichText && !(typeof output.draftText === 'string' && output.draftText.trim())) {
    const title = output.title.toLowerCase();
    const opening = /camera|photo/.test(title)
      ? 'A vintage camera became the starting point for an unexpected creative project. What first appeared to be an interesting object soon encouraged its owner to slow down, look more closely at familiar places, and capture everyday moments from a different perspective.'
      : /café|cafe|neighborhood|community/.test(title)
        ? 'An ordinary afternoon at a neighborhood café became an unexpected meeting of ideas. A casual conversation between a musician and a local artist led to a small collaborative project, bringing together people who might not otherwise have crossed paths.'
        : /studio|performance|music/.test(title)
          ? 'A spontaneous session brought a small group of musicians together with no fixed plan beyond trying something new. As one idea led to another, an informal gathering developed into a creative project shaped by the people, sounds, and stories in the room.'
          : 'The collaboration began with a simple conversation and a shared interest in making something new. People with different experiences brought their own ideas to the project, turning a casual exchange into an opportunity to explore a fresh creative direction.';
    output.draftText = [
      opening,
      'The first steps were deliberately small. The group tested a few ideas, shared early versions, and paid attention to the details that felt most meaningful. Rather than working toward a polished result immediately, they gave themselves room to experiment and discover what the project could become.',
      'That approach made collaboration an essential part of the process. Each person contributed a different perspective, helping the team connect individual ideas into a more complete story. Some suggestions changed along the way, while others became the foundation for the next stage of the work.',
      'By the end of the project, the most memorable result was the connection it created between the people involved. Their experience offers a reminder that a compelling creative idea does not always require a large production. Sometimes it begins with curiosity, a familiar setting, and a willingness to see what happens next.',
    ].join('\n\n');
    delete output.document;
  }
  output.contentInitialized = true;
  return true;
}

export function sampleVariant(project, selections) {
  const used = new Set(projectOutputs(project).map(output => output.title));
  const available = sampleHeadlines.filter(title => !used.has(title));
  const choices = available.length ? available : sampleHeadlines;
  return {
    id: crypto.randomUUID(),
    title: choices[Math.floor(Math.random() * choices.length)],
    createdAt: Date.now(),
    status: 'pending',
    labels: selections.map(({ key, label }) => ({ key, label })),
    toolPreferences: Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, selections.find(selection => selection.key === key)?.value || ''])),
    editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '',
    draftText: '',
    metadata: { author: '', tags: '' },
  };
}

export function renderOutputs(project) {
  const outputs = projectOutputs(project);
  const processing = Boolean(project?.outputProcessing);
  const pending = outputs.some(output => !outputIsReady(output));
  const list = document.querySelector('#output-list');
  document.querySelector('.composer-outputs').setAttribute('aria-busy', String(processing));
  document.querySelector('#create-output').disabled = processing || !pending;
  document.querySelector('#create-output-label').textContent = processing ? 'Processing…' : 'Create Output';
  document.querySelector('#output-processing-spinner').hidden = !processing;
  document.querySelector('#output-processing-status').textContent = processing ? 'Processing your output. This takes about four seconds.' : '';
  document.querySelector('#outputs-empty').hidden = outputs.length > 0;
  list.hidden = outputs.length === 0;
  list.replaceChildren(...outputs.map(output => {
    const item = document.createElement('li');
    const card = document.createElement('article');
    const ready = outputIsReady(output);
    const selected = ready && project.selectedOutputId === output.id;
    card.className = 'output-card';
    card.dataset.selected = String(selected);
    card.dataset.ready = String(ready);
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'output-open';
    open.dataset.outputId = output.id;
    open.disabled = !ready;
    open.setAttribute('aria-label', `${!ready ? 'Pending variant' : selected ? 'Return to workspace from' : 'Open variant'}: ${output.title}`);
    open.setAttribute('aria-pressed', String(selected));
    open.title = !ready ? 'Choose Create Output to prepare this variant' : selected ? 'Return to your workspace' : 'Open this variant in the editor';
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
