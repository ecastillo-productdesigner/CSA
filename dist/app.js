import { createSearchExperience } from './search.js?v=20261015-output-workspace';
import { createDashboard } from './dashboard.js?v=20261015-home-reveal';
import { createMaterialEditor } from './editor.js?v=20261015-wordpress-button';
import { createToolDropdowns } from './tool-dropdowns.js?v=20261016-saved-tools';
import { createRailNavigation } from './navigation.js?v=20261016-hover-navigation';
import { projectOutputs, sampleVariant, outputIsReady, populateOutputContent, renderOutputs, toggleOutputMenu } from './outputs.js?v=20261015-home-reveal';

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
let directionProjectId = null;
let materialMode = 'upload';
let selectedFiles = [];
let addingToProject = false;
let toastTimer;
let toastAction = null;
let dashboard = null;
const outputTimers = new Map();
const toolDropdowns = createToolDropdowns({ notify });
const railNavigation = createRailNavigation({ onRecentsOpen: renderRecentProjects, onOpen: () => toolDropdowns.close() });
const richEditor = createMaterialEditor({
  onHome: () => showHome(),
  notify,
  onSave(snapshot) {
    const project = projects.find(entry => entry.id === snapshot.id);
    if (!project) return false;
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
  toolDropdowns.close();
  richEditor.close();
  try { sessionStorage.removeItem('csa.editor.active.v1'); } catch { /* Navigation still works without storage. */ }
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  $('#composer').hidden = true;
  $('#composer').classList.remove('has-editor', 'has-output');
  $('#output-placeholder').hidden = true;
  $('.create-variant').disabled = true;
  $('#composer-direction-button').disabled = true;
  $('#composer-direction-button').classList.remove('has-direction');
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
  closeProfile();
  renderRecentProjects();
  document.title = 'New project — CSA';
  window.scrollTo({ top: 0 });
  $('#main').focus({ preventScroll: true });
  openProjectDialog();
}

function openProjectDialog(reset = true) {
  if (reset) $('#new-project-query').value = '';
  $('#new-project-submit').disabled = !$('#new-project-query').value.trim();
  if (!$('#new-project-dialog').open) $('#new-project-dialog').showModal();
  $('#new-project-query').focus();
}

function showProject(id) {
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
    card.append(icon(source.type === 'link' ? 'link' : source.type === 'search' ? 'search' : 'file'), info);
    return card;
  }));
  renderRecentProjects();
  closeProfile();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
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
  resumeOutputProcessing(project);
  const selectedOutput = projectOutputs(project).find(output => output.id === project.selectedOutputId && outputIsReady(output));
  if (selectedOutput && populateOutputContent(selectedOutput)) saveProjects();
  if (project.awaitingOutput && !selectedOutput) {
    $('#composer').classList.add('has-output');
    $('#composer-heading').textContent = 'Story workspace';
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
  $('#composer-direction-button').classList.toggle('has-direction', Boolean(project.editorialDirection));
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
  const enabled = ['format', 'audience', 'voice'].some(key => $(`#composer-${key}`).value);
  $('.create-variant').disabled = !enabled;
  $('#composer-direction-button').disabled = !enabled;
  $('.create-variant').title = enabled ? 'Create variant' : 'Select a format, audience, or voice to create a variant';
  $('#composer-direction-button').title = enabled ? 'Editorial direction' : 'Select a format, audience, or voice to add editorial direction';
}

$('.create-variant').addEventListener('click', () => {
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
  project.toolPreferences = { format: '', audience: '', voice: '' };
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = '';
  toolDropdowns.refresh();
  updateComposerActions();
  project.updatedAt = Date.now();
  const saved = saveProjects();
  renderOutputs(project);
  $('#create-output').focus();
  if (saved) notify('Variant created.');
});

