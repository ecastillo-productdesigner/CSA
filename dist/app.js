import { partitionSourceAdditions, sourceIdentityKey, findDuplicateSource } from './source-model.js?v=20261026-drafting-card-size';
import { createSourceAlreadyAddedDialog } from './source-already-added.js?v=20261026-drafting-card-size';
import { createToast } from './toast.js?v=20261027-toast-timing';
import { updatePresetPreferences } from './preset-settings.js?v=20261026-drafting-card-size';
import { normalizeWordCount, setProjectWordCount } from './variant-word-count.js?v=20261026-drafting-card-size';
import { tokenNumber, breakpointQuery } from './design-system/runtime.js?v=20261029-revision-indicator-location';
import { createIcon as icon } from './icons.js?v=20261026-drafting-card-size';
import { parseSourceLinks, formatSourceLinks, sourceLinkArticles } from './source-links.js?v=20261026-drafting-card-size';
import { resolveArticleMetadata } from './article-metadata.js?v=20261026-drafting-card-size';
import { createPanelDisclosure } from './panel-disclosure.js?v=20261026-drafting-card-size';
import { createTabPanelTransition } from './tab-panel-transition.js?v=20261026-drafting-card-size';
import { bindTabSelection } from './selection-controls.js?v=20261026-drafting-card-size';
import { removeVariant, restoreVariant } from './variant-deletion.js?v=20261026-drafting-card-size';
import { createProfile } from './profile.js?v=20261026-drafting-card-size';
import { createSearchExperience } from './search.js?v=20261029-source-workspace';
import { createDashboard, normalizeProjectTitles, projectTitleFromSources } from './dashboard.js?v=20261029-delete-project-dialog';
import { createMaterialEditor } from './editor.js?v=20261029-revision-history';
import { saveDocuments, downloadDocument, deleteDocuments } from './documents.js?v=20261026-drafting-card-size';
import { removeProjectContent } from './project-deletion.js?v=20261026-drafting-card-size';
import { createContentPreview } from './content-preview.js?v=20261026-drafting-card-size';
import { createToolDropdowns } from './tool-dropdowns.js?v=20261026-drafting-card-size';
import { populateDraftOptions, draftPreferenceValue, hasDraftSelection } from './draft-options.js?v=20261026-drafting-card-size';
import { createNewProjectUpload } from './new-project-upload.js?v=20261026-drafting-card-size';
import { createRailNavigation } from './navigation.js?v=20261029-source-panel-open';
import { createProjectSources } from './sources.js?v=20261029-preview-direction';
import { createDraftSourcesPopover, draftSourcesFor } from './draft-sources-popover.js?v=20261026-drafting-card-size';
import { outputLoadingSelectionKeys, projectOutputs, hasSelectedSources, customVariantName, initializeVariantNames, sampleVariant, outputIsReady, outputSourceCount, selectedOutputs, selectedPendingOutputs, populateOutputContent, createOutputBadges, reviseSampleOutput, variantPanelState, renderOutputs as renderProjectOutputs } from './outputs.js?v=20261029-revision-indicator-location';
import { createEditorTabs } from './editor-tabs.js?v=20261029-revision-indicator-location';
import { createContentCardEditing } from './content-card-editing.js?v=20261026-drafting-card-size';
import { createSendDestinationDialog, isSendDestination, sendDestinations } from './send-destination.js?v=20261026-drafting-card-size';
import { createVariantFeedback, createFeedbackPill } from './variant-feedback.js?v=20261026-drafting-card-size';
import { createRevisionButton, updateRevisionButton, createRevisionRequests } from './revision-requests.js?v=20261029-revision-history';

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
let sourceImport = null;
let deferredOutputProjectId = null;
let materialMode = 'upload';
let selectedFiles = [];
let addingToProject = false;
let materialBusy = false;
const toast = createToast({ root: $('#toast'), message: $('#toast-message'), action: $('#toast-undo') });
const sourceAlreadyAdded = createSourceAlreadyAddedDialog({
  onOpenSource: (source, trigger) => projectSourcesPanel.openPreview(source, trigger),
});
let dashboard = null;
const outputTimers = new Map();
const outputViews = new Map();
populateDraftOptions(document);
const toolDropdowns = createToolDropdowns();
const newDraftDisclosure = createPanelDisclosure({ body: $('#composer-variant-form'), trigger: $('#toggle-new-variant'), panel: $('.composer-tools'), expanded: true });
const contentDisclosure = createPanelDisclosure({ body: $('#composer-outputs-body'), trigger: $('#toggle-content'), panel: $('#composer-outputs'), label: 'Content', expanded: true });
const outputTabTransition = createTabPanelTransition($('#output-status-content'));
const newProjectUpload = createNewProjectUpload({
  isBlocked: () => Boolean(sourceImport),
  async onCreate(sources) {
    if (sourceTargetProjectId) {
      const target = projects.find(project => project.id === sourceTargetProjectId && !project.deletedAt);
      if (!target) return false;
      return appendProjectSources(sources, target.id);
    } else {
      createProject(sources, { kind: 'draft', awaitingOutput: true });
      if (!window.matchMedia(breakpointQuery()).matches) railNavigation.open('sources');
    }
    return true;
  },
});
const variantFeedback = createVariantFeedback({ save: saveProjects, refreshDropdowns: toolDropdowns.refresh, closeDropdowns: toolDropdowns.close });
const revisionRequests = createRevisionRequests({
  onRevisionRead(project) { saveProjects(); editorTabs.render(project); },
  onSubmit: requestVariantRevision,
  closePanels() { draftSourcesPopover.close(); toolDropdowns.close(); richEditor.closePanels(); },
});
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
const editorTabs = createEditorTabs({ onSelect: openEditorTab, onRevisionRead(project, output) {
  saveProjects();
  const trigger = $('#editor-variant-labels').querySelector('[data-request-revision]');
  if (activeProjectId === project.id && trigger?.dataset.requestRevision === output.id) updateRevisionButton(trigger, output);
} });
const projectSourcesPanel = createProjectSources({
  onRemoveSource: removeProjectSource,
  onDownloadSource: downloadSource,
  onBeforeSelectionChange() { richEditor.flush(); },
  onSelectionChange(projectId) {
    const project = projects.find(entry => entry.id === projectId);
    if (!project) return;
    project.updatedAt = Date.now();
    saveProjects();
    if (activeProjectId === project.id) {
      if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
      updateComposerActions();
    }
  },
});
const draftSourcesPopover = createDraftSourcesPopover({
  onDownloadSource: downloadSource,
  onOpenSource: (source, trigger) => projectSourcesPanel.openPreview(source, trigger),
});
const railNavigation = createRailNavigation({
  onSourcesOpen() { renderProjectSources(projects.find(project => project.id === activeProjectId && project.kind === 'draft') || null); },
  onNewVariantOpen() { setNewVariantCollapsed(false); },
  onVariantsOpen() { setContentCollapsed(false); },
  onOpen: () => { toolDropdowns.close(); richEditor.closePanels(); draftSourcesPopover.close(); },
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
  onSendToCms: projectId => sendDestinationDialog.open(projectId),
  onContentChange: updateComposerActions,
  onToolbarChange: toolDropdowns.refresh,
  notify,
  onSave(snapshot) {
    const project = projects.find(entry => entry.id === snapshot.id);
    if (!project) return false;
    project.sources = snapshot.sources;
    const output = projectOutputs(project).find(entry => entry.id === project.selectedOutputId);
    if (output) {
      for (const key of ['title', 'shareText', 'shareTextEdited', 'document', 'draftText', 'metadata', 'updatedAt']) output[key] = snapshot[key];
      if (typeof snapshot.cmsSentContent === 'string') output.cmsSentContent = snapshot.cmsSentContent;
      project.toolPreferences = snapshot.toolPreferences;
      project.updatedAt = snapshot.updatedAt;
    } else Object.assign(project, snapshot);
    const saved = saveProjects();
    renderOutputs(project);
    return saved;
  },
});
const sendDestinationDialog = createSendDestinationDialog({
  getTarget(projectId) {
    richEditor.flush();
    const project = projects.find(entry => entry.id === projectId);
    const output = projectOutputs(project).find(entry => entry.id === project?.selectedOutputId && outputIsReady(entry));
    if (activeProjectId !== projectId || !project || project.deletedAt || project.archivedAt || project.viewOriginalDraft
      || project.outputProcessing || !output || output.needsRegeneration || !richEditor.canSend()) return null;
    return { projectId, outputId: output.id };
  },
  onSend(target, destination) {
    if (!isSendDestination(destination)) return false;
    return markVariantSentToCms(target.projectId, target.outputId);
  },
  onSent(target, destinationId) {
    const project = projects.find(entry => entry.id === target.projectId && !entry.deletedAt && !entry.archivedAt);
    const output = projectOutputs(project).find(entry => entry.id === target.outputId && outputIsReady(entry));
    const destination = sendDestinations.find(entry => entry.id === destinationId);
    if (activeProjectId === project?.id && output) variantFeedback.open(project, output, undefined, { exportUrl: destination?.url });
  },
});
const contentCardEditing = createContentCardEditing({
  getProject: () => projects.find(project => project.id === activeProjectId && !project.deletedAt),
  onDelete: outputId => deleteVariant({ projectId: activeProjectId, outputId }),
});

