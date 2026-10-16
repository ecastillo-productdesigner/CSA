import { createSearchExperience } from './search.js?v=20261016-add-source';
import { createDashboard } from './dashboard.js?v=20261016-drawers-metadata';
import { createRecentProjects } from './recent-projects.js?v=20261016-project-actions';
import { createMaterialEditor } from './editor.js?v=20261016-drawers-metadata';
import { saveDocuments, downloadDocument } from './documents.js?v=20261016-document-upload';
import { createToolDropdowns } from './tool-dropdowns.js?v=20261016-content-feedback';
import { createRailNavigation } from './navigation.js?v=20261016-drawers-metadata';
import { createProjectSources } from './sources.js?v=20261016-sidebar-sources';
import { projectOutputs, sampleVariant, outputIsReady, selectedOutputs, selectedPendingOutputs, populateOutputContent, renderOutputs as renderProjectOutputs } from './outputs.js?v=20261016-drawers-metadata';
import { createOutputPresets } from './output-presets.js?v=20261016-drawers-metadata';

const $ = (selector) => document.querySelector(selector);
const storageKey = 'csa.projects.v1';
const acceptedExtensions = new Set(['pdf', 'docx', 'pptx', 'txt', 'md']);
const sampleStories = [
  {
    id: 'demo-taylor-swift',
    title: 'Taylor Swift Turns a Quiet Café into a Surprise Concert',
    text: 'In this imagined story, Taylor Swift stops for coffee and ends up borrowing a guitar for an impromptu set. The café owner names a cinnamon latte after the unexpected afternoon.',
  },
  {
    id: 'demo-zendaya',
    title: 'Zendaya Reveals Her Secret Collection of Vintage Cameras',
    text: 'In this imagined story, Zendaya opens a small photography exhibition filled with pictures taken on vintage cameras. Every guest leaves with a disposable camera and a challenge to capture something ordinary.',
  },
  {
    id: 'demo-pedro-pascal',
    title: 'Pedro Pascal Hosts a Rooftop Movie Night for His Neighbors',
    text: 'In this imagined story, Pedro Pascal turns a rooftop into an outdoor cinema, complete with mismatched chairs and homemade popcorn. His neighbors vote for a classic comedy and stay for a second screening.',
  },
  {
    id: 'demo-selena-gomez',
    title: 'Selena Gomez Opens a Pop-Up Bakery for One Weekend',
    text: 'In this imagined story, Selena Gomez spends a weekend testing family-inspired pastry recipes at a tiny pop-up bakery. The surprise favorite is a lemon cake served in hand-painted paper boxes.',
  },
];
const savedProjects = loadProjects();
const dashboardSample = {
  id: 'demo-kelly-dashboard',
  title: 'Kelly Clarkson, a local business and the return of social media',
  createdAt: Date.now(),
  dashboard: true,
  kind: 'draft',
  draftText: 'Kelly Clarkson, a local business and the return of social media\n\nAn editable sample project for the CSA dashboard. Bring together the three sample sources below to develop your story.',
  sources: [
    { type: 'text', title: 'Kelly Clarkson and the conversation around local business', text: 'Sample source for this dashboard prototype. Explore the connection between a celebrity story and a local business angle.' },
    { type: 'text', title: 'How social media shapes the story', text: 'Sample source for this dashboard prototype. Collect the key reactions and identify the context behind the conversation.' },
    { type: 'text', title: 'What readers need to know', text: 'Sample source for this dashboard prototype. Organize the story into clear takeaways and verify details before publication.' },
  ],
};
let projects = [
  ...(!savedProjects.some((project) => project.id === dashboardSample.id) ? [dashboardSample] : []),
  ...sampleStories.filter((story) => !savedProjects.some((project) => project.id === story.id)).map((story) => ({
    id: story.id,
    title: story.title,
    createdAt: Date.now(),
    sources: [{ type: 'text', title: 'Fictional sample story', text: `Fictional demo content created for the CSA prototype.\n\n${story.text}` }],
  })),
  ...savedProjects,
];
let activeProjectId = null;
let sourceTargetProjectId = null;
let materialMode = 'upload';
let selectedFiles = [];
let addingToProject = false;
let uploadContext = 'material';
let materialBusy = false;
let toastTimer;
let toastAction = null;
let feedbackTarget = null;
let dashboard = null;
const outputTimers = new Map();
const toolDropdowns = createToolDropdowns({ notify });
const recentProjectsPanel = createRecentProjects({ onOpen: showProject, onArchive: id => moveProject(id, 'archive'), onTrash: id => moveProject(id, 'trash') });
const outputPresets = createOutputPresets({ onSelect: openSavedOutput });
const projectSourcesPanel = createProjectSources({
  onDownloadSource: downloadSource,
  onSelectionChange(projectId) {
    richEditor.flush();
    const project = projects.find(entry => entry.id === projectId);
    if (project) { project.updatedAt = Date.now(); saveProjects(); }
  },
  onAddSource(projectId) { richEditor.flush(); railNavigation.close(); openProjectDialog(true, projectId); },
});
const railNavigation = createRailNavigation({
  onRecentsOpen: renderRecentProjects,
  onSourcesOpen() { projectSourcesPanel.render(projects.find(project => project.id === activeProjectId && project.kind === 'draft') || null); },
  onOpen: () => { toolDropdowns.close(); outputPresets.close(); recentProjectsPanel.close(); richEditor.closePanels(); },
});
const richEditor = createMaterialEditor({
  onSendToCms: markVariantSentToCms,
  onContentChange: updateComposerActions,
  notify,
  onSave(snapshot) {
    const project = projects.find(entry => entry.id === snapshot.id);
    if (!project) return false;
    project.sources = snapshot.sources;
    const output = projectOutputs(project).find(entry => entry.id === project.selectedOutputId);
    if (output) {
      for (const key of ['title', 'document', 'draftText', 'metadata', 'updatedAt']) output[key] = snapshot[key];
      project.toolPreferences = snapshot.toolPreferences;
      project.updatedAt = snapshot.updatedAt;
    } else Object.assign(project, snapshot);
    const saved = saveProjects();
    renderOutputs(project);
    return saved;
  },
});

