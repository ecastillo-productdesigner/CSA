import { createSearchExperience } from './search.js';
import { createDashboard } from './dashboard.js';

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
let materialMode = 'upload';
let selectedFiles = [];
let addingToProject = false;
let materialReturnToStart = false;
let toastTimer;
let toastAction = null;
let dashboard = null;

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
  try {
    localStorage.setItem(storageKey, JSON.stringify(projects));
  } catch {
    notify('Browser storage is unavailable or full. This project will last for this session.');
  }
  renderRecentProjects();
  dashboard?.render(projects);
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
    title: options.title || (first.type === 'link' ? new URL(first.url).hostname.replace(/^www\./, '') : titleFrom(first.title)),
    createdAt: Date.now(),
    sources,
    dashboard: first.type !== 'search',
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.draftText !== undefined ? { draftText: options.draftText } : {}),
  };
  projects.unshift(project);
  saveProjects();
  showProject(project.id);
}

function showHome(focusInput = true) {
  activeProjectId = null;
  closeComposer();
  setSidebarExpanded(false);
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
}

function showSourceStart() {
  activeProjectId = null;
  closeComposer();
  setSidebarExpanded(false);
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
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  $('#composer').hidden = true;
  document.body.classList.remove('showing-composer');
}

function showProjectStart() {
  activeProjectId = null;
  setSidebarExpanded(false);
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  document.body.classList.add('showing-composer');
  $('#home').hidden = true;
  $('#workspace').hidden = true;
  $('#project-start').hidden = true;
  $('#composer').hidden = false;
  for (const select of document.querySelectorAll('.composer-field select')) select.value = '';
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
  closeComposer();
  if (sidebarOverlayQuery.matches) setSidebarExpanded(false);
  activeProjectId = id;
  $('#project-start').hidden = true;
  if (project.sources.length === 1 && project.sources[0].type === 'search') {
    setSidebarExpanded(false);
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

function closeProfile() {
  $('#profile-menu').hidden = true;
  $('#show-profile').setAttribute('aria-expanded', 'false');
}

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
  materialReturnToStart = true;
  openMaterial('upload');
});
$('#material-dialog').addEventListener('close', () => {
  const returnToStart = materialReturnToStart;
  materialReturnToStart = false;
  if (returnToStart && document.body.classList.contains('showing-composer')) openProjectDialog(false);
});

function startSearch(query) {
  const existing = projects.find((project) => !project.deletedAt && !project.archivedAt && project.sources.length === 1 && project.sources[0].type === 'search' && project.sources[0].title.toLowerCase() === query.toLowerCase());
  if (existing) showProject(existing.id);
  else createProject([{ type: 'search', title: query }], { kind: 'search' });
}

const sidebarOverlayQuery = matchMedia('(max-width: 900px)');

function syncSidebarOverlay() {
  $('#main').inert = document.body.classList.contains('sidebar-expanded') && sidebarOverlayQuery.matches;
}

function setSidebarExpanded(expanded, restoreFocus = false) {
  if (!expanded) setRecentsExpanded(false);
  document.body.classList.toggle('sidebar-expanded', expanded);
  $('.brand').setAttribute('aria-expanded', String(expanded));
  $('.brand').setAttribute('aria-label', expanded ? 'Collapse sidebar' : 'Expand sidebar');
  $('#collapse-sidebar').hidden = !expanded;
  $('#sidebar-backdrop').hidden = !expanded;
  closeProfile();
  syncSidebarOverlay();
  if (restoreFocus) $('.brand').focus();
}

sidebarOverlayQuery.addEventListener('change', syncSidebarOverlay);
$('.brand').addEventListener('click', () => setSidebarExpanded(!document.body.classList.contains('sidebar-expanded')));
$('#collapse-sidebar').addEventListener('click', () => setSidebarExpanded(false, true));
$('#sidebar-backdrop').addEventListener('click', () => setSidebarExpanded(false, true));
$('#new-project').addEventListener('click', showProjectStart);
$('#back-home').addEventListener('click', () => showHome());
$('#back-dashboard').addEventListener('click', () => showHome());
$('#profile-home').addEventListener('click', () => showHome());
$('#profile-materials').addEventListener('click', showSourceStart);

$('#show-profile').addEventListener('click', () => {
  const show = $('#profile-menu').hidden;
  $('#profile-menu').hidden = !show;
  $('#show-profile').setAttribute('aria-expanded', String(show));
});
document.addEventListener('click', (event) => {
  if (!event.target.closest('#show-profile, #profile-menu')) closeProfile();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeProfile();
    if (!document.querySelector('dialog[open]')) {
      if (!$('#recent-projects').hidden) setRecentsExpanded(false, true);
      else if (document.body.classList.contains('sidebar-expanded')) setSidebarExpanded(false, true);
    }
  }
});

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
      button.append(title, ellipsis);
      if (project.id === activeProjectId) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', () => showProject(project.id));
      item.append(button);
      list.append(item);
    }
    content.replaceChildren(list);
  }
}

function setRecentsExpanded(expanded, restoreFocus = false) {
  if (expanded) renderRecentProjects();
  $('#recent-projects').hidden = !expanded;
  $('#show-history').setAttribute('aria-expanded', String(expanded));
  if (restoreFocus) $('#show-history').focus();
}

$('#show-history').addEventListener('click', () => {
  closeProfile();
  const expanded = $('#recent-projects').hidden;
  if (expanded) setSidebarExpanded(true);
  setRecentsExpanded(expanded);
});

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
  onSelectionChange(id, selection) {
    const project = projects.find((entry) => entry.id === id);
    if (project) { project.selectedArticleIds = selection; saveProjects(); }
  },
  onDraft({ query, articles }) {
    const draftText = [query, '', ...articles.map((article) => `${article.title}\n\n${article.excerpt}\n\nSource: ${article.source} | ${article.date}\n`)].join('\n');
    createProject(articles.map((article) => ({ type: 'text', title: article.title, text: `${article.excerpt}\n\nSample article · ${article.source} · ${article.date}` })), { title: `${titleFrom(query)} — Draft`, kind: 'draft', draftText });
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
