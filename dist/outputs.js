import { createIcon } from './icons.js?v=20261022-toast-copy';
import { normalizeWordCount } from './variant-word-count.js?v=20261022-toast-copy';
import { countPreviewWords } from './content-preview.js?v=20261022-toast-copy';
import { createContentCardActions } from './content-card-editing.js?v=20261022-card-menu';
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

const sampleSubheads = [
  'An unexpected recording session brings local musicians together and opens the door to a new sound.',
  'A handwritten invitation turns a quiet café into a lively exchange of songs, memories, and neighborhood stories.',
  'Three artists turn an everyday object into a shared experiment in music, photography, and storytelling.',
  'A delayed film screening gives neighbors an impromptu concert and an idea for their next gathering.',
  'Small changes close to home offer a fresh view of the people and places shaping the week.',
  'Neighbors transform a neglected courtyard in a weekend and build connections that could last much longer.',
  'One roll of film helps a photographer slow down and discover new stories in familiar streets.',
  'A neighborhood listening session gives unfinished songs a patient audience and room to grow.',
];

export function sampleOutputShareText(title) {
  const index = sampleHeadlines.indexOf(title);
  if (index >= 0) return sampleSubheads[index];
  const topic = String(title || '').toLowerCase();
  if (/camera|photo/.test(topic)) return sampleSubheads[6];
  if (/café|cafe/.test(topic)) return sampleSubheads[1];
  if (/neighborhood|community|courtyard/.test(topic)) return sampleSubheads[5];
  if (/studio|music|song|performance/.test(topic)) return sampleSubheads[0];
  return 'A simple idea brings people together, sparks an unexpected collaboration, and points toward what comes next.';
}

export function initializeOutputShareText(output) {
  if (typeof output.shareText === 'string' && (output.shareText.trim() || output.shareTextEdited === true)) return false;
  output.shareText = sampleOutputShareText(output.title);
  return true;
}

export function projectOutputs(project) {
  return Array.isArray(project?.outputs) ? project.outputs.filter(output => output && typeof output.id === 'string' && typeof output.title === 'string') : [];
}

export function customVariantName(output) {
  const name = typeof output?.name === 'string' ? output.name.trim() : '';
  const edited = output?.nameEdited ?? Boolean(name && name !== output?.title);
  return edited ? name : '';
}

export function savedVariantName(output) {
  return customVariantName(output) || `Saved Variant ${output?.savedVariantNumber || 1}`;
}

export function initializeVariantNames(projects) {
  const outputs = projects.flatMap(projectOutputs);
  for (const output of outputs) {
    if (typeof output.nameEdited !== 'boolean') output.nameEdited = Boolean(customVariantName(output));
  }
  let next = outputs.reduce((max, output) => Number.isInteger(output.savedVariantNumber) && output.savedVariantNumber > max ? output.savedVariantNumber : max, 0) + 1;
  for (const output of outputs.filter(output => output.isFavorite).sort((a, b) => (a.favoritedAt || a.createdAt || 0) - (b.favoritedAt || b.createdAt || 0))) {
    if (!customVariantName(output) && !(Number.isInteger(output.savedVariantNumber) && output.savedVariantNumber > 0)) output.savedVariantNumber = next++;
  }
}

export function outputIsReady(output) {
  return output.status === 'ready' || (!output.status && Boolean(output.document || output.draftText));
}

export function outputIsSent(output) {
  return Number.isFinite(output?.cmsSentAt) && output.cmsSentAt > 0;
}

export function outputSourceCount(output) {
  if (Number.isInteger(output?.sourceCount) && output.sourceCount >= 0) return output.sourceCount;
  return new Set((Array.isArray(output?.selectedSourceIndexes) ? output.selectedSourceIndexes : []).filter(index => Number.isInteger(index) && index >= 0)).size;
}

export function outputWordCount(output) {
  const ops = output?.document?.ops;
  const text = Array.isArray(ops)
    ? ops.map(op => typeof op?.insert === 'string' ? op.insert : '').join('')
    : typeof output?.draftText === 'string' ? output.draftText : '';
  return countPreviewWords(text);
}

export function createOutputWordCountBadge(output) {
  if (!output || !outputIsReady(output) || output.needsRegeneration) return null;
  const count = outputWordCount(output);
  if (!count) return null;
  const label = `${count.toLocaleString('en-US')} ${count === 1 ? 'Word' : 'Words'}`;
  const badge = document.createElement('span');
  badge.className = 'output-badge output-badge--words';
  badge.textContent = label;
  badge.title = label;
  badge.setAttribute('aria-label', label);
  return badge;
}