function renderOutputs(project) {
  renderProjectOutputs(project);
  outputPresets.render(projects, project?.id || null);
}

function openSavedOutput(projectId, outputId) {
  richEditor.flush();
  const project = projects.find(entry => entry.id === projectId && !entry.archivedAt && !entry.deletedAt);
  const output = projectOutputs(project).find(entry => entry.id === outputId && entry.isFavorite);
  if (!output) return;
  project.selectedOutputIds = [...new Set([...selectedOutputs(project).map(entry => entry.id), output.id])];
  if (outputIsReady(output)) {
    project.selectedOutputId = output.id;
    saveProjects();
    showEditorProject(project);
    return;
  }
  if (project.outputProcessing) {
    if (!project.outputProcessing.ids.includes(output.id)) project.outputProcessing.ids.push(output.id);
    project.outputProcessing.openOutputId = output.id;
  } else project.outputProcessing = { ids: [output.id], readyAt: Date.now() + 4000, openOutputId: output.id };
  saveProjects();
  showEditorProject(project);
  notify('Preparing your saved output…');
}

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((project) => project && typeof project.id === 'string' && typeof project.title === 'string' && Number.isFinite(project.createdAt) && Array.isArray(project.sources) && project.sources.every((source) => source && ['link', 'search', 'file', 'text'].includes(source.type) && typeof source.title === 'string' && (source.text === undefined || typeof source.text === 'string') && (source.url === undefined || typeof source.url === 'string')));
  } catch {
    return [];
  }
}

function saveProjects() {
  let saved = true;
  try {
    localStorage.setItem(storageKey, JSON.stringify(projects));
  } catch {
    saved = false;
    notify('Browser storage is unavailable or full. This project will last for this session.');
  }
  renderRecentProjects();
  outputPresets.render(projects, activeProjectId);
  dashboard?.render(projects);
  return saved;
}

function notify(message, action = null) {
  clearTimeout(toastTimer);
  toastAction = action;
  $('#toast-message').textContent = message;
  $('#toast-undo').hidden = !action;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; toastAction = null; }, action ? 9000 : 5500);
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  svg.setAttribute('aria-hidden', 'true');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}

