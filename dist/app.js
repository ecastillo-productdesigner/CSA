import { updatePresetPreferences } from './preset-settings.js?v=20261021-content-cards';
import { normalizeWordCount, setProjectWordCount } from './variant-word-count.js?v=20261021-content-cards';
import { tokenNumber, breakpointQuery } from './design-system/runtime.js?v=20261021-content-cards';
import { createIcon as icon } from './icons.js?v=20261021-content-cards';
import { parseSourceLinks, formatSourceLinks, sourceLinkArticles } from './source-links.js?v=20261021-content-cards';
import { removeVariant, restoreVariant } from './variant-deletion.js?v=20261021-content-cards';
import { createProfile } from './profile.js?v=20261021-content-cards';
import { createSearchExperience } from './search.js?v=20261021-content-cards';
import { createDashboard, normalizeProjectTitles } from './dashboard.js?v=20261021-content-cards';
import { createMaterialEditor } from './editor.js?v=20261021-content-cards';
import { saveDocuments, downloadDocument, deleteDocuments } from './documents.js?v=20261021-content-cards';
import { removeProjectContent } from './project-deletion.js?v=20261021-content-cards';
import { createContentPreview } from './content-preview.js?v=20261021-content-cards';
import { createToolDropdowns } from './tool-dropdowns.js?v=20261021-content-cards';
import { createRailNavigation } from './navigation.js?v=20261021-content-cards';
import { createProjectSources } from './sources.js?v=20261021-content-cards';
import { projectOutputs, customVariantName, initializeVariantNames, sampleVariant, outputIsReady, outputSourceCount, selectedOutputs, selectedPendingOutputs, populateOutputContent, createOutputBadges, reviseSampleOutput, variantPanelState, renderOutputs as renderProjectOutputs } from './outputs.js?v=20261021-content-cards';
import { createEditorTabs } from './editor-tabs.js?v=20261021-content-cards';

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
let materialBusy = false;
let toastTimer;
let toastAction = null;
let sourcePanelOutputId = null;
let dashboard = null;
const outputTimers = new Map();
const outputViews = new Map();
const toolDropdowns = createToolDropdowns({ notify });
const contentPreview = createContentPreview({
  onChange(text) {
    const project = projects.find(entry => entry.id === activeProjectId);
    if (!project?.contentPreview) return;
    project.contentPreview.text = text;
    if (project.sources[0]) project.sources[0].text = text;
    project.updatedAt = Date.now();
    saveProjects();
    updateComposerActions();
  },
});
const editorTabs = createEditorTabs({ onSelect: openEditorTab });
const projectSourcesPanel = createProjectSources({
  onVariantContextChange(outputId) { sourcePanelOutputId = outputId; syncSourceBadges(); },
  onRemoveSource: removeProjectSource,
  onDownloadSource: downloadSource,
  onSelectionChange(projectId) {
    richEditor.flush();
    const project = projects.find(entry => entry.id === projectId);
    if (project) { project.updatedAt = Date.now(); saveProjects(); }
  },
});
const railNavigation = createRailNavigation({
  onSourcesOpen() { projectSourcesPanel.render(projects.find(project => project.id === activeProjectId && project.kind === 'draft') || null); },
  onSourcesClose() { sourcePanelOutputId = null; syncSourceBadges(); },
  onNewVariantOpen() { setNewVariantCollapsed(false); },
  onOpen: () => { toolDropdowns.close(); richEditor.closePanels(); },
});
createProfile({
  onClose: restoreFocus => railNavigation.close('profile', restoreFocus),
  onSessionEnd(logout) {
    richEditor.flush();
    railNavigation.close('profile');
    document.dispatchEvent(new CustomEvent('csa:end-demo-session', { detail: { logout } }));
  },
});
const richEditor = createMaterialEditor({
  onSendToCms: markVariantSentToCms,
  onContentChange: updateComposerActions,
  onToolbarChange: toolDropdowns.refresh,
  notify,
  onSave(snapshot) {
    const project = projects.find(entry => entry.id === snapshot.id);
    if (!project) return false;
    project.sources = snapshot.sources;
    const output = projectOutputs(project).find(entry => entry.id === project.selectedOutputId);
    if (output) {
      for (const key of ['title', 'document', 'draftText', 'metadata', 'updatedAt']) output[key] = snapshot[key];
      if (typeof snapshot.cmsSentContent === 'string') output.cmsSentContent = snapshot.cmsSentContent;
      project.toolPreferences = snapshot.toolPreferences;
      project.updatedAt = snapshot.updatedAt;
    } else Object.assign(project, snapshot);
    const saved = saveProjects();
    renderOutputs(project);
    return saved;
  },
});