function renderOutputs(project) {
  draftSourcesPopover.close();
  $('#show-sources').hidden = project?.kind !== 'draft';
  const view = variantPanelState(project, outputViews.get(project?.id)).view;
  outputViews.set(project?.id, view);
  renderProjectOutputs(project, view);
  contentCardEditing.render(project);
  editorTabs.render(project);
  const selectedOutput = projectOutputs(project).find(output => output.id === project?.selectedOutputId && (outputIsReady(output) || output.needsRegeneration));
  richEditor.setRevisionBusy(Boolean(project?.outputProcessing?.kind === 'revision' && project.outputProcessing.ids.includes(selectedOutput?.id)), outputLoadingSelectionKeys(selectedOutput));
  const labels = $('#editor-variant-labels');
  labels.replaceChildren(...createOutputBadges(selectedOutput, { includeWordCount: false }));
  if (selectedOutput && outputIsReady(selectedOutput) && !selectedOutput.needsRegeneration) {
    labels.append(createRevisionButton(selectedOutput, Boolean(project?.outputProcessing)), createFeedbackPill(selectedOutput, Boolean(project?.outputProcessing)));
  }
  labels.hidden = !labels.childElementCount;
}

function selectOutputView(view) {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || !['pending', 'created'].includes(view)) return;
  if (outputViews.get(project.id) === view) return;
  outputTabTransition.run(() => {
    outputViews.set(project.id, view);
    renderOutputs(project);
    $('#output-list').scrollTop = 0;
  });
}
bindTabSelection({
  root: $('.output-status-tabs'),
  items: document.querySelectorAll('[data-output-view]'),
  getValue: tab => tab.dataset.outputView,
  panel: $('#output-status-content'),
  onSelect: selectOutputView,
});