function safeUrl(value) {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : /^(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(value) ? `https://${value}` : null;
    if (!candidate) return null;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function titleFrom(text) {
  const line = text.trim().split('\n')[0].replace(/^#+\s*/, '');
  return line.length > 70 ? `${line.slice(0, 67)}…` : line;
}

function createProject(sources, options = {}) {
  const first = sources[0];
  const project = {
    id: crypto.randomUUID(),
    title: options.title || (first?.type === 'link' ? new URL(first.url).hostname.replace(/^www\./, '') : first ? titleFrom(first.title) : 'Untitled story'),
    createdAt: Date.now(),
    sources,
    dashboard: first?.type !== 'search',
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.draftText !== undefined ? { draftText: options.draftText } : {}),
    ...(options.document ? { document: options.document } : {}),
    ...(options.awaitingOutput ? { awaitingOutput: true } : {}),
    ...(typeof options.editorialDirection === 'string' ? { editorialDirection: options.editorialDirection } : {}),
    ...(options.toolPreferences ? { toolPreferences: options.toolPreferences } : {}),
  };
  projects.unshift(project);
  saveProjects();
  if (options.open !== false) showProject(project.id);
  return project;
}

function showHome(focusInput = true) {
  sourceTargetProjectId = null;
  activeProjectId = null;
  closeComposer();
  railNavigation.close();
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  $('#workspace').hidden = true;
  $('#project-start').hidden = true;
  $('#home').hidden = false;
  $('#source-input').value = '';
  $('#start-button').disabled = true;
  closeProfile();
  renderRecentProjects();
  dashboard?.render(projects);
  document.title = 'CSA — Your creative workspace';
  window.scrollTo({ top: 0 });
  if (focusInput) $('#dashboard-new-project')?.focus();
  dashboard?.reveal();
}

function showSourceStart() {
  activeProjectId = null;
  closeComposer();
  railNavigation.close();
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  $('#home').hidden = true;
  $('#workspace').hidden = true;
  $('#project-start').hidden = false;
  $('#source-input').value = '';
  $('#start-button').disabled = true;
  closeProfile();
  renderRecentProjects();
  document.title = 'New project — CSA';
  window.scrollTo({ top: 0 });
  $('#source-input').focus();
}

function closeComposer() {
  outputPresets.close();
  toolDropdowns.close();
  richEditor.close();
  try { sessionStorage.removeItem('csa.editor.active.v1'); } catch { /* Navigation still works without storage. */ }
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  $('#composer').hidden = true;
  $('#composer').classList.remove('has-editor', 'has-output');
  $('#output-placeholder').hidden = true;
  $('.create-variant').disabled = true;
  $('#composer-editorial-direction').value = '';
  document.body.classList.remove('showing-composer', 'editing-material');
}

function showProjectStart() {
  closeComposer();
  activeProjectId = null;
  railNavigation.close();
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  document.body.classList.add('showing-composer');
  $('#home').hidden = true;
  $('#workspace').hidden = true;
  $('#project-start').hidden = true;
  $('#composer').hidden = false;
  $('#composer-heading').textContent = 'New project';
  for (const select of document.querySelectorAll('.composer-field select')) select.value = '';
  toolDropdowns.refresh();
  updateComposerActions();
  renderOutputs(null);
  setNewVariantCollapsed(false);
  closeProfile();
  renderRecentProjects();
  document.title = 'New project — CSA';
  window.scrollTo({ top: 0 });
  $('#main').focus({ preventScroll: true });
  openProjectDialog();
}

function openProjectDialog(reset = true, sourceProjectId = null) {
  sourceTargetProjectId = sourceProjectId;
  $('#new-project-dialog-title').textContent = sourceProjectId ? 'Add source' : 'New Project';
  $('.new-project-close').setAttribute('aria-label', sourceProjectId ? 'Close add source modal' : 'Close new project modal');
  $('#new-project-use-material').textContent = sourceProjectId ? 'Add source' : 'Start creating';
  uploadContext = 'starter';
  materialMode = 'upload';
  selectedFiles = [];
  $('#new-project-file-input').value = '';
  clearError();
  renderFiles();
  if (reset) $('#new-project-query').value = '';
  $('#new-project-submit').disabled = !$('#new-project-query').value.trim();
  if (!$('#new-project-dialog').open) $('#new-project-dialog').showModal();
  $('#new-project-query').focus();
}

function returnFromSourceAddition() {
  const project = projects.find(entry => entry.id === sourceTargetProjectId);
  sourceTargetProjectId = null;
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  if ($('#material-dialog').open) $('#material-dialog').close();
  if (project) { showEditorProject(project); railNavigation.open('sources'); }
  else showHome();
}

function appendProjectSources(sources) {
  const project = projects.find(entry => entry.id === sourceTargetProjectId);
  if (!project) { sourceTargetProjectId = null; showHome(); return; }
  const additions = sources.filter(source => !project.sources.some(existing => source.url ? existing.url === source.url : existing.type === source.type && existing.title === source.title && existing.text === source.text));
  project.sources.push(...additions.map(source => ({ ...source, selected: true })));
  project.updatedAt = Date.now();
  saveProjects();
  sourceTargetProjectId = null;
  showEditorProject(project);
  railNavigation.open('sources');
  notify(additions.length ? `${additions.length} ${additions.length === 1 ? 'source' : 'sources'} added.` : 'These sources are already in your project.');
}

function showSourceAdditionResults(query) {
  closeComposer();
  railNavigation.close();
  for (const id of ['home', 'workspace', 'project-start']) $(`#${id}`).hidden = true;
  document.body.classList.add('showing-results');
  searchExperience.show({ id: `add-source-${crypto.randomUUID()}`, sources: [{ type: 'search', title: query }] }, { addingSources: true });
  document.title = `Add source — ${query} — CSA`;
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function showProject(id) {
  sourceTargetProjectId = null;
  const project = projects.find((entry) => entry.id === id);
  if (!project || project.deletedAt) return;
  if (project.kind === 'draft') { showEditorProject(project); return; }
  closeComposer();
  railNavigation.close();
  activeProjectId = id;
  $('#project-start').hidden = true;
  if (project.sources.length === 1 && project.sources[0].type === 'search') {
    railNavigation.close();
    $('#home').hidden = true;
    $('#workspace').hidden = true;
    document.body.classList.add('showing-results');
    searchExperience.show(project);
    document.title = `${project.title} — Search — CSA`;
    renderRecentProjects();
    closeProfile();
    $('#main').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    return;
  }
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  $('#home').hidden = true;
  $('#workspace').hidden = false;
  $('#workspace-heading').textContent = project.title;
  $('.workspace-intro').textContent = project.kind === 'draft' ? 'An editable starting point for your story.' : 'A little space for your next idea.';
  $('#draft-editor').hidden = project.kind !== 'draft';
  $('#draft-text').value = typeof project.draftText === 'string' ? project.draftText : '';
  $('.sources-heading h2').textContent = project.kind === 'draft' ? 'Source articles' : 'Your material';
  $('.workspace-note').textContent = project.kind === 'draft' ? 'Your draft and source excerpts are saved on this device.' : 'Your project is saved on this device. Content processing is coming next.';
  document.title = `${project.title} — CSA`;
  $('#source-list').replaceChildren(...project.sources.map((source) => {
    const card = element('li', 'source-card');
    const info = element('div', 'source-info');
    const url = source.type === 'link' ? safeUrl(source.url) : null;
    if (url) {
      const link = element('a', '', source.title);
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      info.append(link);
    } else {
      info.append(element('strong', '', source.title));
    }
    const labels = { link: 'Website link', search: 'Search idea', text: 'Pasted text', file: 'Local file' };
    const detail = source.type === 'file' && Number.isFinite(source.size) ? ` · ${formatBytes(source.size)}` : '';
    info.append(element('small', '', labels[source.type] + detail));
    if (source.text) info.append(element('p', '', source.text));
    if (source.attachmentId) {
      const download = element('button', 'text-button document-download', 'Download document');
      download.type = 'button';
      download.setAttribute('aria-label', `Download ${source.title}`);
      download.addEventListener('click', () => downloadSource(source));
      info.append(download);
    }
    card.append(icon(source.type === 'link' ? 'link' : source.type === 'search' ? 'search' : 'file'), info);
    return card;
  }));
  renderRecentProjects();
  closeProfile();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function renderSourceStory(project) {
  const latestOutput = projectOutputs(project).filter(outputIsReady).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  let story;
  if (latestOutput) {
    if (populateOutputContent(latestOutput)) saveProjects();
    const ops = Array.isArray(latestOutput.document?.ops) ? latestOutput.document.ops : [];
    const text = ops.map(op => typeof op?.insert === 'string' ? op.insert : '').join('') || latestOutput.draftText || '';
    story = { title: latestOutput.title, paragraphs: text.split(/\n+/).map(paragraph => paragraph.trim()).filter(Boolean) };
  } else story = project.sourceStory;
  if (!latestOutput && (!story || typeof story.title !== 'string' || !Array.isArray(story.paragraphs) || !story.paragraphs.length || !story.paragraphs.every(paragraph => typeof paragraph === 'string'))) {
    const sample = sampleVariant(project, []);
    populateOutputContent(sample);
    const paragraphs = sample.draftText.split(/\n\s*\n/);
    story = { title: sample.title, paragraphs: [...paragraphs.slice(0, 3), ...paragraphs.slice(-2)] };
    project.sourceStory = story;
    saveProjects();
  }
  $('#source-story-title').textContent = story.title;
  $('#source-story-body').replaceChildren(...story.paragraphs.map(paragraph => element('p', '', paragraph)));
  $('#output-placeholder').scrollTop = 0;
}

function showEditorProject(project) {
  closeComposer();
  railNavigation.close();
  activeProjectId = project.id;
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  document.body.classList.add('showing-composer');
  for (const section of ['home', 'workspace', 'project-start']) $(`#${section}`).hidden = true;
  $('#composer').hidden = false;
  resumeOutputProcessing(project, false);
  const selectedOutput = projectOutputs(project).find(output => output.id === project.selectedOutputId && outputIsReady(output));
  if (selectedOutput && populateOutputContent(selectedOutput)) saveProjects();
  if (project.awaitingOutput && !selectedOutput) {
    $('#composer').classList.add('has-output');
    $('#composer-heading').textContent = 'Story workspace';
    renderSourceStory(project);
    $('#output-placeholder').hidden = false;
    for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = project.toolPreferences?.[key] || '';
    $('#main').focus({ preventScroll: true });
  } else {
    document.body.classList.add('editing-material');
    $('#composer').classList.add('has-editor');
    $('#composer-heading').textContent = 'Story editor';
    richEditor.open(selectedOutput ? { ...project, ...selectedOutput, id: project.id, toolPreferences: project.toolPreferences } : project);
  }
  toolDropdowns.refresh();
  updateComposerActions();
  renderOutputs(project);
  setNewVariantCollapsed(Boolean(project.newVariantCollapsed));
  $('#composer-editorial-direction').value = typeof project.editorialDirection === 'string' ? project.editorialDirection : '';
  closeProfile();
  renderRecentProjects();
  document.title = `${selectedOutput?.title || project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Drafts still save to local project storage. */ }
  window.scrollTo({ top: 0 });
}

function closeProfile() {
  railNavigation.close('profile');
}

function updateComposerActions() {
  const hasContent = !$('#material-editor').hidden ? richEditor.hasContent() : !$('#output-placeholder').hidden;
  let changed = false;
  for (const key of ['format', 'audience', 'voice']) {
    const select = $(`#composer-${key}`);
    if (select.disabled !== !hasContent) changed = true;
    select.disabled = !hasContent;
    select.title = hasContent ? '' : 'Add content to the editor first';
  }
  if (changed) toolDropdowns.refresh();
  const enabled = hasContent && ['format', 'audience', 'voice'].some(key => $(`#composer-${key}`).value);
  $('.create-variant').disabled = !enabled;
  $('.create-variant').title = !hasContent ? 'Add content to the editor first' : enabled ? 'Create variant' : 'Select a format, audience, or voice to create a variant';
}

function ensureComposerProject() {
  let project = projects.find(entry => entry.id === activeProjectId);
  if (project || $('#composer').hidden) return project;
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  const direction = $('#composer-editorial-direction').value;
  if (!Object.values(preferences).some(Boolean) && !direction.trim()) return null;
  project = createProject([], { kind: 'draft', awaitingOutput: true, toolPreferences: preferences, editorialDirection: direction, open: false });
  activeProjectId = project.id;
  document.title = `${project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Project storage still keeps the guidance and selections. */ }
  return project;
}

function setNewVariantCollapsed(collapsed) {
  $('#composer-variant-form').hidden = collapsed;
  $('#toggle-new-variant').setAttribute('aria-expanded', String(!collapsed));
  const label = `${collapsed ? 'Expand' : 'Collapse'} New Variant`;
  $('#toggle-new-variant').setAttribute('aria-label', label);
  $('#toggle-new-variant').title = label;
  $('.composer-tools').dataset.collapsed = String(collapsed);
  if (collapsed) toolDropdowns.close();
}

$('#toggle-new-variant').addEventListener('click', () => {
  const collapsed = !$('#composer-variant-form').hidden;
  const project = projects.find(entry => entry.id === activeProjectId);
  if (project) { project.newVariantCollapsed = collapsed; saveProjects(); }
  setNewVariantCollapsed(collapsed);
});

$('.create-variant').addEventListener('click', () => {
  if ($('.create-variant').disabled) return;
  const selections = ['format', 'audience', 'voice'].flatMap(key => {
    const select = $(`#composer-${key}`);
    return select.value ? [{ key, value: select.value, label: select.options[select.selectedIndex].textContent }] : [];
  });
  if (!selections.length) return;
  richEditor.flush();
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project) return;
  const output = sampleVariant(project, selections);
  project.outputs = [output, ...projectOutputs(project)];
  project.newVariantCollapsed = true;
  setNewVariantCollapsed(true);
  project.toolPreferences = { format: '', audience: '', voice: '' };
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = '';
  toolDropdowns.refresh();
  updateComposerActions();
  project.updatedAt = Date.now();
  const saved = saveProjects();
  renderOutputs(project);
  [...$('#output-list').querySelectorAll('[data-output-id]')].find(button => button.dataset.outputId === output.id)?.focus();
  if (saved) notify('Variant created.');
});