export function createOutputBadges(output, { maxLabelLength = 20, includeSourceCount = true, includeWordCount = true } = {}) {
  const badges = (Array.isArray(output?.labels) ? output.labels : [])
    .filter(label => label && ['format', 'audience', 'voice'].includes(label.key) && typeof label.label === 'string')
    .map(label => {
      const badge = document.createElement('span');
      badge.className = `output-badge output-badge--${label.key}`;
      const characters = Array.from(label.label);
      badge.textContent = maxLabelLength && characters.length > maxLabelLength ? `${characters.slice(0, maxLabelLength - 1).join('').trimEnd()}…` : label.label;
      badge.title = label.label;
      badge.setAttribute('aria-label', label.label);
      return badge;
    });
  if (includeWordCount) {
    const words = createOutputWordCountBadge(output);
    if (words) badges.push(words);
  }
  if (output && includeSourceCount) {
    const count = outputSourceCount(output);
    const label = `${count} ${count === 1 ? 'source' : 'sources'}`;
    const badge = document.createElement('button');
    badge.type = 'button';
    badge.className = 'output-badge output-badge--sources';
    badge.dataset.variantSources = output.id;
    badge.setAttribute('aria-controls', 'editor-sources');
    badge.setAttribute('aria-expanded', 'false');
    badge.title = label;
    badge.setAttribute('aria-label', `View ${label} used for this variant`);
    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'folder_open';
    const text = document.createElement('span');
    text.textContent = label;
    badge.append(icon, text);
    badges.push(badge);
  }
  return badges;
}



export function selectedOutputs(project) {
  const legacyIds = [...(Array.isArray(project?.selectedPendingOutputIds) ? project.selectedPendingOutputIds : []), ...(project?.selectedOutputId ? [project.selectedOutputId] : [])];
  const selectedIds = new Set(Array.isArray(project?.selectedOutputIds) ? project.selectedOutputIds : legacyIds);
  return projectOutputs(project).filter(output => selectedIds.has(output.id));
}

export function selectedPendingOutputs(project) {
  return selectedOutputs(project).filter(output => !outputIsReady(output));
}

let badgeOverflowObserver;