$('#output-list').addEventListener('click', event => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project) return;
  const menuButton = event.target.closest('[data-output-menu]');
  if (menuButton) { toggleOutputMenu(menuButton); return; }
  const removeButton = event.target.closest('[data-delete-output]');
  if (removeButton) { deleteOutput(project, removeButton.dataset.deleteOutput); return; }
  const card = event.target.closest('[data-output-id]');
  if (!card) return;
  const output = projectOutputs(project).find(entry => entry.id === card.dataset.outputId);
  if (!output || !outputIsReady(output)) return;
  richEditor.flush();
  if (project.selectedOutputId === output.id) delete project.selectedOutputId;
  else project.selectedOutputId = output.id;
  saveProjects();
  showEditorProject(project);
});

function finishOutputProcessing(project) {
  const job = project.outputProcessing;
  if (!job) return;
  clearTimeout(outputTimers.get(project.id));
  outputTimers.delete(project.id);
  const ids = new Set(job.ids);
  for (const output of projectOutputs(project)) {
    if (ids.has(output.id)) { output.status = 'ready'; output.processedAt = Date.now(); populateOutputContent(output); }
  }
  delete project.outputProcessing;
  saveProjects();
  if (activeProjectId === project.id && !$('#composer').hidden) {
    renderOutputs(project);
    notify('Output ready. Select a solid card to open the editor.');
  }
}

function resumeOutputProcessing(project) {
  const job = project.outputProcessing;
  if (!job || !Array.isArray(job.ids) || !Number.isFinite(job.readyAt)) return;
  if (job.readyAt <= Date.now()) { finishOutputProcessing(project); return; }
  if (!outputTimers.has(project.id)) outputTimers.set(project.id, setTimeout(() => finishOutputProcessing(project), job.readyAt - Date.now()));
}

$('#create-output').addEventListener('click', () => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || project.outputProcessing) return;
  const pending = projectOutputs(project).filter(output => !outputIsReady(output));
  if (!pending.length) return;
  project.outputProcessing = { ids: pending.map(output => output.id), readyAt: Date.now() + 4000 };
  saveProjects();
  renderOutputs(project);
  resumeOutputProcessing(project);
});

function deleteOutput(project, id) {
  richEditor.flush();
  const outputs = projectOutputs(project);
  const index = outputs.findIndex(output => output.id === id);
  if (index < 0) return;
  const removed = outputs[index];
  const selected = project.selectedOutputId === id;
  project.outputs = outputs.filter(output => output.id !== id);
  if (selected) delete project.selectedOutputId;
  saveProjects();
  if (selected) showEditorProject(project); else renderOutputs(project);
  notify('Variant deleted.', () => {
    const current = projectOutputs(project);
    current.splice(Math.min(index, current.length), 0, removed);
    project.outputs = current;
    saveProjects();
    if (activeProjectId === project.id) renderOutputs(project);
    notify('Variant restored.');
  });
}

function openEditorialDirection(projectId) {
  const project = projects.find(entry => entry.id === projectId);
  if (!project) return;
  directionProjectId = projectId;
  $('#editorial-direction-text').value = typeof project.editorialDirection === 'string' ? project.editorialDirection : '';
  $('#editorial-direction-dialog').showModal();
  $('#editorial-direction-text').focus();
}

$('#composer-direction-button').addEventListener('click', () => openEditorialDirection(activeProjectId));
$('#composer-share-button').addEventListener('click', () => notify('Tool sharing is coming soon.'));
$('#editorial-direction-dialog').addEventListener('close', () => { directionProjectId = null; });
$('#editorial-direction-form').addEventListener('submit', event => {
  event.preventDefault();
  const project = projects.find(entry => entry.id === directionProjectId);
  if (!project) return;
  project.editorialDirection = $('#editorial-direction-text').value.trim();
  project.updatedAt = Date.now();
  const saved = saveProjects();
  searchExperience.setEditorialDirection(project.id, project.editorialDirection);
  $('#composer-direction-button').classList.toggle('has-direction', Boolean(project.editorialDirection));
  $('#editorial-direction-dialog').close();
  if (saved) notify(project.editorialDirection ? 'Editorial direction saved.' : 'Editorial direction cleared.');
});
for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).addEventListener('change', () => {
  updateComposerActions();
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  let project = projects.find(entry => entry.id === activeProjectId);
  if (!project && !$('#composer').hidden && Object.values(preferences).some(Boolean)) {
    project = createProject([], { kind: 'draft', awaitingOutput: true, toolPreferences: preferences, open: false });
    activeProjectId = project.id;
    document.title = `${project.title} — CSA`;
    try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Project storage still keeps the selections. */ }
  }
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
  if (urls.every(Boolean)) createProject(urls.map((url) => ({ type: 'link', title: url, url })));
  else startSearch(input);
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
  createProject([], { title: 'Untitled story', kind: 'draft', draftText: '' });
});