function renderProjectSources(project, { forNewDraft = false } = {}) {
  const variant = project?.viewOriginalDraft ? null : projectOutputs(project).find(output => output.id === project?.selectedOutputId) || null;
  const result = projectSourcesPanel.render(project, { variant, forNewDraft });
  if (result?.selectionChanged) {
    saveProjects();
    updateComposerActions();
  }
}

function removeProjectSource(projectId, source) {
  richEditor.flush();
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  if (!project) return;
  const index = project.sources.indexOf(source);
  const key = sourceIdentityKey(source);
  if (index < 0 && !projectOutputs(project).some(output => draftSourcesFor(project, output).some(snapshot => sourceIdentityKey(snapshot) === key))) return;
  const before = projectOutputs(project).map(output => [output, output.selectedSourceIndexes]);
  const previousKeys = project.removedSourceKeys;
  const wasHidden = previousKeys?.includes(key);
  const updatedAt = project.updatedAt;
  project.removedSourceKeys = [...new Set([...(previousKeys || []), key])];
  if (index >= 0) {
    project.sources.splice(index, 1);
    for (const [output, indexes] of before) {
      if (Array.isArray(indexes)) output.selectedSourceIndexes = indexes.filter(value => value !== index).map(value => value > index ? value - 1 : value);
    }
  }
  project.updatedAt = Date.now();
  if (!saveProjects()) {
    if (index >= 0) project.sources.splice(index, 0, source);
    if (previousKeys === undefined) delete project.removedSourceKeys; else project.removedSourceKeys = previousKeys;
    before.forEach(([output, indexes]) => { output.selectedSourceIndexes = indexes; });
    project.updatedAt = updatedAt;
    notify('Couldn’t delete source. Try again');
    return;
  }
  renderProjectSources(project);
  if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
  updateComposerActions();
  const focus = [...$('#editor-source-list').querySelectorAll('.editor-source-more')];
  (focus[Math.min(Math.max(index, 0), focus.length - 1)] || $('#editor-add-source-button')).focus({ preventScroll: true });
  notify('Source deleted', () => {
    if (project.deletedAt || !projects.includes(project)) return;
    richEditor.flush();
    const currentIndexes = projectOutputs(project).map(output => [output, output.selectedSourceIndexes]);
    const currentKeys = project.removedSourceKeys;
    const currentUpdatedAt = project.updatedAt;
    const insertAt = index >= 0 ? Math.min(index, project.sources.length) : -1;
    if (insertAt >= 0) {
      project.sources.splice(insertAt, 0, source);
      for (const [output, indexes] of currentIndexes) {
        if (!Array.isArray(indexes)) continue;
        const restored = indexes.map(value => value >= insertAt ? value + 1 : value);
        if (before.some(([previous, values]) => previous.id === output.id && values?.includes(index))) restored.push(insertAt);
        output.selectedSourceIndexes = [...new Set(restored)].sort((a, b) => a - b);
      }
    }
    if (!wasHidden) project.removedSourceKeys = (currentKeys || []).filter(value => value !== key);
    project.updatedAt = Date.now();
    if (!saveProjects()) {
      if (insertAt >= 0) project.sources.splice(insertAt, 1);
      project.removedSourceKeys = currentKeys;
      project.updatedAt = currentUpdatedAt;
      currentIndexes.forEach(([output, indexes]) => { output.selectedSourceIndexes = indexes; });
      notify('Couldn’t restore source. Try again');
      return;
    }
    if (activeProjectId === project.id) {
      renderProjectSources(project);
      if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
      updateComposerActions();
    }
    notify('Source restored');
  });
}

function deleteVariant({ projectId, outputId }) {
  richEditor.flush();
  const persist = next => localStorage.setItem(storageKey, JSON.stringify(next));
  const refresh = () => {
    const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
    if (project && activeProjectId === projectId && !$('#composer').hidden) {
      const contentPanelOpen = $('#composer-outputs').dataset.mobileOpen === 'true';
      showEditorProject(project);
      if (contentPanelOpen && window.matchMedia(breakpointQuery()).matches) railNavigation.open('variants');
    } else {
      dashboard?.render(projects);
    }
  };
  let deletion;
  try { deletion = removeVariant(projects, projectId, outputId, persist); }
  catch { notify('Couldn’t delete draft. Try again'); return false; }
  if (!deletion) return false;
  projects = deletion.projects;
  refresh();
  notify('Draft deleted', () => {
    richEditor.flush();
    let restored;
    try { restored = restoreVariant(projects, deletion.undo, persist); }
    catch { notify('Couldn’t restore draft. Try again'); return; }
    if (!restored) { notify('Couldn’t restore draft'); return; }
    projects = restored.projects;
    refresh();
    notify('Draft restored');
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
  if (output.revisionUnread && output.revisionRequestUnread == null) output.revisionRequestUnread = true;
  output.revisionUnread = false;
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
        if (!Array.isArray(output.sourceSnapshots) && Array.isArray(output.selectedSourceIndexes)) {
          output.sourceSnapshots = draftSourcesFor(project, output).map(source => structuredClone(source));
        }
        output.sourceCount = outputSourceCount(output);
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
    notify('Storage unavailable. Changes are saved for this session only');
  }
  dashboard?.render(projects);
  return saved;
}

function notify(message, action = null) { toast.show(message, action); }

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
    title: options.title || (first?.type === 'link' ? projectTitleFromSources(sources) || 'Untitled story' : first ? titleFrom(first.title) : 'Untitled story'),
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
    editorialDirection: typeof options.editorialDirection === 'string' ? options.editorialDirection : '',
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
  editorTabs.suspend();
  draftSourcesPopover.close();
  sendDestinationDialog.close();
  toolDropdowns.close();
  richEditor.close();
  $('#show-sources').hidden = true;
  try { sessionStorage.removeItem('csa.editor.active.v1'); } catch { /* Navigation still works without storage. */ }
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  $('#composer').hidden = true;
  $('#composer').classList.remove('has-editor', 'has-output', 'has-link-cards');
  $('#output-placeholder').hidden = true;
  $('.create-variant').disabled = true;
  $('#composer-editorial-direction').value = '';
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
  if (newProjectUpload.isBusy()) return;
  sourceTargetProjectId = sourceProjectId;
  $('#new-project-dialog-title').textContent = sourceProjectId ? 'Add Source' : 'New Project';
  $('.new-project-close').setAttribute('aria-label', sourceProjectId ? 'Close add source modal' : 'Close new project modal');
  if (reset) { $('#new-project-query').value = ''; newProjectUpload.reset(); }
  $('#new-project-use-material').textContent = sourceProjectId ? 'Add to Project' : 'Start creating';
  if (!$('#new-project-dialog').open) $('#new-project-dialog').showModal();
  updateStarterInput();
  const focusTarget = window.matchMedia(breakpointQuery()).matches ? $('.new-project-close') : $('#new-project-query');
  focusTarget.focus({ preventScroll: true });
}