$('#output-list').addEventListener('click', event => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project) return;
  const favorite = event.target.closest('[data-favorite-output]');
  if (favorite) {
    richEditor.flush();
    const output = projectOutputs(project).find(entry => entry.id === favorite.dataset.favoriteOutput);
    if (!output) return;
    output.isFavorite = !output.isFavorite;
    if (output.isFavorite) output.favoritedAt = Date.now();
    else delete output.favoritedAt;
    saveProjects();
    renderOutputs(project);
    [...$('#output-list').querySelectorAll('[data-favorite-output]')].find(button => button.dataset.favoriteOutput === output.id)?.focus({ preventScroll: true });
    return;
  }
  const selection = event.target.closest('[data-select-output]');
  const card = event.target.closest('[data-output-id]');
  if (!selection && !card) return;
  const output = projectOutputs(project).find(entry => entry.id === (selection?.dataset.selectOutput || card.dataset.outputId));
  if (!output) return;
  if (selection || !outputIsReady(output)) {
    if (project.outputProcessing && !outputIsReady(output)) return;
    richEditor.flush();
    const selectedIds = new Set(selectedOutputs(project).map(entry => entry.id));
    if (selectedIds.has(output.id)) selectedIds.delete(output.id);
    else selectedIds.add(output.id);
    project.selectedOutputIds = [...selectedIds];
    saveProjects();
    renderOutputs(project);
    const selector = selection ? '[data-select-output]' : '[data-output-id]';
    [...$('#output-list').querySelectorAll(selector)].find(button => (button.dataset.selectOutput || button.dataset.outputId) === output.id)?.focus({ preventScroll: true });
    return;
  }
  richEditor.flush();
  if (project.selectedOutputId === output.id) delete project.selectedOutputId;
  else {
    project.selectedOutputIds = [...new Set([...selectedOutputs(project).map(entry => entry.id), output.id])];
    project.selectedOutputId = output.id;
  }
  saveProjects();
  showEditorProject(project);
});