function updateBadgeOverflow(badges) {
  const overflows = badges.scrollWidth > badges.clientWidth + 1;
  badges.dataset.fadeStart = String(overflows && badges.scrollLeft > 1);
  badges.dataset.fadeEnd = String(overflows && badges.scrollLeft + badges.clientWidth < badges.scrollWidth - 1);
  badges.tabIndex = overflows ? 0 : -1;
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

const extraStoryParagraphs = [
  [
    'The following afternoon, they listened to the recording on ordinary speakers instead of the studio monitors. The simpler setup helped them hear which moments carried the melody and which ideas needed a little more room.',
    'Each musician brought one new suggestion to the next rehearsal. They tried a quieter introduction, changed the order of two verses, and agreed that the first version’s relaxed tempo should remain.',
    'A short rehearsal recording became a useful reference for the group. It captured the decisions they wanted to keep without turning a spontaneous experiment into a rigid plan.',
  ],
  [
    'The illustrator placed a blank card beside every drawing so that customers could add their own interpretation. Some wrote a sentence, while others sketched a small scene inspired by the music.',
    'The owner gathered the recommendations into a shared listening list for the café. Familiar favorites sat beside songs that several regulars were hearing for the first time.',
    'For the next exchange, the team plans to leave space for stories from visitors who are just passing through. The collection is becoming a portrait of the town seen from many different tables.',
  ],
  [
    'During an early preview, visitors began describing memories of their own umbrellas and rainy walks. Those conversations became a fourth layer of the installation, recorded on cards beside the original pieces.',
    'The collaborators rearranged the display so that people could enter through an image, a sound, or a paragraph. There was no required order, and each route offered a slightly different experience.',
    'A small booklet now brings the separate contributions together. It includes a few unfinished sketches and notes, allowing readers to see how the idea changed as it passed between the three participants.',
  ],
  [
    'The organizers collected suggestions before the audience left the courtyard. Several people offered to bring instruments, and others volunteered to arrange chairs or help with a small sound system.',
    'They agreed that a future gathering should keep the same informal atmosphere. A short open invitation and a few familiar songs would give first-time performers an easy way to take part.',
    'The film screening still finished as planned, but the conversations afterward kept returning to the unexpected opening act. People who had arrived separately left discussing a project they could shape together.',
  ],
  [
    'Before publication, the team returned to each person in the collection to check names, dates, and context. A small correction to one account helped make the relationship between the stories clearer.',
    'The designers gave each contribution enough space to stand on its own. A simple map and a few short captions helped readers connect the locations without interrupting the individual voices.',
    'The editors also invited readers to suggest a change they had noticed on their own street. Those responses will provide starting points for the next meeting and keep the series grounded in everyday experience.',
  ],
  [
    'As the work progressed, volunteers kept a simple list of what the courtyard would need next. Watering the planters and checking the repaired bench became small tasks that neighbors could share.',
    'A few residents returned in the evening to try the space after the tools had been put away. Their suggestions led to a clearer path between the planters and a more comfortable arrangement of the seating.',
    'Photographs from the two workdays will be displayed on the community noticeboard. The organizers hope they will help new volunteers understand both the changes already made and the work still to come.',
  ],
  [
    'On the next walk, the photographer returned to the same route at a different time of day. The familiar subjects looked noticeably different, suggesting that a limited setting could still offer plenty to explore.',
    'Notes in a small notebook recorded the light, location, and reason for each frame. Comparing those observations with the developed photographs helped turn unexpected results into useful lessons.',
    'A few prints now sit together on a studio wall, arranged by mood instead of date. The sequence has become a starting point for a larger project about the details that make ordinary places feel personal.',
  ],
  [
    'The owner moved a few tables closer together and left the rest of the café open for its usual visitors. The arrangement let people listen for a song or stay for the whole afternoon without feeling committed to a formal event.',
    'Performers began keeping notes on the ideas they wanted to revisit. One unfinished chorus gained a new rhythm, while another song found a clearer opening after a conversation with a listener.',
    'For the next session, the café will invite a different group of local musicians and keep a few places for returning performers. The changing mix should leave room for new voices while allowing existing ideas to develop.',
  ],
];

export function populateOutputContent(output) {
  const initializedShareText = initializeOutputShareText(output);
  if (output.contentVersion === 3) return initializedShareText;
  const ops = Array.isArray(output.document?.ops) ? output.document.ops : [];
  const hasRichText = ops.some(op => op && (typeof op.insert === 'string' ? op.insert.trim() : op.insert));
  const current = hasRichText ? ops.map(op => typeof op?.insert === 'string' ? op.insert : '\ufffc').join('') : output.draftText || '';
  const normalized = text => text.replace(/\s+/g, ' ').trim();
  const hasFormatting = ops.some(op => op && ((op.attributes && Object.keys(op.attributes).length) || (op.insert && typeof op.insert !== 'string')));
  const index = sampleHeadlines.indexOf(output.title);
  const untouchedLegacy = !hasFormatting && normalized(current) === normalized(legacySampleContent(output.title));
  const untouchedSample = !hasFormatting && index >= 0 && normalized(current) === normalized(storyParagraphs[index].join('\n\n'));
  if ((!current.trim() && !output.contentInitialized) || untouchedLegacy || untouchedSample) {
    const opening = index >= 0 ? storyParagraphs[index] : [
      `The story behind “${output.title}” begins with a small idea and an unexpected opportunity to explore it. A group of collaborators brings different perspectives to a project that continues to evolve as they work.`,
      ...storyParagraphs[2].slice(1),
    ];
    const paragraphs = [...opening.slice(0, -1), ...extraStoryParagraphs[index >= 0 ? index : 2], opening.at(-1)];
    output.draftText = paragraphs.join('\n\n');
    output.document = { ops: paragraphs.map(paragraph => ({ insert: `${paragraph}\n` })) };
  }
  output.contentInitialized = true;
  output.contentVersion = 3;
  return true;
}

export function reviseSampleOutput(output, instructions, requestedAt, completedAt = Date.now()) {
  initializeOutputShareText(output);
  const normalize = text => text.replace(/\s+/g, ' ').trim();
  const current = normalize(output.draftText || '');
  const samples = storyParagraphs.map((opening, index) => [...opening.slice(0, -1), ...extraStoryParagraphs[index], opening.at(-1)]);
  const choices = samples.filter(paragraphs => normalize(paragraphs.join('\n\n')) !== current);
  const paragraphs = choices[Math.floor(Math.random() * choices.length)];
  output.draftText = paragraphs.join('\n\n');
  output.document = { ops: paragraphs.map(paragraph => ({ insert: `${paragraph}\n` })) };
  output.contentInitialized = true;
  output.contentVersion = 3;
  output.updatedAt = completedAt;
  output.status = 'ready';
  delete output.needsRegeneration;
  delete output.cmsSentAt;
  delete output.cmsSentContent;
  output.revisionRequests = [...(Array.isArray(output.revisionRequests) ? output.revisionRequests : []), {
    instructions, requestedAt, completedAt, status: 'complete',
  }];
}

export function sampleVariant(project, selections) {
  const used = new Set(projectOutputs(project).map(output => output.title));
  const available = sampleHeadlines.filter(title => !used.has(title));
  const choices = available.length ? available : sampleHeadlines;
  const selectedSourceIndexes = (project.sources || []).flatMap((source, index) => source.selected !== false ? [index] : []);
  const title = choices[Math.floor(Math.random() * choices.length)];
  return {
    id: crypto.randomUUID(),
    name: '',
    nameEdited: false,
    title,
    createdAt: Date.now(),
    status: 'pending',
    labels: selections.map(({ key, label }) => ({ key, label })),
    toolPreferences: Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, selections.find(selection => selection.key === key)?.value || ''])),
    selectedSourceIndexes,
    sourceCount: selectedSourceIndexes.length,
    sourceSnapshots: selectedSourceIndexes.map(index => structuredClone(project.sources[index])),
    editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '',
    targetWordCount: normalizeWordCount(project.targetWordCount),
    draftText: '',
    shareText: sampleOutputShareText(title),
    shareTextEdited: false,
    metadata: { author: '', tags: '' },
  };
}