function startSearch(query) {
  const existing = projects.find((project) => !project.deletedAt && !project.archivedAt && project.sources.length === 1 && project.sources[0].type === 'search' && project.sources[0].title.toLowerCase() === query.toLowerCase());
  if (existing) showProject(existing.id);
  else createProject([{ type: 'search', title: query }], { kind: 'search' });
}

$('.brand').addEventListener('click', () => showHome());
$('#new-project').addEventListener('click', showProjectStart);
$('#back-home').addEventListener('click', () => showHome());
$('#back-dashboard').addEventListener('click', () => showHome());
$('#profile-home').addEventListener('click', () => showHome());
$('#profile-materials').addEventListener('click', showSourceStart);

function renderRecentProjects() {
  const content = $('#history-content');
  const recentProjects = projects.filter((project) => !project.archivedAt && !project.deletedAt).slice(0, 30);
  if (!recentProjects.length) {
    content.replaceChildren(element('p', 'empty-history', 'Your projects will appear here once you begin.'));
  } else {
    const list = element('ul', 'history-list');
    for (const project of recentProjects) {
      const item = element('li');
      const button = element('button', 'history-item');
      button.type = 'button';
      button.title = project.title;
      button.setAttribute('aria-label', project.title);
      const title = element('span', 'history-item-title', project.title.replace(/(?:\.{3}|…)\s*$/, ''));
      const ellipsis = element('span', 'history-item-ellipsis', '...');
      ellipsis.setAttribute('aria-hidden', 'true');
      button.append(icon('file'), title, ellipsis);
      if (project.id === activeProjectId) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => showProject(project.id));
      item.append(button);
      list.append(item);
    }
    content.replaceChildren(list);
  }
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
  selectedFiles = [];
  $('#file-input').value = '';
  $('#material-text').value = '';
  $('#selected-files').replaceChildren();
  $('#material-title').textContent = append ? 'Add your material' : 'Start with your material';
  $('#use-material').textContent = append ? 'Add to project →' : 'Start creating →';
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

function updateMaterialButton() {
  $('#use-material').disabled = materialMode === 'upload' ? selectedFiles.length === 0 : !$('#material-text').value.trim();
}

function clearError() {
  $('#material-error').hidden = true;
  $('#material-error').textContent = '';
}

function showError(message) {
  $('#material-error').textContent = message;
  $('#material-error').hidden = false;
}

function formatBytes(size) {
  return size < 1024 ? `${size} B` : size < 1048576 ? `${Math.round(size / 1024)} KB` : `${(size / 1048576).toFixed(1)} MB`;
}