function finishOutputProcessing(project, renderWhenReady = true) {
  const job = project.outputProcessing;
  if (!job) return;
  clearTimeout(outputTimers.get(project.id));
  outputTimers.delete(project.id);
  const ids = new Set(job.ids);
  project.selectedOutputIds = [...new Set([...selectedOutputs(project).map(output => output.id), ...ids])];
  const active = activeProjectId === project.id && !$('#composer').hidden;
  if (active) richEditor.close();
  for (const output of projectOutputs(project)) {
    if (ids.has(output.id)) { output.status = 'ready'; output.processedAt = Date.now(); populateOutputContent(output); }
  }
  const latestCreated = projectOutputs(project).find(output => output.id === job.openOutputId && outputIsReady(output)) || projectOutputs(project).filter(output => ids.has(output.id) && outputIsReady(output)).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  if (latestCreated) project.selectedOutputId = latestCreated.id;
  delete project.selectedPendingOutputIds;
  delete project.outputProcessing;
  saveProjects();
  if (active && renderWhenReady) {
    showEditorProject(project);
    notify(latestCreated ? 'Output ready. The newest variant is open in the editor.' : 'Output processing finished.');
  }
}

function resumeOutputProcessing(project, renderWhenReady = true) {
  const job = project.outputProcessing;
  if (!job || !Array.isArray(job.ids) || !Number.isFinite(job.readyAt)) return;
  if (job.readyAt <= Date.now()) { finishOutputProcessing(project, renderWhenReady); return; }
  if (!outputTimers.has(project.id)) outputTimers.set(project.id, setTimeout(() => finishOutputProcessing(project), job.readyAt - Date.now()));
}