function renderOutputs(project) {
  $('#show-sources').hidden = project?.kind !== 'draft';
  const view = variantPanelState(project, outputViews.get(project?.id)).view;
  outputViews.set(project?.id, view);
  renderProjectOutputs(project, view);
  editorTabs.render(project);
  const selectedOutput = projectOutputs(project).find(output => output.id === project?.selectedOutputId && (outputIsReady(output) || output.needsRegeneration));
  richEditor.setRevisionBusy(Boolean(project?.outputProcessing?.kind === 'revision' && project.outputProcessing.ids.includes(selectedOutput?.id)));
  const labels = $('#editor-variant-labels');
  labels.replaceChildren(...createOutputBadges(selectedOutput));
  labels.hidden = !labels.childElementCount;
  syncSourceBadges();
}

function selectOutputView(view) {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || !['pending', 'created'].includes(view)) return;
  outputViews.set(project.id, view);
  renderOutputs(project);
  $('#output-list').scrollTop = 0;
}
$('.output-status-tabs').addEventListener('click', event => {
  const tab = event.target.closest('[data-output-view]');
  if (tab) selectOutputView(tab.dataset.outputView);
});
$('.output-status-tabs').addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tab = event.target.closest('[data-output-view]');
  if (!tab) return;
  event.preventDefault();
  const view = event.key === 'Home' ? 'pending' : event.key === 'End' ? 'created' : tab.dataset.outputView === 'pending' ? 'created' : 'pending';
  selectOutputView(view);
  $(`[data-output-view="${view}"]`).focus({ preventScroll: true });
});

function renderProjectSources(project) {
  const variantId = sourcePanelOutputId && (!project?.viewOriginalDraft && project?.selectedOutputId || sourcePanelOutputId);
  const variant = variantId ? projectOutputs(project).find(output => output.id === variantId) : null;
  projectSourcesPanel.render(project, { variant });
}

function syncSourceBadges() {
  const open = $('#show-sources').getAttribute('aria-expanded') === 'true';
  for (const button of document.querySelectorAll('[data-variant-sources]')) button.setAttribute('aria-expanded', String(open && button.dataset.variantSources === sourcePanelOutputId));
}

function removeProjectSource(projectId, source) {
  richEditor.flush();
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  const index = project?.sources.indexOf(source) ?? -1;
  if (index < 0) return;
  const before = projectOutputs(project).map(output => [output, output.selectedSourceIndexes]);
  const updatedAt = project.updatedAt;
  project.sources.splice(index, 1);
  for (const [output, indexes] of before) {
    if (Array.isArray(indexes)) output.selectedSourceIndexes = indexes.filter(value => value !== index).map(value => value > index ? value - 1 : value);
  }
  project.updatedAt = Date.now();
  if (!saveProjects()) {
    project.sources.splice(index, 0, source);
    before.forEach(([output, indexes]) => { output.selectedSourceIndexes = indexes; });
    project.updatedAt = updatedAt;
    notify('Could not delete this source. Please try again.');
    return;
  }
  renderProjectSources(project);
  if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
  updateComposerActions();
  const focus = [...$('#editor-source-list').querySelectorAll('.editor-source-more')];
  (focus[Math.min(index, focus.length - 1)] || ($('#editor-source-list .editor-source-open') || $('#show-sources'))).focus({ preventScroll: true });
  notify('Source deleted.', () => {
    if (project.deletedAt || !projects.includes(project)) return;
    richEditor.flush();
    const currentIndexes = projectOutputs(project).map(output => [output, output.selectedSourceIndexes]);
    const insertAt = Math.min(index, project.sources.length);
    project.sources.splice(insertAt, 0, source);
    for (const [output, indexes] of currentIndexes) {
      if (!Array.isArray(indexes)) continue;
      const restored = indexes.map(value => value >= insertAt ? value + 1 : value);
      if (before.some(([previous, values]) => previous.id === output.id && values?.includes(index))) restored.push(insertAt);
      output.selectedSourceIndexes = [...new Set(restored)].sort((a, b) => a - b);
    }
    project.updatedAt = Date.now();
    if (!saveProjects()) {
      project.sources.splice(insertAt, 1);
      currentIndexes.forEach(([output, indexes]) => { output.selectedSourceIndexes = indexes; });
      notify('Could not restore this source. Please try again.');
      return;
    }
    if (activeProjectId === project.id) {
      renderProjectSources(project);
      if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
      updateComposerActions();
    }
    notify('Source restored.');
  });
}