$('#editor-add-source-button').addEventListener('click', () => {
  const project = projects.find(entry => entry.id === activeProjectId && !entry.deletedAt && !entry.archivedAt);
  if (!project || sourceImport || newProjectUpload.isBusy()) return;
  richEditor.flush();
  richEditor.closePanels();
  contentCardEditing.close();
  railNavigation.closeTransient();
  toolDropdowns.close();
  openProjectDialog(true, project.id);
});

function returnFromSourceAddition() {
  const project = projects.find(entry => entry.id === sourceTargetProjectId);
  sourceTargetProjectId = null;
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  if ($('#material-dialog').open) $('#material-dialog').close();
  if (project) { showEditorProject(project); railNavigation.open('sources'); }
  else showHome();
}

async function appendProjectSources(sources, projectId = sourceTargetProjectId) {
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  if (!project) return false;
  let { additions, duplicates } = partitionSourceAdditions(project.sources, sources);
  sourceTargetProjectId = null;
  if ($('#new-project-dialog').open) $('#new-project-dialog').close();
  showEditorProject(project);
  railNavigation.open('sources');
  if (additions.length) {
    if (!await projectSourcesPanel.waitForAddition(project.id, additions.length === 1 ? additions[0] : null, additions.length)) return false;
    // A background addition must not reopen a project the person left or deleted.
    if (project.deletedAt || !projects.includes(project)) {
      await deleteDocuments(additions.map(source => source.attachmentId).filter(Boolean));
      return true;
    }
    const current = partitionSourceAdditions(project.sources, additions);
    additions = current.additions;
    duplicates.push(...current.duplicates);
    project.sources.push(...additions.map(source => ({ ...source, selected: true })));
    project.updatedAt = Date.now();
    saveProjects();
    if (activeProjectId === project.id && !project.archivedAt && !$('#composer').hidden) {
      renderProjectSources(project, { forNewDraft: true });
      if ($('#composer').classList.contains('has-link-cards')) searchExperience.show(project, { embedded: true });
      updateComposerActions();
    }
  }
  const retainedAttachments = new Set(project.sources.map(source => source.attachmentId).filter(Boolean));
  await deleteDocuments([...new Set(duplicates.map(source => source.attachmentId).filter(id => id && !retainedAttachments.has(id)))]);
  if (additions.length) notify(`${additions.length} ${additions.length === 1 ? 'source' : 'sources'} added`);
  if (duplicates.length && activeProjectId === project.id && !project.archivedAt) {
    sourceAlreadyAdded.open({ count: duplicates.length, source: findDuplicateSource(project.sources, duplicates[0]), trigger: $('#editor-add-source-button') });
  }
  return true;
}

