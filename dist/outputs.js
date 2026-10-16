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

function legacySampleContent(heading) {
    const title = heading.toLowerCase();
    const opening = /camera|photo/.test(title)
      ? 'A vintage camera became the starting point for an unexpected creative project. What first appeared to be an interesting object soon encouraged its owner to slow down, look more closely at familiar places, and capture everyday moments from a different perspective.'
      : /café|cafe|neighborhood|community/.test(title)
        ? 'An ordinary afternoon at a neighborhood café became an unexpected meeting of ideas. A casual conversation between a musician and a local artist led to a small collaborative project, bringing together people who might not otherwise have crossed paths.'
        : /studio|performance|music/.test(title)
          ? 'A spontaneous session brought a small group of musicians together with no fixed plan beyond trying something new. As one idea led to another, an informal gathering developed into a creative project shaped by the people, sounds, and stories in the room.'
          : 'The collaboration began with a simple conversation and a shared interest in making something new. People with different experiences brought their own ideas to the project, turning a casual exchange into an opportunity to explore a fresh creative direction.';
    return [
      opening,
      'The first steps were deliberately small. The group tested a few ideas, shared early versions, and paid attention to the details that felt most meaningful. Rather than working toward a polished result immediately, they gave themselves room to experiment and discover what the project could become.',
      'That approach made collaboration an essential part of the process. Each person contributed a different perspective, helping the team connect individual ideas into a more complete story. Some suggestions changed along the way, while others became the foundation for the next stage of the work.',
      'By the end of the project, the most memorable result was the connection it created between the people involved. Their experience offers a reminder that a compelling creative idea does not always require a large production. Sometimes it begins with curiosity, a familiar setting, and a willingness to see what happens next.',
    ].join('\n\n');
}