function deleteVariant({ projectId, outputId }) {
  richEditor.flush();
  const persist = next => localStorage.setItem(storageKey, JSON.stringify(next));
  const refresh = () => {
    const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
    if (project && activeProjectId === projectId && !$('#composer').hidden) showEditorProject(project);
    else {
      dashboard?.render(projects);
    }
  };
  let deletion;
  try { deletion = removeVariant(projects, projectId, outputId, persist); }
  catch { notify('Could not delete this variant. Please try again.'); return false; }
  if (!deletion) return false;
  projects = deletion.projects;
  refresh();
  notify('Variant deleted.', () => {
    richEditor.flush();
    let restored;
    try { restored = restoreVariant(projects, deletion.undo, persist); }
    catch { notify('Could not restore this variant. Please try again.'); return; }
    if (!restored) { notify('This variant could not be restored.'); return; }
    projects = restored.projects;
    refresh();
    notify('Variant restored.');
  });
  return true;
}

function openEditorTab(outputId) {
  richEditor.flush();
  const project = projects.find(entry => entry.id === activeProjectId);
  if (project && !outputId) {
    const selected = selectedPendingOutputs(project);
    const pending = projectOutputs(project).filter(output => !outputIsReady(output));
    const target = pending.find(output => output.id === project.lastPendingOutputId) || selected[0] || pending[0];
    project.selectedOutputIds = [...new Set([...selected.map(output => output.id), ...(target ? [target.id] : [])])];
    project.lastPendingOutputId = target?.id || null;
    project.selectedOutputId = null;
    project.viewOriginalDraft = true;
    saveProjects();
    showEditorProject(project);
    return;
  }
  const output = projectOutputs(project).find(output => output.id === outputId && (outputIsReady(output) || output.needsRegeneration));
  if (!project || !output) return;
  outputViews.set(project.id, outputIsReady(output) ? 'created' : 'pending');
  project.selectedOutputIds = outputIsReady(output) ? [outputId] : [...new Set([...selectedPendingOutputs(project).map(output => output.id), outputId])];
  project.selectedOutputId = outputId;
  project.viewOriginalDraft = false;
  saveProjects();
  showEditorProject(project);
}

function loadProjects() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) return [];
    const restored = saved.filter((project) => project && typeof project.id === 'string' && typeof project.title === 'string' && Number.isFinite(project.createdAt) && Array.isArray(project.sources) && project.sources.every((source) => source && ['link', 'search', 'file', 'text'].includes(source.type) && typeof source.title === 'string' && (source.text === undefined || typeof source.text === 'string') && (source.url === undefined || typeof source.url === 'string'))).map(project => {
      for (const output of projectOutputs(project)) {
        output.sourceCount = outputSourceCount(output);
        if (!Array.isArray(output.sourceSnapshots)) output.sourceSnapshots = (Array.isArray(output.selectedSourceIndexes) ? output.selectedSourceIndexes : []).map(index => project.sources[index]).filter(Boolean).map(source => structuredClone(source));
      }
      return project;
    });
    if (normalizeProjectTitles(restored)) {
      try { localStorage.setItem(storageKey, JSON.stringify(restored)); }
      catch { /* Clean names remain available for this session. */ }
    }
    initializeVariantNames(restored);
    return restored;
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
    ...(first?.type === 'search' ? { addedArticleIds: [] } : {}),
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.draftText !== undefined ? { draftText: options.draftText } : {}),
    ...(options.document ? { document: options.document } : {}),
    ...(options.awaitingOutput ? { awaitingOutput: true } : {}),
    ...(options.contentPreview ? { contentPreview: options.contentPreview } : {}),
    ...(options.linkCards ? { linkCards: true } : {}),
    ...(typeof options.editorialDirection === 'string' ? { editorialDirection: options.editorialDirection } : {}),
    targetWordCount: normalizeWordCount(options.targetWordCount),
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
  railNavigation.closeTransient();
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  $('#workspace').hidden = true;
  $('#project-start').hidden = true;
  $('#home').hidden = false;
  $('#source-input').value = '';
  $('#start-button').disabled = true;
  closeProfile();
  dashboard?.render(projects);
  document.title = 'CSA — Your creative workspace';
  window.scrollTo({ top: 0 });
  if (focusInput) $('#dashboard-new-project')?.focus();
  dashboard?.reveal();
}