function showProject(id) {
  sourceTargetProjectId = null;
  const project = projects.find((entry) => entry.id === id);
  if (!project || project.deletedAt) return;
  if (project.kind === 'links') { project.kind = 'draft'; project.linkCards = true; project.awaitingOutput = true; saveProjects(); }
  if (project.kind === 'draft') {
    richEditor.flush();
    project.toolPreferences = { format: '', audience: '', voice: '' };
    showEditorProject(project);
    return;
  }
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
  const welcome = Boolean(project.linkCards && !latestOutput);
  $('#output-placeholder').classList.toggle('has-project-welcome', welcome);
  $('#source-story-content').classList.toggle('project-welcome', welcome);
  $('#source-story-title').hidden = welcome;
  if (welcome) {
    contentPreview.hide();
    $('#source-story-title').textContent = 'Let’s start your story';
    $('#source-story-body').replaceChildren(element('p', '', 'To start, choose a Format, Audience, or Voice in the New Draft panel, then select Add to List.'));
    $('#output-placeholder').scrollTop = 0;
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
  const editableOutputs = projectOutputs(project).filter(output => outputIsReady(output) || output.needsRegeneration);
  const readyOutputs = editableOutputs.filter(outputIsReady).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
  const replacingSourceView = Boolean(project.viewOriginalDraft && editableOutputs.length);
  const selectedOutput = editableOutputs.find(output => output.id === project.selectedOutputId) || readyOutputs[0] || editableOutputs[0];
  if (selectedOutput) {
    project.selectedOutputId = selectedOutput.id;
    project.viewOriginalDraft = false;
    project.selectedOutputIds = outputIsReady(selectedOutput) && !replacingSourceView ? [selectedOutput.id] : [...new Set([...selectedPendingOutputs(project).map(output => output.id), selectedOutput.id])];
    if (outputIsReady(selectedOutput)) populateOutputContent(selectedOutput);
    saveProjects();
  }
  if (project.viewOriginalDraft || (project.awaitingOutput && !selectedOutput)) {
    $('#composer').classList.add('has-output');
    $('#composer-heading').textContent = 'Story workspace';
    renderSourceStory(project);
    $('#output-placeholder').hidden = false;
    for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = draftPreferenceValue(key, project.toolPreferences?.[key]);
    $('#main').focus({ preventScroll: true });
  } else {
    document.body.classList.add('editing-material');
    $('#composer').classList.add('has-editor');
    $('#composer-heading').textContent = 'Story editor';
    richEditor.open(selectedOutput ? { ...project, ...selectedOutput, shareText: typeof selectedOutput.shareText === 'string' ? selectedOutput.shareText : undefined, shareTextEdited: selectedOutput.shareTextEdited === true, editorialDirection: typeof selectedOutput.editorialDirection === 'string' ? selectedOutput.editorialDirection : '', id: project.id, toolPreferences: project.toolPreferences } : project);
  }
  $('#composer-editorial-direction').value = typeof project.editorialDirection === 'string' ? project.editorialDirection : '';
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
  setContentCollapsed(Boolean(project.contentCollapsed));
  closeProfile();
  document.title = `${selectedOutput?.title || project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Drafts still save to local project storage. */ }
  window.scrollTo({ top: 0 });
}

function closeProfile() {
  railNavigation.close('profile');
}

function updateComposerActions() {
  const project = projects.find(project => project.id === activeProjectId);
  const hasSources = hasSelectedSources(project);
  const hasContent = $('#composer').classList.contains('has-link-cards') ? hasSources : !$('#material-editor').hidden ? richEditor.hasContent() : !$('#output-placeholder').hidden && ($('#content-preview').hidden || contentPreview.hasContent());
  const processing = Boolean(projects.find(project => project.id === activeProjectId)?.outputProcessing);
  const canConfigure = hasContent && !processing;
  let changed = false;
  for (const key of ['format', 'audience', 'voice']) {
    const select = $(`#composer-${key}`);
    if (select.disabled !== !canConfigure) changed = true;
    select.disabled = !canConfigure;
    select.title = canConfigure ? '' : processing ? 'Drafting content…' : 'Add content first';
  }
  if (changed) toolDropdowns.refresh();
  const hasSelection = hasDraftSelection(Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, $(`#composer-${key}`).value])));
  const enabled = hasSources && hasContent && hasSelection && !processing;
  $('.create-variant').disabled = !enabled;
  $('.create-variant').title = processing ? 'Drafting content…' : !hasSources || !hasContent ? 'Select a source first' : !hasSelection ? 'Select a setting first' : 'Add to List';
}

function ensureComposerProject(allowEmpty = false) {
  let project = projects.find(entry => entry.id === activeProjectId);
  if (project || $('#composer').hidden) return project;
  const preferences = Object.fromEntries(['format', 'audience', 'voice'].map(name => [name, $(`#composer-${name}`).value]));
  const direction = $('#composer-editorial-direction').value;
  if (!allowEmpty && !Object.values(preferences).some(Boolean) && !direction.trim()) return null;
  project = createProject([], { kind: 'draft', awaitingOutput: true, toolPreferences: preferences, editorialDirection: direction, targetWordCount: $('#composer-target-word-count').value, open: false });
  activeProjectId = project.id;
  $('#show-sources').hidden = false;
  document.title = `${project.title} — CSA`;
  try { sessionStorage.setItem('csa.editor.active.v1', project.id); } catch { /* Project storage still keeps the guidance and selections. */ }
  return project;
}

function setNewVariantCollapsed(collapsed, { animate = false } = {}) {
  if (collapsed) toolDropdowns.close();
  newDraftDisclosure.setExpanded(!collapsed, { animate });
}

$('#toggle-new-variant').addEventListener('click', () => {
  const collapsed = newDraftDisclosure.expanded;
  const project = projects.find(entry => entry.id === activeProjectId);
  if (project) { project.newVariantCollapsed = collapsed; saveProjects(); }
  setNewVariantCollapsed(collapsed, { animate: true });
});

function setContentCollapsed(collapsed, { animate = false } = {}) {
  if (collapsed) { contentCardEditing.close(); draftSourcesPopover.close(); }
  contentDisclosure.setExpanded(!collapsed, { animate });
}

$('#toggle-content').addEventListener('click', () => {
  const collapsed = contentDisclosure.expanded;
  const project = projects.find(entry => entry.id === activeProjectId);
  if (project) { project.contentCollapsed = collapsed; saveProjects(); }
  setContentCollapsed(collapsed, { animate: true });
});