$('#create-output').addEventListener('click', () => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || project.outputProcessing) return;
  const pending = selectedPendingOutputs(project);
  if (!pending.length) return;
  project.outputProcessing = { ids: pending.map(output => output.id), readyAt: Date.now() + 4000 };
  saveProjects();
  renderOutputs(project);
  resumeOutputProcessing(project);
});

$('#composer-share-button').addEventListener('click', () => notify('Tool sharing is coming soon.'));
$('#composer-editorial-direction').addEventListener('input', () => {
  const project = ensureComposerProject();
  if (!project) return;
  project.editorialDirection = $('#composer-editorial-direction').value;
  project.updatedAt = Date.now();
  saveProjects();
});
for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).addEventListener('change', () => {
  updateComposerActions();
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  const project = ensureComposerProject();
  if (!project?.awaitingOutput) return;
  project.toolPreferences = preferences;
  saveProjects();
});

$('#source-input').addEventListener('input', () => {
  $('#start-button').disabled = !$('#source-input').value.trim();
});

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#source-input').value.trim();
  submitSource(input);
});

function submitSource(input) {
  if (!input) return;
  const tokens = input.split(/\s+/);
  const urls = tokens.map(safeUrl);
  if (sourceTargetProjectId) {
    if (urls.every(Boolean)) appendProjectSources(urls.map(url => ({ type: 'link', title: url, url })));
    else showSourceAdditionResults(input);
    return;
  }
  if (urls.every(Boolean)) {
    const sources = urls.map(url => ({ type: 'link', title: url, url }));
    const sample = sampleVariant({ sources }, []);
    populateOutputContent(sample);
    createProject(sources, { title: sample.title, kind: 'draft', draftText: `Fictional sample story for the CSA demo.\n\n${sample.draftText}`, document: { ops: [{ insert: 'Fictional sample story for the CSA demo.\n' }, ...sample.document.ops] } });
    notify('A fictional sample story is ready. Your link is saved in Sources.');
  } else startSearch(input);
}

$('#new-project-query').addEventListener('input', () => {
  $('#new-project-submit').disabled = !$('#new-project-query').value.trim();
});
$('#new-project-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#new-project-query').value.trim();
  if (!input) return;
  $('#new-project-dialog').close();
  submitSource(input);
});
$('#new-project-material').addEventListener('click', () => {
  $('#new-project-dialog').close();
  if (sourceTargetProjectId) {
    openMaterial('paste', true);
    $('#material-title').textContent = 'Add source';
    $('#use-material').textContent = 'Add source';
  } else createProject([], { title: 'Untitled story', kind: 'draft', draftText: '' });
});
async function downloadSource(source) {
  try { await downloadDocument(source); }
  catch (error) { notify(error.message || 'This document could not be downloaded. Please try again.'); }
}

function startSearch(query) {
  const existing = projects.find((project) => !project.deletedAt && !project.archivedAt && project.sources.length === 1 && project.sources[0].type === 'search' && project.sources[0].title.toLowerCase() === query.toLowerCase());
  if (existing) showProject(existing.id);
  else createProject([{ type: 'search', title: query }], { kind: 'search' });
}

$('.brand').addEventListener('click', () => showHome());
$('#new-project').addEventListener('click', showProjectStart);
$('#back-home').addEventListener('click', () => showHome());
$('#back-dashboard').addEventListener('click', () => showHome());

function renderRecentProjects() {
  recentProjectsPanel.render(projects, activeProjectId);
}

function setMaterialMode(mode) {
  materialMode = mode;
  for (const button of document.querySelectorAll('[data-tab]')) {
    const selected = button.dataset.tab === mode;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  }
  $('#upload-panel').hidden = mode !== 'upload';
  $('#paste-panel').hidden = mode !== 'paste';
  clearError();
  updateMaterialButton();
}

function openMaterial(mode, append = false) {
  addingToProject = append;
  uploadContext = 'material';
  selectedFiles = [];
  $('#file-input').value = '';
  $('#material-text').value = '';
  $('#selected-files').replaceChildren();
  $('#material-title').textContent = append ? 'Add your material' : 'Start with your material';
  $('#material-cancel').textContent = 'Cancel';
  $('#file-status').textContent = '';
  $('#use-material').textContent = append ? 'Add to project' : 'Start creating';
  setMaterialMode(mode);
  closeProfile();
  $('#material-dialog').showModal();
  if (mode === 'paste') $('#material-text').focus();
}

for (const button of document.querySelectorAll('[data-material]')) button.addEventListener('click', () => openMaterial(button.dataset.material));
$('#add-material').addEventListener('click', () => openMaterial('upload', true));
for (const button of document.querySelectorAll('[data-tab]')) {
  button.addEventListener('click', () => setMaterialMode(button.dataset.tab));
  button.addEventListener('keydown', (event) => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setMaterialMode(event.key === 'Home' ? 'upload' : event.key === 'End' ? 'paste' : materialMode === 'upload' ? 'paste' : 'upload');
      $(`#${materialMode}-tab`).focus();
    }
  });
}