function showSourceStart() {
  activeProjectId = null;
  closeComposer();
  railNavigation.closeTransient();
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  $('#home').hidden = true;
  $('#workspace').hidden = true;
  $('#project-start').hidden = false;
  $('#source-input').value = '';
  $('#start-button').disabled = true;
  closeProfile();
  document.title = 'New project — CSA';
  window.scrollTo({ top: 0 });
  $('#source-input').focus();
}

function closeComposer() {
  toolDropdowns.close();
  richEditor.close();
  $('#show-sources').hidden = true;
  try { sessionStorage.removeItem('csa.editor.active.v1'); } catch { /* Navigation still works without storage. */ }
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  $('#composer').hidden = true;
  $('#composer').classList.remove('has-editor', 'has-output', 'has-link-cards');
  $('#output-placeholder').hidden = true;
  $('.create-variant').disabled = true;
  $('#composer-target-word-count').value = 'short';
  document.body.classList.remove('showing-composer', 'editing-material');
}

function showProjectStart() {
  richEditor.flush();
  railNavigation.closeTransient();
  toolDropdowns.close();
  closeProfile();
  openProjectDialog();
}

function openProjectDialog(reset = true, sourceProjectId = null) {
  sourceTargetProjectId = sourceProjectId;
  $('#new-project-dialog-title').textContent = sourceProjectId ? 'Add source' : 'New Project';
  $('.new-project-close').setAttribute('aria-label', sourceProjectId ? 'Close add source modal' : 'Close new project modal');
  if (reset) $('#new-project-query').value = '';
  if (!$('#new-project-dialog').open) $('#new-project-dialog').showModal();
  updateStarterInput();
  const focusTarget = window.matchMedia(breakpointQuery()).matches ? $('.new-project-close') : $('#new-project-query');
  focusTarget.focus({ preventScroll: true });
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

function showProject(id) {
  sourceTargetProjectId = null;
  const project = projects.find((entry) => entry.id === id);
  if (!project || project.deletedAt) return;
  if (project.kind === 'links') { project.kind = 'draft'; project.linkCards = true; project.awaitingOutput = true; saveProjects(); }
  if (project.kind === 'draft') { showEditorProject(project); return; }
  closeComposer();
  railNavigation.closeTransient();
  activeProjectId = id;
  $('#project-start').hidden = true;
  if (project.sources.length === 1 && project.sources[0].type === 'search') {
    railNavigation.closeTransient();
    $('#home').hidden = true;
    $('#workspace').hidden = true;
    document.body.classList.add('showing-results');
    searchExperience.show(project);
    document.title = `${project.title} — Search — CSA`;
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
      const download = element('button', 'text-button document-download', 'Download Document');
      download.type = 'button';
      download.setAttribute('aria-label', `Download ${source.title}`);
      download.addEventListener('click', () => downloadSource(source));
      info.append(download);
    }
    card.append(icon(source.type === 'link' ? 'link' : source.type === 'search' ? 'search' : 'file'), info);
    return card;
  }));
  closeProfile();
  $('#main').focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function renderSourceStory(project) {
  const latestOutput = project.viewOriginalDraft ? null : projectOutputs(project).filter(outputIsReady).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  if (project.linkCards && !latestOutput) {
    contentPreview.hide();
    $('#composer').classList.add('has-link-cards');
    searchExperience.show(project, { embedded: true });
    return;
  }
  if (project.contentPreview && !latestOutput) {
    contentPreview.render(project.contentPreview);
    $('#output-placeholder').scrollTop = 0;
    return;
  }
  if (project.viewOriginalDraft) {
    const originalText = Array.isArray(project.document?.ops)
      ? project.document.ops.map(op => typeof op?.insert === 'string' ? op.insert : '').join('') : project.draftText || '';
    if (originalText.trim()) {
      contentPreview.render({ text: `# ${project.title}\n\n${originalText.trim()}` }, { readOnly: true });
      $('#output-placeholder').scrollTop = 0;
      return;
    }
  }
  contentPreview.hide();
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
  contentPreview.render({ text: [`# ${story.title}`, ...story.paragraphs].join('\n\n') }, { readOnly: true });
  $('#output-placeholder').scrollTop = 0;
}