$('.create-variant').addEventListener('click', () => {
  if ($('.create-variant').disabled) return;
  const selections = ['format', 'audience', 'voice'].flatMap(key => {
    const select = $(`#composer-${key}`);
    return select.value ? [{ key, value: select.value, label: select.options[select.selectedIndex].textContent }] : [];
  });
  richEditor.flush();
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project || project.outputProcessing || !hasSelectedSources(project) || !hasDraftSelection(Object.fromEntries(['format', 'audience', 'voice'].map(key => [key, $(`#composer-${key}`).value])))) return;
  project.editorialDirection = $('#composer-editorial-direction').value;
  setProjectWordCount(project, $('#composer-target-word-count').value);
  const output = sampleVariant(project, selections);
  project.lastPendingOutputId = output.id;
  project.selectedOutputIds = [...selectedPendingOutputs(project).map(entry => entry.id), output.id];
  project.selectedOutputId = null;
  project.viewOriginalDraft = true;
  delete project.variantPreset;
  project.outputs = [output, ...projectOutputs(project)];
  outputViews.set(project.id, 'pending');
  project.newVariantCollapsed = false;
  setNewVariantCollapsed(false);
  project.toolPreferences = { format: '', audience: '', voice: '' };
  project.editorialDirection = '';
  $('#composer-editorial-direction').value = '';
  for (const key of ['format', 'audience', 'voice']) $(`#composer-${key}`).value = '';
  toolDropdowns.close();
  toolDropdowns.refresh();
  updateComposerActions();
  project.updatedAt = Date.now();
  saveProjects();
  showEditorProject(project);
  if (window.matchMedia(breakpointQuery()).matches) railNavigation.open('newVariant');
  $('#composer-format-trigger')?.focus({ preventScroll: true });
});

$('#output-list').addEventListener('click', event => {
  const project = projects.find(entry => entry.id === activeProjectId);
  if (!project) return;
  const sources = event.target.closest('[data-variant-sources]');
  if (sources) { openVariantSources(sources); return; }
  if (event.target.closest('.output-card-actions')) return;
  const card = event.target.closest('.output-card')?.querySelector('.output-open');
  if (!card || card.disabled) return;
  const output = projectOutputs(project).find(entry => entry.id === card.dataset.outputId);
  if (!output || project.outputProcessing) return;
  if (!outputIsReady(output)) {
    richEditor.flush();
    const ids = new Set(selectedPendingOutputs(project).map(entry => entry.id));
    if (ids.has(output.id)) ids.delete(output.id); else ids.add(output.id);
    project.selectedOutputIds = [...ids];
    saveProjects();
    const restoreFocus = document.activeElement === card;
    renderOutputs(project);
    if (restoreFocus) [...$('#output-list').querySelectorAll('.output-open')].find(button => button.dataset.outputId === output.id)?.focus({ preventScroll: true });
    return;
  }
  railNavigation.closeTransient();
  openEditorTab(output.id);
});

function openVariantSources(button) {
  const outputId = button.dataset.variantSources;
  const container = button.closest('#editor-variant-labels') || button.closest('#output-list');
  const wasOpen = button.getAttribute('aria-expanded') === 'true';
  richEditor.flush();
  toolDropdowns.close();
  richEditor.closePanels();
  const project = projects.find(entry => entry.id === activeProjectId && !entry.deletedAt && !entry.archivedAt);
  const output = projectOutputs(project).find(entry => entry.id === outputId);
  const trigger = button.isConnected ? button : [...(container?.querySelectorAll('[data-variant-sources]') || [])].find(entry => entry.dataset.variantSources === outputId);
  if (!project || !output || !trigger) { draftSourcesPopover.close(); return; }
  if (wasOpen && !draftSourcesPopover.isOpen) { trigger.focus({ preventScroll: true }); return; }
  draftSourcesPopover.toggle(trigger, { project, output });
}

$('#editor-variant-labels').addEventListener('click', event => {
  const feedback = event.target.closest('[data-variant-feedback]');
  if (feedback) {
    richEditor.flush();
    const project = projects.find(entry => entry.id === activeProjectId && !entry.deletedAt && !entry.archivedAt);
    const output = projectOutputs(project).find(entry => entry.id === feedback.dataset.variantFeedback && outputIsReady(entry) && !entry.needsRegeneration);
    if (output && !project.outputProcessing) {
      toolDropdowns.close();
      richEditor.closePanels();
      variantFeedback.open(project, output, feedback.dataset.feedbackRating);
    }
    return;
  }
  const revision = event.target.closest('[data-request-revision]');
  if (revision) {
    richEditor.flush();
    const project = projects.find(entry => entry.id === activeProjectId && !entry.deletedAt && !entry.archivedAt);
    const output = projectOutputs(project).find(entry => entry.id === revision.dataset.requestRevision && outputIsReady(entry) && !entry.needsRegeneration);
    if (output && !project.outputProcessing) revisionRequests.open(project, output);
    return;
  }
  const button = event.target.closest('[data-variant-sources]');
  if (button) openVariantSources(button);
});