function uploadElement(id) {
  return $(`#${uploadContext === 'starter' ? 'new-project-' : ''}${id}`);
}

function updateMaterialButton() {
  uploadElement('use-material').disabled = materialBusy || (materialMode === 'upload' ? selectedFiles.length === 0 : !$('#material-text').value.trim());
  if (uploadContext === 'starter') $('#new-project-upload-selection').hidden = selectedFiles.length === 0;
}

function clearError() {
  uploadElement('material-error').hidden = true;
  uploadElement('material-error').textContent = '';
}

function showError(message) {
  uploadElement('material-error').textContent = message;
  uploadElement('material-error').hidden = false;
}

function formatBytes(size) {
  return size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;
}

function renderFiles() {
  uploadElement('selected-files').replaceChildren(...selectedFiles.map((file, index) => {
    const item = element('li');
    const remove = element('button', 'icon-button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.append(icon('close'));
    remove.addEventListener('click', () => {
      selectedFiles.splice(index, 1);
      clearError();
      renderFiles();
      (uploadElement('selected-files').querySelector('button') || uploadElement('file-input')).focus();
    });
    item.append(element('span', '', `${file.name} · ${formatBytes(file.size)}`), remove);
    return item;
  }));
  uploadElement('file-status').textContent = selectedFiles.length ? `${selectedFiles.length} ${selectedFiles.length === 1 ? 'document' : 'documents'} selected` : '';
  updateMaterialButton();
}

function selectFiles(files, context) {
  if (materialBusy) return;
  uploadContext = context;
  clearError();
  const rejected = [];
  for (const file of files) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!acceptedExtensions.has(extension) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      rejected.push(file.name);
    } else if (!selectedFiles.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) {
      if (selectedFiles.length < 20) selectedFiles.push(file);
      else rejected.push(file.name);
    }
  }
  if (rejected.length) showError(`Couldn't add ${rejected.join(', ')}. Choose a non-empty, supported file up to 10 MB, with no more than 20 files at a time.`);
  renderFiles();
}

for (const [context, prefix] of [['material', ''], ['starter', 'new-project-']]) {
  const input = $(`#${prefix}file-input`);
  const zone = $(`#${prefix}drop-zone`);
  input.addEventListener('change', event => {
    selectFiles(event.target.files, context);
    event.target.value = '';
  });
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', event => {
    event.preventDefault(); zone.classList.remove('dragging');
    selectFiles(event.dataTransfer.files, context);
  });
}
$('#material-text').addEventListener('input', () => { clearError(); updateMaterialButton(); });

async function useMaterial() {
  if (materialBusy) return;
  const fromStarter = uploadContext === 'starter';
  const dialog = $(fromStarter ? '#new-project-dialog' : '#material-dialog');
  const button = uploadElement('use-material');
  const label = button.textContent;
  materialBusy = true;
  button.textContent = materialMode === 'upload' ? 'Saving documents…' : 'Saving…';
  dialog.setAttribute('aria-busy', 'true');
  for (const control of dialog.querySelectorAll('button, input, textarea')) control.disabled = true;
  clearError();
  try {
    let sources;
    if (materialMode === 'paste') {
      const text = $('#material-text').value.trim();
      if (!text) return;
      sources = [{ type: 'text', title: titleFrom(text), text }];
    } else {
      if (!selectedFiles.length) return;
      sources = await saveDocuments(selectedFiles);
    }
    dialog.close();
    if (sourceTargetProjectId) { appendProjectSources(sources); return; }
    const existing = !fromStarter && addingToProject && projects.find((project) => project.id === activeProjectId);
    if (existing) {
      existing.sources.push(...sources);
      saveProjects();
      showProject(existing.id);
    } else if (fromStarter) {
      const text = sources.filter(source => source.text).map(source => source.text.trim()).join('\n\n');
      createProject(sources, {
        title: titleFrom(sources[0].title.replace(/\.[^.]+$/, '')),
        kind: 'draft', draftText: text, document: { ops: text.split(/\n\s*\n/).filter(paragraph => paragraph.trim()).map(paragraph => ({ insert: `${paragraph}\n` })) },
      });
      railNavigation.open('sources');
    } else {
      createProject(sources);
    }
  } catch (error) {
    showError(error.name === 'QuotaExceededError' ? 'There is not enough browser storage for these documents. Try fewer or smaller files.' : 'These documents could not be saved in this browser. Please try again with fewer files.');
  } finally {
    materialBusy = false;
    button.textContent = label;
    dialog.removeAttribute('aria-busy');
    for (const control of dialog.querySelectorAll('button, input, textarea')) control.disabled = false;
    if (fromStarter) $('#new-project-submit').disabled = !$('#new-project-query').value.trim();
    updateMaterialButton();
  }
}
$('#use-material').addEventListener('click', useMaterial);
$('#new-project-use-material').addEventListener('click', useMaterial);

for (const id of ['material-dialog', 'new-project-dialog']) $(`#${id}`).addEventListener('cancel', event => { if (materialBusy) event.preventDefault(); });