function showEditorProject(project) {
  closeComposer();
  railNavigation.closeTransient();
  activeProjectId = project.id;
  searchExperience.hide();
  document.body.classList.remove('showing-results');
  document.body.classList.add('showing-composer');
  for (const section of ['home', 'workspace', 'project-start']) $(`#${section}`).hidden = true;
  $('#composer').hidden = false;
  resumeOutputProcessing(project, false);
  const readyOutputs = projectOutputs(project).filter(outputIsReady);
  const selectedOutput = project.viewOriginalDraft ? null : projectOutputs(project).find(output => output.id === project.selectedOutputId && (outputIsReady(output) || output.needsRegeneration)) || readyOutputs[0];
  if (selectedOutput) {
    project.selectedOutputId = selectedOutput.id;
    project.viewOriginalDraft = false;
    project.selectedOutputIds = outputIsReady(selectedOutput) ? [selectedOutput.id] : [...new Set([...selectedPendingOutputs(project).map(output => output.id), selectedOutput.id])];
    if (outputIsReady(selectedOutput)) populateOutputContent(selectedOutput);
    saveProjects();
  }
  if (project.viewOriginalDraft || (project.awaitingOutput && !selectedOutput)) {
    $('#composer').classList.add('has-output');
    $('#composer-heading').textContent = 'Story workspace';
    renderSourceStory(project);
    $('#output-placeholder').hidden = Boolean(project.linkCards && !selectedOutput);
    for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = project.toolPreferences?.[key] || '';
    $('#main').focus({ preventScroll: true });
  } else {
    document.body.classList.add('editing-material');
    $('#composer').classList.add('has-editor');
    $('#composer-heading').textContent = 'Story editor';
    richEditor.open(selectedOutput ? { ...project, ...selectedOutput, id: project.id, toolPreferences: project.toolPreferences } : project);
  }
  $('#composer-target-word-count').value = normalizeWordCount(project.targetWordCount);
  toolDropdowns.refresh();
  updateComposerActions();
  renderOutputs(project);
  if ($('#show-sources').getAttribute('aria-expanded') === 'true') renderProjectSources(project);
  requestAnimationFrame(() => {
    const list = $('#output-list');
    const activeCard = list.querySelector('[data-active="true"]');
    if (!activeCard) return;
    const viewport = list.getBoundingClientRect();
    const card = activeCard.getBoundingClientRect();
    if (card.top < viewport.top) list.scrollTop += card.top - viewport.top - 3;
    else if (card.bottom > viewport.bottom) list.scrollTop += card.bottom - viewport.bottom + 3;
  });
  setNewVariantCollapsed(Boolean(project.newVariantCollapsed));
  closeProfile();
  document.title = `${selectedOutput?.title || project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Drafts still save to local project storage. */ }
  window.scrollTo({ top: 0 });
}

function closeProfile() {
  railNavigation.close('profile');
}

function updateComposerActions() {
  $('#composer-target-word-count').closest('.variant-word-count').hidden = !$('#composer-audience').value;
  const project = projects.find(project => project.id === activeProjectId);
  const hasContent = $('#composer').classList.contains('has-link-cards') ? project?.sources.some(source => source.selected !== false) : !$('#material-editor').hidden ? richEditor.hasContent() : !$('#output-placeholder').hidden && ($('#content-preview').hidden || contentPreview.hasContent());
  const processing = Boolean(projects.find(project => project.id === activeProjectId)?.outputProcessing);
  const canConfigure = hasContent && !processing;
  let changed = false;
  for (const key of ['format', 'audience', 'voice', 'target-word-count']) {
    const select = $(`#composer-${key}`);
    if (select.disabled !== !canConfigure) changed = true;
    select.disabled = !canConfigure;
    select.title = canConfigure ? '' : processing ? 'Adapting content…' : 'Add content first';
  }
  if (changed) toolDropdowns.refresh();
  const hasFormat = Boolean($('#composer-format').value);
  const enabled = hasContent && hasFormat && !processing;
  $('.create-variant').disabled = !enabled;
  $('.create-variant').title = processing ? 'Adapting content…' : !hasContent ? 'Select a source first' : !hasFormat ? 'Select a format first' : 'Add Content';
}