function requestVariantRevision({ projectId, outputId, instructions }) {
  richEditor.flush();
  const project = projects.find(entry => entry.id === projectId && entry.id === activeProjectId && !entry.deletedAt && !entry.archivedAt);
  const output = projectOutputs(project).find(entry => entry.id === outputId && outputIsReady(entry) && !entry.needsRegeneration);
  const text = typeof instructions === 'string' ? instructions.trim() : '';
  if (!output || project.outputProcessing || !text || text.length > 8000) return false;
  const requestedAt = Date.now();
  const previousUpdatedAt = project.updatedAt;
  project.updatedAt = requestedAt;
  project.outputProcessing = { kind: 'revision', ids: [outputId], openOutputId: outputId, instructions: text, requestedAt, readyAt: requestedAt + tokenNumber('component.drafting.revision-duration') };
  if (!saveProjects()) { delete project.outputProcessing; project.updatedAt = previousUpdatedAt; return false; }
  outputViews.set(project.id, 'created');
  renderOutputs(project);
  updateComposerActions();
  resumeOutputProcessing(project);
  requestAnimationFrame(() => {
    const list = $('#output-list');
    const card = list.querySelector('[data-revising="true"]');
    if (!card) return;
    const viewport = list.getBoundingClientRect();
    const bounds = card.getBoundingClientRect();
    const inset = tokenNumber('foundation.space.3');
    if (bounds.top < viewport.top) list.scrollTop += bounds.top - viewport.top - inset;
    else if (bounds.bottom > viewport.bottom) list.scrollTop += bounds.bottom - viewport.bottom + inset;
  });
  return true;
}

function finishOutputProcessing(project, renderWhenReady = true) {
  const job = project.outputProcessing;
  if (!job) return;
  clearTimeout(outputTimers.get(project.id));
  outputTimers.delete(project.id);
  const ids = new Set(job.ids);
  project.selectedOutputIds = [...new Set([...selectedOutputs(project).map(output => output.id), ...ids])];
  const active = activeProjectId === project.id && !$('#composer').hidden;
  const deferRender = $('#new-project-dialog').open || sourceImport || newProjectUpload.isBusy();
  if (active && !deferRender) richEditor.close();
  for (const output of projectOutputs(project)) {
    if (ids.has(output.id)) {
      if (job.kind === 'revision') reviseSampleOutput(output, job.instructions, job.requestedAt);
      else { output.status = 'ready'; delete output.needsRegeneration; output.processedAt = Date.now(); populateOutputContent(output); }
    }
  }
  const latestCreated = projectOutputs(project).find(output => output.id === job.openOutputId && outputIsReady(output)) || projectOutputs(project).filter(output => ids.has(output.id) && outputIsReady(output)).sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))[0];
  if (latestCreated) outputViews.set(project.id, 'created');
  if (latestCreated && job.kind !== 'revision') { project.selectedOutputId = latestCreated.id; project.viewOriginalDraft = false; }
  delete project.selectedPendingOutputIds;
  delete project.outputProcessing;
  if (job.kind === 'revision') project.updatedAt = Date.now();
  saveProjects();
  if (active && renderWhenReady) {
    if (deferRender) deferredOutputProjectId = project.id;
    else { railNavigation.closeTransient(); showEditorProject(project); }
  }
  if (job.kind === 'revision') notify('Revision complete');
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
  project.outputProcessing = { ids: outputs.map(output => output.id), openOutputId: outputs[0].id, readyAt: Date.now() + tokenNumber('component.drafting.processing-duration') };
  saveProjects();
  renderOutputs(project);
  updateComposerActions();
  resumeOutputProcessing(project);
});