for (const id of ['material-dialog', 'new-project-dialog']) $(`#${id}`).addEventListener('cancel', event => {
  if (sourceTargetProjectId && !materialBusy) { event.preventDefault(); returnFromSourceAddition(); }
});

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
  if (sourceTargetProjectId && ['new-project-dialog', 'material-dialog'].includes(button.dataset.close)) returnFromSourceAddition();
  else if (button.dataset.close === 'new-project-dialog') showHome();
  else $(`#${button.dataset.close}`).close();
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (['material-dialog', 'new-project-dialog'].includes(dialog.id) && materialBusy) return;
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) {
      if (sourceTargetProjectId && ['new-project-dialog', 'material-dialog'].includes(dialog.id)) returnFromSourceAddition();
      else dialog.close();
    }
  });
}

const searchExperience = createSearchExperience({
  onSearch: submitSource,
  onCancelAddSources: returnFromSourceAddition,
  onDirectionChange(id, direction) {
    const project = projects.find(entry => entry.id === id);
    if (project) { project.editorialDirection = direction; saveProjects(); }
  },
  onSelectionChange(id, selection) {
    const project = projects.find((entry) => entry.id === id);
    if (project) { project.selectedArticleIds = selection; saveProjects(); }
  },
  onDraft({ query, articles, editorialDirection }) {
    const sources = articles.map((article) => ({ type: 'text', title: article.title, text: `Fictional sample article · ${article.source} · ${article.date}\n\n${article.paragraphs.join('\n\n')}` }));
    if (sourceTargetProjectId) { appendProjectSources(sources); return; }
    createProject(sources, { title: `${titleFrom(query)} — Draft`, kind: 'draft', awaitingOutput: true, editorialDirection });
  },
});

$('#draft-text').addEventListener('input', () => {
  const project = projects.find((entry) => entry.id === activeProjectId);
  if (project?.kind === 'draft') { project.draftText = $('#draft-text').value; saveProjects(); }
});

function moveProject(id, destination) {
  richEditor.flush();
  const project = projects.find((entry) => entry.id === id);
  if (!project) return;
  const previous = { archivedAt: project.archivedAt, deletedAt: project.deletedAt };
  if (destination === 'archive') project.archivedAt = Date.now();
  else project.deletedAt = Date.now();
  saveProjects();
  if (activeProjectId === id) showHome();
  notify(destination === 'archive' ? 'Project archived.' : 'Project moved to Trash.', () => {
    Object.assign(project, previous);
    saveProjects();
    notify('Project restored.');
  });
}

function markVariantSentToCms(projectId) {
  const project = projects.find(entry => entry.id === projectId);
  const variant = projectOutputs(project).find(output => output.id === project?.selectedOutputId && outputIsReady(output));
  if (!variant) { notify('Select a generated variant to send to CMS.'); return; }
  if (Number.isFinite(variant.cmsSentAt) && variant.cmsSentAt > 0) {
    notify('Demo: this variant is already marked as sent to CMS.');
    openExperienceFeedback(project, variant);
    return;
  }
  variant.cmsSentAt = Date.now();
  project.updatedAt = variant.cmsSentAt;
  const saved = saveProjects();
  notify(saved ? 'Demo: variant marked as sent to CMS. WordPress is not connected.' : 'Demo: variant marked as sent for this session only. WordPress is not connected.');
  openExperienceFeedback(project, variant);
}

function openExperienceFeedback(project, variant) {
  feedbackTarget = { projectId: project.id, outputId: variant.id };
  $('#experience-feedback-options').hidden = false;
  $('#experience-feedback-thanks').hidden = true;
  $('#experience-feedback-done').hidden = true;
  for (const button of document.querySelectorAll('[data-experience-rating]')) {
    button.setAttribute('aria-pressed', String(button.dataset.experienceRating === variant.experienceFeedback?.rating));
  }
  $('#experience-feedback-dialog').showModal();
}

$('#experience-feedback-options').addEventListener('click', event => {
  const button = event.target.closest('[data-experience-rating]');
  if (!button || !feedbackTarget) return;
  const project = projects.find(entry => entry.id === feedbackTarget.projectId);
  const variant = projectOutputs(project).find(output => output.id === feedbackTarget.outputId);
  if (!variant) return;
  variant.experienceFeedback = { rating: button.dataset.experienceRating, submittedAt: Date.now() };
  const saved = saveProjects();
  $('#experience-feedback-thanks').textContent = saved ? 'Thanks for your feedback!' : 'Thanks! Your feedback is saved for this session.';
  $('#experience-feedback-options').hidden = true;
  $('#experience-feedback-thanks').hidden = false;
  $('#experience-feedback-done').hidden = false;
  $('#experience-feedback-done').focus();
});
$('#experience-feedback-dialog').addEventListener('close', () => { feedbackTarget = null; });

$('#toast-undo').addEventListener('click', () => {
  const action = toastAction;
  clearTimeout(toastTimer);
  toastAction = null;
  $('#toast').hidden = true;
  action?.();
});

dashboard = createDashboard({
  onNew: showProjectStart,
  onOpen: showProject,
});
dashboard.render(projects);
dashboard.reveal();
for (const project of projects) resumeOutputProcessing(project);
try {
  const savedEditor = sessionStorage.getItem('csa.editor.active.v1');
  if (savedEditor && projects.some(project => project.id === savedEditor && !project.deletedAt && !project.archivedAt)) showProject(savedEditor);
} catch { /* Start on the dashboard when session storage is unavailable. */ }