export function variantPanelState(project, requestedView) {
  const outputs = projectOutputs(project);
  const pending = outputs.filter(output => !outputIsReady(output));
  const created = outputs.filter(outputIsReady);
  const activeCreated = !project?.viewOriginalDraft && created.some(output => output.id === project?.selectedOutputId);
  const view = ['pending', 'created'].includes(requestedView) ? requestedView : activeCreated || (!pending.length && created.length) ? 'created' : 'pending';
  return {
    view,
    outputs: view === 'pending' ? pending : created,
    pendingLabel: pending.length ? `${pending.length} Content to Draft` : 'To Draft',
    createdLabel: 'Drafted',
  };
}

export function renderOutputs(project, requestedView) {
  const state = variantPanelState(project, requestedView);
  for (const tab of document.querySelectorAll('[data-output-view]')) {
    const selected = tab.dataset.outputView === state.view;
    tab.textContent = tab.dataset.outputView === 'pending' ? state.pendingLabel : state.createdLabel;
    tab.dataset.empty = String(tab.dataset.outputView === 'pending' ? state.pendingLabel === 'To Draft' : !projectOutputs(project).some(outputIsReady));
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }
  document.querySelector('#output-status-content').setAttribute('aria-labelledby', `output-${state.view}-tab`);
  document.querySelector('.outputs-footer').hidden = state.view !== 'pending';
  const processing = Boolean(project?.outputProcessing);
  const selectedPending = selectedPendingOutputs(project);
  const selectedIds = new Set(selectedOutputs(project).map(output => output.id));
  const list = document.querySelector('#output-list');
  document.querySelector('.composer-outputs').setAttribute('aria-busy', String(processing));
  const create = document.querySelector('#create-output');
  create.disabled = processing || !selectedPending.length;
  create.title = processing ? 'Drafting Selected Content' : selectedPending.length ? 'Draft Selected Content' : 'Select Content to Draft';
  document.querySelector('#create-output-label').textContent = 'Draft';
  document.querySelector('#output-processing-status').textContent = project?.outputProcessing?.kind === 'revision' ? 'Revising your variant. This takes about four seconds.' : processing ? 'Drafting your selected content. This takes about four seconds.' : `${selectedPending.length} pending variant${selectedPending.length === 1 ? '' : 's'} selected.`;
  const empty = document.querySelector('#outputs-empty');
  empty.hidden = state.outputs.length > 0;
  empty.querySelector('p').textContent = state.view === 'pending' ? 'Your drafted content will appear here.' : 'No drafted content yet.';
  list.hidden = state.outputs.length === 0;
  list.setAttribute('aria-label', state.view === 'pending' ? 'Content to Draft' : 'Drafted Content');
  list.replaceChildren(...state.outputs.map(output => {
    const item = document.createElement('li');
    const card = document.createElement('article');
    const ready = outputIsReady(output);
    const revising = Boolean(project?.outputProcessing?.ids.includes(output.id));
    const active = Boolean(((ready || output.needsRegeneration) && project.selectedOutputId === output.id)
      || (project.viewOriginalDraft && !ready && project.lastPendingOutputId === output.id && selectedIds.has(output.id)));
    const selected = ready ? active : selectedIds.has(output.id);
    card.className = 'output-card';
    card.dataset.selected = String(selected);
    card.dataset.active = String(active);
    card.dataset.ready = String(ready);
    card.dataset.revising = String(revising);
    if (revising) card.setAttribute('aria-busy', 'true');
    if (!ready) {
      const border = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      border.classList.add('output-card-dash');
      border.setAttribute('aria-hidden', 'true');
      border.setAttribute('focusable', 'false');
      const outline = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      outline.setAttribute('x', '.5');
      outline.setAttribute('y', '.5');
      outline.setAttribute('rx', '7.5');
      border.append(outline);
      card.append(border);
    }
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'output-open';
    open.dataset.outputId = output.id;
    open.disabled = revising || (!ready && processing);
    open.setAttribute('aria-label', `${!ready ? 'Select variant' : 'Open variant'}: ${output.title}`);
    if (active) open.setAttribute('aria-current', 'true');
    open.title = !ready ? 'Select this variant to create' : active ? 'This variant is open in the editor' : 'Open this variant in the editor';
    const top = document.createElement('span');
    top.className = 'output-card-top';
    const badges = document.createElement('span');
    badges.className = 'output-badges';
    badges.setAttribute('role', 'group');
    badges.setAttribute('aria-label', 'Variant settings');
    badges.addEventListener('scroll', () => updateBadgeOverflow(badges), { passive: true });
    let drag = null;
    badges.addEventListener('pointerdown', event => {
      if (event.target.closest('[data-variant-sources]')) return;
      if (event.pointerType !== 'mouse' || event.button !== 0 || badges.scrollWidth <= badges.clientWidth + 1) return;
      drag = { pointerId: event.pointerId, x: event.clientX, scrollLeft: badges.scrollLeft };
      badges.setPointerCapture(event.pointerId);
      badges.dataset.dragging = 'true';
      badges.focus({ preventScroll: true });
      event.preventDefault();
    });
    badges.addEventListener('pointermove', event => {
      if (drag?.pointerId === event.pointerId) badges.scrollLeft = drag.scrollLeft + drag.x - event.clientX;
    });
    for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) badges.addEventListener(eventName, () => {
      drag = null;
      delete badges.dataset.dragging;
    });
    badges.append(...createOutputBadges(output, { includeSourceCount: false, includeWordCount: false }));
    const heading = document.createElement('strong');
    heading.className = 'output-card-title';
    heading.textContent = output.title;
    heading.title = output.title;
    open.append(top, heading);
    card.append(open);
    if (!ready) {
      const selection = document.createElement('button');
      selection.type = 'button';
      selection.className = 'output-selection-button';
      selection.dataset.selectOutput = output.id;
      selection.disabled = processing;
      selection.setAttribute('role', 'checkbox');
      selection.setAttribute('aria-label', `${selected ? 'Deselect' : 'Select'} variant: ${output.title}`);
      selection.setAttribute('aria-checked', String(selected));
      const indicator = document.createElement('span');
      indicator.className = 'output-selection-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      selection.append(indicator);
      card.append(selection);
    }
    badges.inert = revising;
    card.append(badges);
    if (revising) {
      const overlay = document.createElement('div');
      overlay.className = 'output-revision-overlay';
      overlay.setAttribute('role', 'status');
      const spinner = document.createElement('span');
      spinner.className = 'output-processing-spinner revision-spinner';
      spinner.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'output-creating-label';
      label.textContent = 'Drafting…';
      overlay.append(spinner, label);
      card.append(overlay);
    }
    card.append(createContentCardActions(output, { disabled: processing }));
    item.append(card);
    return item;
  }));
  badgeOverflowObserver?.disconnect();
  badgeOverflowObserver ||= new ResizeObserver(entries => {
    for (const entry of entries) updateBadgeOverflow(entry.target.closest('.output-badges'));
  });
  for (const badges of list.querySelectorAll('.output-badges')) {
    updateBadgeOverflow(badges);
    badgeOverflowObserver.observe(badges);
    for (const badge of badges.children) badgeOverflowObserver.observe(badge);
  }
}