const storyParagraphs = [
  [
    'The studio was supposed to be quiet for the evening when a singer stopped by to collect a forgotten notebook. A guitarist was still rehearsing nearby, and a few improvised notes quickly turned into an unexpected recording session.',
    'With no producer directing the room, the musicians traded ideas freely. A spare keyboard, a hand drum, and an old microphone gave the recording a warmer sound than either had originally imagined.',
    'They decided to keep the small imperfections in the first take. A laugh between verses and the sound of a chair moving became part of the track, preserving the spontaneous mood of the evening.',
    'By midnight, the group had the outline of a new song and plans to meet again. The session opened a creative direction that none of them had brought into the studio that morning.',
  ],
  [
    'A small-town café found itself at the center of a surprising conversation after a handwritten sign in its window caught a visitor’s attention. The sign invited customers to exchange a favorite song for a cup of coffee.',
    'The owner had created the idea to make a quiet afternoon feel more welcoming. Within hours, the café’s noticeboard was covered with song titles, brief memories, and recommendations from people passing through town.',
    'A local illustrator began turning a few of those memories into drawings. Customers recognized pieces of their own lives in the sketches and returned with friends to add another story to the wall.',
    'The café plans to keep the exchange going each month. What started as a modest gesture has given the neighborhood a new place to share its interests and discover unexpected connections.',
  ],
  [
    'The collaboration started with a question at a community workshop: could a single everyday object inspire a piece of music, a photograph, and a short story? Three participants decided to test the idea together.',
    'They chose a well-used blue umbrella and spent a week observing where it traveled. The photographer followed its changing surroundings, the musician collected sounds of rain, and the writer imagined the people who might have carried it.',
    'When they reunited, the separate pieces revealed details each person had missed. They combined the photographs, recordings, and writing into a small installation that visitors could explore at their own pace.',
    'The finished work kept the original question open rather than offering one explanation. For the collaborators, that shared curiosity became the most valuable result of an idea that had initially seemed almost too simple.',
  ],
  [
    'An outdoor film screening took an unexpected turn when a brief technical delay left the audience waiting in a courtyard. A musician seated near the back offered to fill the silence with a song.',
    'Someone brought over a guitar, and the first few listeners began singing along. The gathering soon became an informal performance, with neighbors suggesting familiar songs and keeping time on the edges of their chairs.',
    'By the time the projector was ready, nobody seemed eager to interrupt the music. The organizers let the impromptu set finish before starting the film, adding an unplanned chapter to the evening.',
    'The next morning, volunteers were already discussing a separate neighborhood music night. A frustrating pause had become the part of the event that people remembered most clearly.',
  ],
  [
    'A weekly editorial meeting began with an unusual challenge: choose one story that readers might have overlooked. The team set aside the biggest headlines and looked instead at smaller changes happening close to home.',
    'Their notes included a reopened community garden, a new evening class, and a volunteer who had quietly repaired a neighborhood reading box. Taken together, those details suggested a different way to understand the week.',
    'The editors organized the coverage around the people affected by each change. Short interviews and carefully chosen photographs helped connect individual experiences without flattening them into a single narrative.',
    'The resulting collection offered readers a broader view of familiar places. The exercise reminded the team that perspective often comes from asking a more precise question, rather than simply adding more information.',
  ],
  [
    'A weekend project to repaint a neglected courtyard grew into something larger when volunteers arrived with extra plants, borrowed tools, and ideas of their own. The original plan quickly became a shared effort.',
    'One group repaired a bench while another prepared a wall for a small mural. Neighbors who had never worked together began trading practical advice, dividing tasks according to the skills each person brought.',
    'By Sunday afternoon, the courtyard had fresh color, a place to sit, and a collection of donated planters. Just as useful was the contact list volunteers created to help maintain the space.',
    'The organizers hope to return for another workday next month. The visible improvements were completed in a weekend, but the relationships formed around them could support the neighborhood for much longer.',
  ],
  [
    'A photographer found a vintage film camera at a secondhand shop and decided to use one roll of film to document an ordinary walk. With only a limited number of frames, every photograph required a more deliberate choice.',
    'Familiar streets began to reveal details that were easy to overlook with a phone in hand. Reflections in a bakery window, a fading painted sign, and the changing afternoon light became subjects in their own right.',
    'Waiting for the developed photographs added another surprise to the process. A few frames were imperfect, but their unexpected shadows and soft focus suggested a new visual style worth exploring.',
    'The photographer now plans a small series built around the same slow approach. The old camera has become less of a collectible and more of a reason to pay attention to everyday surroundings.',
  ],
  [
    'A neighborhood café invited local musicians to share unfinished songs during its quietest afternoon hours. The owner hoped a small listening session could connect performers with people who rarely attended formal concerts.',
    'The first gathering brought together guitar players, a retired choir director, and customers who simply wanted to listen. Between songs, the musicians explained where an idea had begun and which parts they were still trying to solve.',
    'Audience suggestions became part of the conversation rather than a review of the performance. A recalled melody or a story about the neighborhood sometimes gave a musician the missing detail needed to continue a song.',
    'The café is making room for the sessions on its monthly calendar. Music has given the space a new rhythm, while the community has given the performers something equally useful: a patient audience willing to join the process.',
  ],
];

export function populateOutputContent(output) {
  if (output.contentVersion === 2) return false;
  const ops = Array.isArray(output.document?.ops) ? output.document.ops : [];
  const hasRichText = ops.some(op => op && (typeof op.insert === 'string' ? op.insert.trim() : op.insert));
  const current = hasRichText ? ops.map(op => typeof op?.insert === 'string' ? op.insert : '\ufffc').join('') : output.draftText || '';
  const normalized = text => text.replace(/\s+/g, ' ').trim();
  const hasFormatting = ops.some(op => op && ((op.attributes && Object.keys(op.attributes).length) || (op.insert && typeof op.insert !== 'string')));
  const untouchedLegacy = !hasFormatting && normalized(current) === normalized(legacySampleContent(output.title));
  if ((!current.trim() && !output.contentInitialized) || untouchedLegacy) {
    const index = sampleHeadlines.indexOf(output.title);
    const paragraphs = index >= 0 ? storyParagraphs[index] : [
      `The story behind “${output.title}” begins with a small idea and an unexpected opportunity to explore it. A group of collaborators brings different perspectives to a project that continues to evolve as they work.`,
      ...storyParagraphs[2].slice(1),
    ];
    output.draftText = paragraphs.join('\n\n');
    delete output.document;
  }
  output.contentInitialized = true;
  output.contentVersion = 2;
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