function ensureComposerProject(allowEmpty = false) {
  let project = projects.find(entry => entry.id === activeProjectId);
  if (project || $('#composer').hidden) return project;
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  const direction = '';
  if (!allowEmpty && !Object.values(preferences).some(Boolean) && !direction.trim()) return null;
  project = createProject([], { kind: 'draft', awaitingOutput: true, toolPreferences: preferences, editorialDirection: direction, targetWordCount: $('#composer-target-word-count').value, open: false });
  activeProjectId = project.id;
  $('#show-sources').hidden = false;
  document.title = `${project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Project storage still keeps the guidance and selections. */ }
  return project;
}

function setNewVariantCollapsed(collapsed) {
  $('#composer-variant-form').hidden = collapsed;
  $('#toggle-new-variant').setAttribute('aria-expanded', String(!collapsed));
  const label = `${collapsed ? 'Expand' : 'Collapse'} New Content`;
  $('#toggle-new-variant').setAttribute('aria-label', label);
  $('#toggle-new-variant').title = label;
  $('#toggle-new-variant [data-collapse-chevron]').textContent = collapsed ? 'keyboard_arrow_down' : 'keyboard_arrow_up';
  $('.composer-tools').dataset.collapsed = String(collapsed);
  if (collapsed) { toolDropdowns.close(); }
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
  richEditor.flush();
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || project.outputProcessing || !$('#composer-format').value) return;
  project.editorialDirection = '';
  setProjectWordCount(project, $('#composer-target-word-count').value);
  const output = sampleVariant(project, selections);
  project.lastPendingOutputId = output.id;
  project.selectedOutputIds = [...selectedPendingOutputs(project).map(entry => entry.id), output.id];
  project.selectedOutputId = null;
  project.viewOriginalDraft = true;
  delete project.variantPreset;
  project.outputs = [output, ...projectOutputs(project)];
  outputViews.set(project.id, 'pending');
  project.newVariantCollapsed = true;
  setNewVariantCollapsed(true);
  project.toolPreferences = { format: '', audience: '', voice: '' };
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = '';
  toolDropdowns.refresh();
  updateComposerActions();
  project.updatedAt = Date.now();
  const saved = saveProjects();
  showEditorProject(project);
  if (window.matchMedia(breakpointQuery()).matches) railNavigation.open('variants');
  [...$('#output-list').querySelectorAll('[data-output-id]')].find(button => button.dataset.outputId === output.id)?.focus({ preventScroll: true });
  if (saved) notify('Content added to To Create.');
});

$('#output-list').addEventListener('click', event => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project) return;
  const sources = event.target.closest('[data-variant-sources]');
  if (sources) { openVariantSources(sources); return; }
  const selection = event.target.closest('[data-select-output]');
  const card = selection || event.target.closest('[data-output-id]');
  if (!card) return;
  const output = projectOutputs(project).find(entry => entry.id === (selection ? card.dataset.selectOutput : card.dataset.outputId));
  if (!output || project.outputProcessing) return;
  if (!outputIsReady(output)) {
    richEditor.flush();
    const ids = new Set(selectedPendingOutputs(project).map(entry => entry.id));
    if (ids.has(output.id)) ids.delete(output.id); else ids.add(output.id);
    project.selectedOutputIds = [...ids];
    saveProjects();
    renderOutputs(project);
    return;
  }
  railNavigation.closeTransient();
  openEditorTab(output.id);
});

function openVariantSources(button) {
  if (button.getAttribute('aria-expanded') === 'true') { railNavigation.close('sources'); railNavigation.closeDrawer(); return; }
  richEditor.flush();
  toolDropdowns.close();
  const project = projects.find(entry => entry.id === activeProjectId);
  const output = projectOutputs(project).find(output => output.id === button.dataset.variantSources);
  if (project && output) {
    railNavigation.open('sources');
    projectSourcesPanel.render(project, { variant: output });
    syncSourceBadges();
    ($('#editor-source-list .editor-source-open') || $('#show-sources')).focus({ preventScroll: true });
  }
}
$('#editor-variant-labels').addEventListener('click', event => {
  const button = event.target.closest('[data-variant-sources]');
  if (button) openVariantSources(button);
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
    if (ids.has(output.id)) {
      if (job.kind === 'revision') reviseSampleOutput(output, job.instructions, job.requestedAt);
      else { output.status = 'ready'; delete output.needsRegeneration; output.processedAt = Date.now(); populateOutputContent(output); }
    }
  }
  const latestCreated = projectOutputs(project).find(output => output.id === job.openOutputId && outputIsReady(output)) || projectOutputs(project).filter(output => ids.has(output.id) && outputIsReady(output)).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  if (latestCreated) outputViews.set(project.id, 'created');
  if (latestCreated) { project.selectedOutputId = latestCreated.id; project.viewOriginalDraft = false; }
  delete project.selectedPendingOutputIds;
  delete project.outputProcessing;
  if (job.kind === 'revision') project.updatedAt = Date.now();
  saveProjects();
  if (active && renderWhenReady) {
    railNavigation.closeTransient();
    showEditorProject(project);
    if (job.kind !== 'revision') notify(latestCreated ? 'Variant ready. The newest variant is open in the editor.' : 'Variant processing finished.');
  }
  if (job.kind === 'revision') notify('Revision complete. Your draft has been updated.');
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
  const outputs = selectedPendingOutputs(project);
  if (!outputs.length) return;
  richEditor.flush();
  project.outputProcessing = { ids: outputs.map(output => output.id), openOutputId: outputs[0].id, readyAt: Date.now() + 4000 };
  saveProjects();
  renderOutputs(project);
  updateComposerActions();
  resumeOutputProcessing(project);
});

$('#composer-target-word-count').addEventListener('change', () => {
  const project = ensureComposerProject();
  if (!project) return;
  setProjectWordCount(project, $('#composer-target-word-count').value);
  project.updatedAt = Date.now();
  saveProjects();
  updateComposerActions();
});
for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).addEventListener('change', () => {
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  const project = ensureComposerProject();
  if (project) {
    updatePresetPreferences(project, preferences);
    project.updatedAt = Date.now();
    saveProjects();
  }
  updateComposerActions();
});

$('#source-input').addEventListener('input', () => {
  $('#start-button').disabled = !parseSourceLinks($('#source-input').value);
});

$('#start-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = $('#source-input').value.trim();
  submitSource(input);
});

function submitSource(input) {
  const urls = parseSourceLinks(input);
  if (!urls) return false;
  if (sourceTargetProjectId) {
    const target = projects.find(project => project.id === sourceTargetProjectId);
    if (target) { target.linkCards = true; target.viewOriginalDraft = true; }
    appendProjectSources(sourceLinkArticles(urls).map(article => ({ type: 'link', title: article.title, url: article.url })));
    return true;
  }
  const sources = sourceLinkArticles(urls).map(article => ({ type: 'link', title: article.title, url: article.url, selected: true }));
  createProject(sources, { kind: 'draft', awaitingOutput: true, linkCards: true });
  if (!window.matchMedia(breakpointQuery()).matches) railNavigation.open('sources');
  return true;
}

function updateStarterInput() {
  const field = $('#new-project-query');
  const formatted = formatSourceLinks(field.value);
  if (formatted !== field.value) {
    const caret = field.selectionStart + formatted.length - field.value.length;
    field.value = formatted;
    field.setSelectionRange(Math.max(0, caret), Math.max(0, caret));
  }
  const valid = Boolean(parseSourceLinks(field.value));
  const invalid = Boolean(field.value.trim()) && !valid;
  field.setCustomValidity(invalid ? 'Paste a valid website link to continue.' : '');
  field.setAttribute('aria-invalid', String(invalid));
  const error = $('#new-project-link-error');
  if (error) error.hidden = !invalid;
  $('#new-project-submit').disabled = !valid;
  return valid;
}
$('#new-project-query').addEventListener('input', updateStarterInput);
$('#new-project-query').addEventListener('keydown', event => {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
  if (event.metaKey || event.ctrlKey) {
    event.preventDefault();
    if (updateStarterInput()) $('#new-project-search-form').requestSubmit();
  }
});
$('#new-project-search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  if (!updateStarterInput()) return;
  const input = $('#new-project-query').value.trim();
  $('#new-project-dialog').close();
  submitSource(input);
});
async function downloadSource(source) {
  try { await downloadDocument(source); }
  catch (error) { notify(error.message || 'This document could not be downloaded. Please try again.'); }
}

$('.brand').addEventListener('click', () => showHome());
$('#new-project').addEventListener('click', showProjectStart);
$('#back-home').addEventListener('click', () => showHome());
$('#back-dashboard').addEventListener('click', () => showHome());

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
  $('#material-cancel').textContent = 'Cancel';
  $('#file-status').textContent = '';
  $('#use-material').textContent = append ? 'Add to Project' : 'Start Creating';
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
  return $(`#${id}`);
}