function renderFiles() {
  $('#selected-files').replaceChildren(...selectedFiles.map((file, index) => {
    const item = element('li');
    const remove = element('button', 'icon-button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${file.name}`);
    remove.append(icon('close'));
    remove.addEventListener('click', () => { selectedFiles.splice(index, 1); renderFiles(); });
    item.append(element('span', '', `${file.name} · ${formatBytes(file.size)}`), remove);
    return item;
  }));
  updateMaterialButton();
}

function selectFiles(files) {
  clearError();
  const rejected = [];
  for (const file of files) {
    const extension = file.name.split('.').pop().toLowerCase();
    if (!acceptedExtensions.has(extension) || file.size > 10 * 1024 * 1024) {
      rejected.push(file.name);
    } else if (!selectedFiles.some((entry) => entry.name === file.name && entry.size === file.size && entry.lastModified === file.lastModified)) {
      if (selectedFiles.length < 20) selectedFiles.push(file);
      else rejected.push(file.name);
    }
  }
  if (rejected.length) showError(`Couldn't add ${rejected.join(', ')}. Choose a supported file up to 10 MB, with no more than 20 files at a time.`);
  renderFiles();
}

$('#file-input').addEventListener('change', (event) => selectFiles(event.target.files));
$('#material-text').addEventListener('input', () => { clearError(); updateMaterialButton(); });
$('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); $('#drop-zone').classList.add('dragging'); });
$('#drop-zone').addEventListener('dragleave', () => $('#drop-zone').classList.remove('dragging'));
$('#drop-zone').addEventListener('drop', (event) => {
  event.preventDefault();
  $('#drop-zone').classList.remove('dragging');
  selectFiles(event.dataTransfer.files);
});

$('#use-material').addEventListener('click', async () => {
  const button = $('#use-material');
  button.disabled = true;
  clearError();
  try {
    let sources;
    if (materialMode === 'paste') {
      const text = $('#material-text').value.trim();
      if (!text) return;
      sources = [{ type: 'text', title: titleFrom(text), text }];
    } else {
      if (!selectedFiles.length) return;
      sources = await Promise.all(selectedFiles.map(async (file) => ({
        type: 'file',
        title: file.name,
        size: file.size,
        ...(/\.(txt|md)$/i.test(file.name) ? { text: (await file.slice(0, 100000).text()).slice(0, 100000) } : {}),
      })));
    }
    $('#material-dialog').close();
    const existing = addingToProject && projects.find((project) => project.id === activeProjectId);
    if (existing) {
      existing.sources.push(...sources);
      saveProjects();
      showProject(existing.id);
    } else {
      createProject(sources);
    }
  } catch {
    showError('This file could not be read. Please choose it again.');
  } finally {
    updateMaterialButton();
  }
});

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => $(`#${button.dataset.close}`).close());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
}

const searchExperience = createSearchExperience({
  onSearch: startSearch,
  onDirection: openEditorialDirection,
  onSelectionChange(id, selection) {
    const project = projects.find((entry) => entry.id === id);
    if (project) { project.selectedArticleIds = selection; saveProjects(); }
  },
  onDraft({ query, articles, editorialDirection }) {
    createProject(articles.map((article) => ({ type: 'text', title: article.title, text: `${article.excerpt}\n\nSample article · ${article.source} · ${article.date}` })), { title: `${titleFrom(query)} — Draft`, kind: 'draft', awaitingOutput: true, editorialDirection });
  },
});

$('#draft-text').addEventListener('input', () => {
  const project = projects.find((entry) => entry.id === activeProjectId);
  if (project?.kind === 'draft') { project.draftText = $('#draft-text').value; saveProjects(); }
});

function moveProject(id, destination) {
  const project = projects.find((entry) => entry.id === id);
  if (!project) return;
  const previous = { archivedAt: project.archivedAt, deletedAt: project.deletedAt };
  if (destination === 'archive') project.archivedAt = Date.now();
  else project.deletedAt = Date.now();
  saveProjects();
  notify(destination === 'archive' ? 'Project archived.' : 'Project moved to Trash.', () => {
    Object.assign(project, previous);
    saveProjects();
    notify('Project restored.');
  });
}

function restoreProject(id) {
  const project = projects.find((entry) => entry.id === id);
  if (!project) return;
  delete project.archivedAt;
  delete project.deletedAt;
  saveProjects();
  notify('Project restored.');
}

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
  onArchive: (id) => moveProject(id, 'archive'),
  onTrash: (id) => moveProject(id, 'trash'),
  onRestore: restoreProject,
});
dashboard.render(projects);
dashboard.reveal();
for (const project of projects) resumeOutputProcessing(project);
try {
  const savedEditor = sessionStorage.getItem('csa.editor.active.v1');
  if (savedEditor && projects.some(project => project.id === savedEditor && !project.deletedAt && !project.archivedAt)) showProject(savedEditor);
} catch { /* Start on the dashboard when session storage is unavailable. */ }
