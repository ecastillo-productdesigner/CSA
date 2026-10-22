import { createIcon } from './icons.js?v=20261021-segment-case';
import { fictionalArticleParagraphs, sourceLinkArticles } from './source-links.js?v=20261021-segment-case';
// Sample content for the results-screen prototype. No live news requests are made.
function sampleArticles(query) {
  const isKelly = /^kelly\s+clarkson$/i.test(query.trim());
  const previewParagraphs = fictionalArticleParagraphs(query);
  const referenceTitle = 'Kelly Clarkson, a local business and the return of social media beef';
  const referenceSnippet = '"Kelly Clarkson is, by no intended pun, an American-made celebrity brand, created by Americans, who voted her into the entertainment industry via \'American Idol\' and bear';
  const titles = [
    `${query}, a local business and the return of social media buzz`,
    `${query} shares a look behind the scenes of a new creative project`,
    `Why ${query} is inspiring new pop culture conversations`,
    `${query} talks creativity, memories and what comes next`,
    `A closer look at ${query} and the stories behind the spotlight`,
    `${query} takes a fresh approach to a familiar creative challenge`,
    `The moments that shaped the conversation around ${query}`,
    `What's next for ${query}? A look at the latest creative ideas`,
  ];
  return titles.map((title, index) => ({
    id: `article-${index + 1}`,
    title: isKelly && index < 4 ? referenceTitle : title,
    excerpt: isKelly && index < 4 ? referenceSnippet : `A sample article about ${query}, exploring creative projects, memorable moments and the conversations around them. This placeholder shows how a story summary will appear in CSA.`,
    source: index < 4 ? 'The State' : ['The State', 'Culture Weekly', 'Spotlight', 'Culture Weekly'][index - 4],
    date: `2026-10-${index < 4 ? '12' : String(15 - index).padStart(2, '0')}`,
    referenceImage: isKelly,
    paragraphs: [
      [
        previewParagraphs[0],
        `In this fictional story, ${query} offers a behind-the-scenes look at a creative project that started with a simple question: what happens when a familiar idea is tried in a different way?`,
        `This fictional article explores the conversation around ${query}, following a small collaboration that gives people a new reason to talk about creativity and community.`,
        `In this fictional story, ${query} looks back at the ordinary moments that can become the beginning of something memorable. A shared interest brings a small group together for a new creative experiment.`,
      ][index % 4],
      ...previewParagraphs.slice(1),
    ],
  }));
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function sourceMetadata(label, value, className = '') {
  const line = node('span', className);
  line.append(node('span', 'source-metadata-label', `${label}: `), document.createTextNode(value));
  return line;
}

function dateLabel(value) {
  if (!value) return 'Not available';
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function createSearchExperience({ onSearch, onSelectionChange, onDirectionChange, onDraft }) {
  const $ = (selector) => document.querySelector(selector);
  const results = $('#search-results');
  const resultsHome = results.parentElement;
  let state = null;
  let previewArticle = null;
  const additionTimers = new Map();
  const preview = $('#article-preview-dialog');

  function clearAdditionTimers() {
    for (const timer of additionTimers.values()) clearTimeout(timer);
    additionTimers.clear();
  }

  function renderAddition(container, article) {
    container.replaceChildren();
    const selected = state.selected.has(article.id);
    const ready = state.readyArticleIds.has(article.id);
    const item = container.closest('.result-item');
    const inspect = item.querySelector('.result-inspect-button');
    const canInspect = Boolean(article.url) || ready;
    inspect.disabled = !canInspect;
    inspect.hidden = !canInspect;
    const separator = item.querySelector('.result-inspect-separator');
    if (separator) separator.hidden = !canInspect;
    inspect.title = canInspect ? 'Preview Article' : selected ? 'Adding to CSA' : 'Select this story to inspect';
    container.hidden = !selected;
    const loading = selected && !ready;
    container.classList.toggle('is-loading', loading);
    item.querySelector('.result-add-button')?.setAttribute('aria-busy', String(loading));
    if (ready) container.append(node('span', 'visually-hidden', article.url ? 'Link selected.' : 'Added to CSA. Inspect article is ready.'));
    else if (selected) {
      const adding = node('span', 'result-adding');
      const spinner = node('span', 'output-processing-spinner');
      spinner.setAttribute('aria-hidden', 'true');
      adding.append(spinner, node('span', 'output-creating-label', 'Adding to CSA'));
      container.append(adding);
    }
  }

  function startAddition(id) {
    if (!state.readyArticleIds.has(id) && !additionTimers.has(id)) {
      const selectionState = state;
      additionTimers.set(id, setTimeout(() => {
        additionTimers.delete(id);
        if (state !== selectionState || !state.selected.has(id)) return;
        state.readyArticleIds.add(id);
        onSelectionChange(state.projectId, [...state.selected], [...state.readyArticleIds]);
        const container = $('#result-list').querySelector(`[data-addition-article-id="${id}"]`);
        const article = state.articles.find(article => article.id === id);
        if (container && article) renderAddition(container, article);
      }, 3000));
    }
  }

  function toggleSelection(id) {
    if (state.selected.has(id)) {
      state.selected.delete(id);
      clearTimeout(additionTimers.get(id));
      additionTimers.delete(id);
    } else {
      state.selected.add(id);
      if (state.linkResults) state.readyArticleIds.delete(id);
      startAddition(id);
    }
    onSelectionChange(state.projectId, [...state.selected], [...state.readyArticleIds]);
    render();
    $('#result-list').querySelector(`[data-article-id="${id}"] .result-select-button`)?.focus({ preventScroll: true });
  }

  function addLinkedArticle(id) {
    if (!state || additionTimers.has(id)) return;
    state.selected.add(id);
    state.readyArticleIds.delete(id);
    startAddition(id);
    onSelectionChange(state.projectId, [...state.selected], [...state.readyArticleIds]);
    render();
    $('#result-list').querySelector(`[data-add-article-id="${id}"]`)?.focus({ preventScroll: true });
  }

  function openPreview(id) {
    const article = state?.articles.find(article => article.id === id);
    if (!article || (!article.url && !state.readyArticleIds.has(id))) return;
    previewArticle = { ...article, projectId: state.projectId };
    document.querySelector('.article-preview-badge').textContent = 'Fictional article preview';
    $('#article-preview-notice').hidden = false;
    $('#article-preview-meta').hidden = false;
    $('#article-preview-title').textContent = article.title;
    if (article.url) {
      $('#article-preview-meta').replaceChildren(
        sourceMetadata('Publish Date', dateLabel(article.date)),
        sourceMetadata('URL', article.url),
      );
    } else $('#article-preview-meta').textContent = `${article.source} · ${dateLabel(article.date)}`;
    // Link cards have no fetched article text. Keep the requested demo preview
    // explicitly fictional without saving sample copy into the source.
    const paragraphs = article.paragraphs.length ? article.paragraphs : fictionalArticleParagraphs(article.title);
    $('#article-preview-body').replaceChildren(...paragraphs.map(paragraph => node('p', '', paragraph)));
    preview.showModal();
    $('#article-preview-body').scrollTop = 0;
  }

  preview.addEventListener('close', () => {
    if (state?.projectId === previewArticle?.projectId && !$('#search-results').hidden) {
      $('#result-list').querySelector(`[data-inspect-article-id="${previewArticle.id}"]`)?.focus({ preventScroll: true });
    }
    previewArticle = null;
  });

  function filteredArticles() {
    const query = state.query.toLowerCase();
    const terms = [...new Set(query.split(/\s+/).filter(Boolean))];
    const relevance = article => {
      const title = article.title.toLowerCase();
      const excerpt = article.excerpt.toLowerCase();
      return terms.reduce((score, term) => score + (title.includes(term) ? 3 : 0) + (excerpt.includes(term) ? 1 : 0), title.startsWith(query) ? 2 : 0);
    };
    return state.articles.filter((article) =>
      (state.source === 'all' || article.source === state.source) &&
      (!state.after || article.date >= state.after)
    ).sort((a, b) => state.sort === 'relevance' ? relevance(b) - relevance(a) : state.sort === 'newest' ? (b.date || '').localeCompare(a.date || '') : (a.date || '').localeCompare(b.date || ''));
  }

  function chosenArticles() {
    return state.articles.filter(article => state.selected.has(article.id));
  }

  function render() {
    if (!state) return;
    const filtered = filteredArticles();
    const visible = filtered.slice(0, state.visibleCount);
    $('#results-count').textContent = state.linkResults
      ? `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'link' : 'links'}`
      : `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'story' : 'stories'} found`;
    const list = $('#result-list');
    list.replaceChildren(...visible.map((article) => {
      const item = node('li', 'result-item');
      const card = node('div', `result-card${article.url ? ' result-card--link' : ''}`);
      card.dataset.articleId = article.id;
      card.dataset.selected = String(state.selected.has(article.id));
      const selection = node('button', 'result-select-button');
      selection.type = 'button';
      selection.setAttribute('aria-label', `Select story ${article.id.split('-').pop()}: ${article.title}`);
      selection.setAttribute('role', 'checkbox');
      selection.setAttribute('aria-checked', String(state.selected.has(article.id)));
      const indicator = node('span', 'result-selection-indicator');
      indicator.setAttribute('aria-hidden', 'true');
      selection.title = state.selected.has(article.id) ? 'Unselect this story' : 'Select this story for your draft';
      const thumbnail = node('span', `result-thumbnail${article.referenceImage ? ' result-thumbnail--reference' : ''}`);
      thumbnail.setAttribute('aria-hidden', 'true');
      if (!article.referenceImage) thumbnail.append(node('span', 'material-symbols-outlined', 'photo_camera'));
      const copy = node('span', 'result-copy');
      const meta = node('span', 'result-meta');
      const publication = node('span', 'result-publication', article.source);
      const inspect = node('button', 'result-inspect-button');
      inspect.type = 'button';
      inspect.dataset.inspectArticleId = article.id;
      inspect.setAttribute('aria-label', `Preview Article: ${article.title}`);
      inspect.setAttribute('aria-haspopup', 'dialog');
      inspect.setAttribute('aria-controls', 'article-preview-dialog');
      const eye = createIcon('visibility');
      inspect.append(eye);
      const separator = node('span', 'result-inspect-separator', '|');
      separator.setAttribute('aria-hidden', 'true');
      if (!article.url) publication.append(separator, inspect);
      const title = node('strong', 'result-title', article.title);
      const snippet = node('span', 'result-snippet', article.excerpt);
      if (article.url) {
        copy.append(title, snippet,
          sourceMetadata('Publish Date', dateLabel(article.date), 'result-date'),
          sourceMetadata('URL', article.url, 'result-url'));
      } else {
        const date = node('span', 'result-date');
        date.append(node('span', 'result-date-label', 'Published date: '), document.createTextNode(dateLabel(article.date)), node('span', 'result-date-separator', ' |'));
        meta.append(date, publication);
        copy.append(meta, title, snippet);
      }
      if (article.url) {
        const add = node('button', 'result-add-button');
        add.type = 'button';
        add.dataset.addArticleId = article.id;
        add.setAttribute('aria-label', `Add Article to CSA: ${article.title}`);
        add.setAttribute('aria-describedby', `source-addition-${article.id}`);
        card.append(add, selection, indicator, copy);
      } else card.append(selection, indicator, thumbnail, copy);
      const previewButton = node(article.url ? 'a' : 'button', 'icon-button result-preview-button');
      if (article.url) {
        previewButton.href = article.url;
        previewButton.target = '_blank';
        previewButton.rel = 'noopener noreferrer';
      } else {
        previewButton.type = 'button';
        previewButton.disabled = true;
      }
      previewButton.dataset.previewArticleId = article.id;
      previewButton.setAttribute('aria-label', `${article.url ? 'Open source' : 'Preview story'} ${article.id.split('-').pop()}: ${article.title}${article.url ? ' (opens in a new tab)' : ''}`);
      previewButton.title = article.url ? 'Open source in a new tab' : 'Article preview';
      const svg = createIcon('open_in_new');
      previewButton.append(svg);
      if (article.url) {
        const actions = node('div', 'result-actions');
        actions.setAttribute('role', 'group');
        actions.setAttribute('aria-label', 'Source actions');
        actions.append(inspect, previewButton);
        item.append(card, actions);
      } else item.append(card, previewButton);
      const addition = node('div', 'result-addition');
      addition.dataset.additionArticleId = article.id;
      addition.id = `source-addition-${article.id}`;
      addition.setAttribute('role', 'status');
      addition.setAttribute('aria-live', 'polite');
      addition.setAttribute('aria-atomic', 'true');
      card.append(addition);
      renderAddition(addition, article);
      return item;
    }));
    $('#results-empty').hidden = filtered.length > 0;
    $('#load-more').hidden = state.linkResults || filtered.length === 0;
    $('#load-more').disabled = visible.length >= filtered.length;
    $('#load-more').textContent = visible.length >= filtered.length ? 'All Results Shown' : 'Load More';
    const chosen = chosenArticles();
    $('#create-draft').disabled = chosen.length === 0;
    $('#create-draft').title = chosen.length ? `${state.addingSources ? 'Add' : 'Draft from'} ${chosen.length} selected ${chosen.length === 1 ? 'story' : 'stories'}` : `Select at least one story to ${state.addingSources ? 'add a source' : 'create a draft'}`;
    $('#results-selection').hidden = state.selected.size === 0;
    $('#results-selection').textContent = `${state.selected.size} ${state.selected.size === 1 ? 'story' : 'stories'} selected`;
  }

  $('#results-search-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const query = $('#results-query').value.trim();
    if (query) onSearch(query);
  });
  $('#results-query').addEventListener('input', () => { $('#results-search-button').disabled = !$('#results-query').value.trim(); });
  $('#results-sort').addEventListener('change', () => { if (state) { state.sort = $('#results-sort').value; render(); } });
  $('#results-source').addEventListener('change', () => { if (state) { state.source = $('#results-source').value; state.visibleCount = 4; render(); } });
  $('#results-after').addEventListener('change', () => { if (state) { state.after = $('#results-after').value; state.visibleCount = 4; render(); } });
  $('#results-reset-filters').addEventListener('click', () => {
    if (!state) return;
    state.source = 'all'; state.after = ''; state.visibleCount = 4;
    $('#results-source').value = 'all'; $('#results-after').value = '';
    render();
  });
  $('#results-toggle-filters').addEventListener('click', () => {
    const expanded = $('#results-filter-panel').hidden;
    $('#results-filter-panel').hidden = !expanded;
    $('#results-toggle-filters').setAttribute('aria-expanded', String(expanded));
    if (expanded) $('#results-source').focus();
  });
  $('#results-editorial-direction').addEventListener('input', () => {
    if (!state) return;
    state.editorialDirection = $('#results-editorial-direction').value;
    onDirectionChange(state.projectId, state.editorialDirection);
  });
  $('#load-more').addEventListener('click', () => { if (state) { state.visibleCount += 4; render(); } });
  $('#result-list').addEventListener('click', (event) => {
    const inspect = event.target.closest('.result-inspect-button');
    if (inspect) { openPreview(inspect.dataset.inspectArticleId); return; }
    const previewButton = event.target.closest('.result-preview-button');
    if (previewButton) return;
    const card = event.target.closest('.result-card');
    if (!card || !state) return;
    const id = card.dataset.articleId;
    if (state.linkResults && !event.target.closest('.result-select-button')) addLinkedArticle(id);
    else toggleSelection(id);
  });
  $('#create-draft').addEventListener('click', () => {
    if (!state) return;
    const articles = chosenArticles();
    if (articles.length) onDraft({ query: state.query, articles, editorialDirection: state.editorialDirection });
  });

  return {
    show(project, { addingSources = false, embedded = false } = {}) {
      clearAdditionTimers();
      const linkResults = embedded || project.kind === 'links';
      const linkSources = project.sources.filter(source => source.type === 'link');
      const query = linkResults ? linkSources.map(source => source.url).join(' ') : project.sources[0].title;
      const articles = linkResults ? sourceLinkArticles(linkSources.map(source => source.url)) : sampleArticles(query);
      const savedSelection = embedded ? linkSources.flatMap((source, index) => source.selected !== false ? [`link-${index + 1}`] : []) : Array.isArray(project.selectedArticleIds) ? project.selectedArticleIds : [];
      const selected = new Set(savedSelection.filter(id => articles.some(article => article.id === id)));
      const savedAdded = Array.isArray(project.addedArticleIds) ? project.addedArticleIds : savedSelection;
      const readyArticleIds = new Set((linkResults ? savedSelection : savedAdded).filter(id => articles.some(article => article.id === id)));
      state = { projectId: project.id, addingSources, linkResults, query, articles, editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '', sort: 'newest', source: 'all', after: '', visibleCount: linkResults ? articles.length : 4, selected, readyArticleIds };
      $('#create-draft').textContent = addingSources ? 'Add Sources' : 'Draft';
      $('.results-direction').hidden = addingSources || embedded;
      $('.results-actions').hidden = embedded;
      $('.results-search-form').hidden = embedded;
      $('.results-toolbar').hidden = embedded;
      (embedded ? $('#editor-canvas-content') : resultsHome).append(results);
      results.classList.toggle('link-cards-panel', embedded);
      $('#results-help').textContent = embedded ? 'Select sources and choose a format to enable Add Content.' : addingSources ? 'Select at least one article to add it to your project.' : 'Select at least one article to enable Draft.';
      $('#search-results').hidden = false;
      $('#results-heading').textContent = embedded ? 'Ready to Create Content' : linkResults ? 'Choose sources from your links' : `Search results for ${query}`;
      $('#results-heading').classList.toggle('visually-hidden', !embedded);
      $('.results-sort').hidden = linkResults;
      $('#results-toggle-filters').hidden = linkResults;
      $('#results-query').value = query;
      $('#results-editorial-direction').value = state.editorialDirection;
      $('#results-search-button').disabled = false;
      $('#results-sort').value = 'newest';
      $('#results-sort').dispatchEvent(new Event('change', { bubbles: true }));
      $('#results-source').replaceChildren(node('option', '', 'All sources'), ...[...new Set(articles.map((article) => article.source))].map((source) => {
        const option = node('option', '', source); option.value = source; return option;
      }));
      $('#results-source').options[0].value = 'all';
      $('#results-after').value = '';
      $('#results-filter-panel').hidden = true;
      $('#results-toggle-filters').setAttribute('aria-expanded', 'false');
      render();
      if (!linkResults) for (const id of selected) startAddition(id);
    },
    hide() { clearAdditionTimers(); if (preview.open) preview.close(); previewArticle = null; state = null; $('#search-results').hidden = true; },
  };
}