function updateMaterialButton() {
  uploadElement('use-material').disabled = materialBusy || (materialMode === 'upload' ? selectedFiles.length === 0 : !$('#material-text').value.trim());
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

function selectFiles(files) {
  if (materialBusy) return;
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

{
  const input = $('#file-input');
  const zone = $('#drop-zone');
  input.addEventListener('change', event => {
    selectFiles(event.target.files);
    event.target.value = '';
  });
  zone.addEventListener('dragover', event => { event.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', event => {
    event.preventDefault(); zone.classList.remove('dragging');
    selectFiles(event.dataTransfer.files);
  });
}
$('#material-text').addEventListener('input', () => { clearError(); updateMaterialButton(); });

async function useMaterial() {
  if (materialBusy) return;
  const dialog = $('#material-dialog');
  const button = uploadElement('use-material');
  const label = button.textContent;
  materialBusy = true;
  button.textContent = materialMode === 'upload' ? 'Saving Documents…' : 'Saving…';
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
    const existing = addingToProject && projects.find((project) => project.id === activeProjectId);
    if (existing) {
      existing.sources.push(...sources);
      saveProjects();
      showProject(existing.id);
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
    updateMaterialButton();
  }
}
$('#use-material').addEventListener('click', useMaterial);

$('#material-dialog').addEventListener('cancel', event => { if (materialBusy) event.preventDefault(); });

for (const id of ['material-dialog', 'new-project-dialog']) $(`#${id}`).addEventListener('cancel', event => {
  if (sourceTargetProjectId && !materialBusy) { event.preventDefault(); returnFromSourceAddition(); }
});

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
  if (button.dataset.close === 'delete-project-dialog' && $('#delete-project-dialog').getAttribute('aria-busy') === 'true') return;
  if (sourceTargetProjectId && ['new-project-dialog', 'material-dialog'].includes(button.dataset.close)) returnFromSourceAddition();
  else $(`#${button.dataset.close}`).close();
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (dialog.id === 'delete-project-dialog' && dialog.getAttribute('aria-busy') === 'true') return;
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
  onDirectionChange(id, direction) {
    const project = projects.find(entry => entry.id === id);
    if (project) { project.editorialDirection = direction; saveProjects(); }
  },
  onSelectionChange(id, selection, addedArticleIds) {
    const project = projects.find((entry) => entry.id === id);
    if (project) {
      project.selectedArticleIds = selection;
      if (Array.isArray(addedArticleIds)) project.addedArticleIds = addedArticleIds;
      if (project.linkCards) {
        project.sources.filter(source => source.type === 'link').forEach((source, index) => { source.selected = selection.includes(`link-${index + 1}`); });
        updateComposerActions();
        if ($('#show-sources').getAttribute('aria-expanded') === 'true') renderProjectSources(project);
      }
      saveProjects();
    }
  },
  onDraft({ query, articles, editorialDirection }) {
    const sources = articles.map((article) => article.url
      ? { type: 'link', title: article.title, url: article.url }
      : { type: 'text', title: article.title, text: `Fictional sample article · ${article.source} · ${article.date}\n\n${article.paragraphs.join('\n\n')}` });
    if (sourceTargetProjectId) { appendProjectSources(sources); return; }
    createProject(sources, { title: articles[0]?.url ? articles[0].title : titleFrom(query), kind: 'draft', awaitingOutput: true, editorialDirection });
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
  if (!richEditor.canSend()) return;
  variant.cmsSentAt = Date.now();
  variant.cmsSentContent = richEditor.markSent();
  project.updatedAt = variant.cmsSentAt;
  const saved = saveProjects();
  editorTabs.render(project);
  notify(saved ? 'Demo: variant marked as sent to CMS. WordPress is not connected.' : 'Demo: variant marked as sent for this session only. WordPress is not connected.');
}


$('#toast-undo').addEventListener('click', () => {
  const action = toastAction;
  clearTimeout(toastTimer);
  toastAction = null;
  $('#toast').hidden = true;
  action?.();
});

async function deleteProjectPermanently(id) {
  richEditor.flush();
  let removal;
  try {
    removal = removeProjectContent(projects, id, next => localStorage.setItem(storageKey, JSON.stringify(next)));
  } catch { return false; }
  if (!removal) return false;
  projects = removal.projects;
  clearTimeout(outputTimers.get(id));
  outputTimers.delete(id);
  dashboard.render(projects);
  if (activeProjectId === id) showHome(false);
  try { await deleteDocuments(removal.attachmentIds); }
  catch {
    notify('Project deleted. Some uploaded files could not be cleared from browser storage.');
    return true;
  }
  notify('Project deleted permanently.');
  return true;
}

dashboard = createDashboard({
  onNew: showProjectStart,
  onOpen: showProject,
  onDelete: deleteProjectPermanently,
});
dashboard.render(projects);
dashboard.reveal();
for (const project of projects) resumeOutputProcessing(project);
try {
  const savedEditor = sessionStorage.getItem('csa.editor.active.v1');
  if (savedEditor && projects.some(project => project.id === savedEditor && !project.deletedAt && !project.archivedAt)) showProject(savedEditor);
} catch { /* Start on the dashboard when session storage is unavailable. */ }