$('#composer-editorial-direction').addEventListener('input', () => {
  const project = ensureComposerProject();
  if (!project) return;
  project.editorialDirection = $('#composer-editorial-direction').value;
  project.updatedAt = Date.now();
  saveProjects();
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

async function submitSource(input) {
  const parsed = parseSourceLinks(input);
  if (!parsed || sourceImport || newProjectUpload.isBusy()) return false;
  const urls = [...new Set(parsed)];
  const targetProjectId = sourceTargetProjectId;
  const originProjectId = activeProjectId;
  if (targetProjectId && !projects.some(project => project.id === targetProjectId && !project.deletedAt)) return false;
  const dialog = $('#new-project-dialog');
  const fromDialog = dialog.open;
  const request = { controller: new AbortController() };
  sourceImport = request;
  const controls = [...document.querySelectorAll('#new-project-dialog button, #new-project-dialog input, #new-project-dialog textarea, #start-form button, #start-form input, #source-input, .results-search-form button, .results-search-form input')].map(control => [control, control.disabled]);
  for (const [control] of controls) control.disabled = true;
  const button = $('#new-project-submit');
  const label = button.textContent;
  button.textContent = 'Reading articles…';
  dialog.setAttribute('aria-busy', 'true');
  $('#new-project-drop-zone').setAttribute('aria-disabled', 'true');
  $('#new-project-link-status').textContent = 'Reading article headlines';
  try {
    let metadata;
    try { metadata = await resolveArticleMetadata(urls, { signal: request.controller.signal }); }
    catch { metadata = urls.map(url => ({ url, metadataStatus: 'fallback', headlineSource: 'url' })); }
    if (request.controller.signal.aborted || sourceImport !== request
      || sourceTargetProjectId !== targetProjectId || activeProjectId !== originProjectId
      || (fromDialog && !dialog.open)) return false;
    const sources = sourceLinkArticles(metadata).map(article => ({
      type: 'link', title: article.title, url: article.url,
      description: article.description || '', excerpt: article.excerpt,
      headlineSource: article.headlineSource || 'url', metadataStatus: article.metadataStatus || 'fallback',
      selected: true, addedToCsa: false,
    }));
    if (targetProjectId) {
      const target = projects.find(project => project.id === targetProjectId && !project.deletedAt);
      if (!target) return false;
      if (dialog.open) dialog.close();
      return await appendProjectSources(sources, targetProjectId);
    } else {
      if (dialog.open) dialog.close();
      const project = createProject([], { title: projectTitleFromSources(sources) || 'Untitled story', kind: 'draft', awaitingOutput: true, linkCards: true, open: false });
      return await appendProjectSources(sources, project.id);
    }
    return true;
  } finally {
    if (sourceImport === request) sourceImport = null;
    button.textContent = label;
    dialog.removeAttribute('aria-busy');
    $('#new-project-drop-zone').removeAttribute('aria-disabled');
    $('#new-project-link-status').textContent = '';
    for (const [control, disabled] of controls) control.disabled = disabled;
    if (fromDialog && !dialog.open) newProjectUpload.reset();
    updateStarterInput();
    renderDeferredOutput();
  }
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
  $('#new-project-submit').disabled = newProjectUpload.isBusy() || !valid;
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
  if (newProjectUpload.isBusy() || !updateStarterInput()) return;
  const input = $('#new-project-query').value.trim();
  void submitSource(input);
});
async function downloadSource(source) {
  try { await downloadDocument(source); }
  catch (error) { notify(error.message || 'Couldn’t download document. Try again'); }
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
    if (sourceTargetProjectId) { await appendProjectSources(sources); return; }
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

function renderDeferredOutput() {
  if (!deferredOutputProjectId || $('#new-project-dialog').open || sourceImport || newProjectUpload.isBusy()) return;
  const projectId = deferredOutputProjectId;
  deferredOutputProjectId = null;
  const project = projects.find(entry => entry.id === projectId && !entry.deletedAt);
  if (project && activeProjectId === projectId && !$('#composer').hidden) showEditorProject(project);
}
$('#new-project-dialog').addEventListener('close', () => { newProjectUpload.reset(); renderDeferredOutput(); });
for (const id of ['material-dialog', 'new-project-dialog']) $(`#${id}`).addEventListener('cancel', event => {
  if (id === 'new-project-dialog' && newProjectUpload.isBusy()) { event.preventDefault(); return; }
  if (sourceTargetProjectId && !materialBusy) { event.preventDefault(); returnFromSourceAddition(); }
});

for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => {
  if (button.dataset.close === 'new-project-dialog' && newProjectUpload.isBusy()) return;
  if (button.dataset.close === 'delete-project-dialog' && $('#delete-project-dialog').getAttribute('aria-busy') === 'true') return;
  if (sourceTargetProjectId && ['new-project-dialog', 'material-dialog'].includes(button.dataset.close)) returnFromSourceAddition();
  else $(`#${button.dataset.close}`).close();
});
for (const dialog of document.querySelectorAll('dialog')) {
  if (dialog.id === 'article-preview-dialog') continue;
  dialog.addEventListener('click', (event) => {
    if (dialog.id === 'delete-project-dialog' && dialog.getAttribute('aria-busy') === 'true') return;
    if (dialog.id === 'send-destination-dialog' && dialog.dataset.busy === 'true') return;
    if (dialog.id === 'new-project-dialog' && newProjectUpload.isBusy()) return;
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
  onOpenSource: (source, trigger) => projectSourcesPanel.openPreview(source, trigger),
  onDuplicateSource(trigger, article) {
    const project = projects.find(entry => entry.id === activeProjectId);
    const source = project?.sources.find(source => source.url === article?.url);
    sourceAlreadyAdded.open({ source, trigger });
  },
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
        project.sources.filter(source => source.type === 'link').forEach((source, index) => {
          const id = `link-${index + 1}`;
          source.selected = selection.includes(id);
          if (Array.isArray(addedArticleIds)) source.addedToCsa = addedArticleIds.includes(id);
        });
        updateComposerActions();
        if ($('#show-sources').getAttribute('aria-expanded') === 'true') renderProjectSources(project);
      }
      saveProjects();
    }
  },
  async onDraft({ query, articles, editorialDirection }) {
    const sources = articles.map((article) => article.url
      ? { type: 'link', title: article.title, url: article.url, excerpt: article.excerpt, description: article.description || '', headlineSource: article.headlineSource, metadataStatus: article.metadataStatus }
      : { type: 'text', title: article.title, text: `Fictional sample article · ${article.source} · ${article.date}\n\n${article.paragraphs.join('\n\n')}` });
    if (sourceTargetProjectId) { await appendProjectSources(sources); return; }
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
  notify(destination === 'archive' ? 'Project archived' : 'Project moved to Trash', () => {
    Object.assign(project, previous);
    saveProjects();
    notify('Project restored');
  });
}

function markVariantSentToCms(projectId, outputId) {
  const project = projects.find(entry => entry.id === projectId);
  const variant = projectOutputs(project).find(output => output.id === project?.selectedOutputId && outputIsReady(output));
  if (!project || activeProjectId !== projectId || project.deletedAt || project.archivedAt || project.viewOriginalDraft
    || project.outputProcessing || !variant || variant.id !== outputId || variant.needsRegeneration) return false;
  if (!richEditor.canSend()) return false;
  variant.cmsSentAt = Date.now();
  variant.cmsSentContent = richEditor.markSent();
  project.updatedAt = variant.cmsSentAt;
  const saved = saveProjects();
  editorTabs.render(project);
  notify(saved ? 'Draft marked as sent (demo). CMS isn’t connected' : 'Draft marked as sent for this session only (demo). CMS isn’t connected');
  return true;
}




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
    notify('Project deleted. Some uploaded files remain in browser storage');
    return true;
  }
  notify('Project permanently deleted');
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
