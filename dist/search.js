import { createIcon } from './icons.js?v=20261020-material-symbols';
// Sample content for the results-screen prototype. No live news requests are made.
function sampleArticles(query) {
  const isKelly = /^kelly\s+clarkson$/i.test(query.trim());
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
        `In this fictional story, a neighborhood business becomes an unexpected part of the conversation around ${query}. What begins as a small creative idea draws attention to the people and everyday places behind it.`,
        `In this fictional story, ${query} offers a behind-the-scenes look at a creative project that started with a simple question: what happens when a familiar idea is tried in a different way?`,
        `This fictional article explores the conversation around ${query}, following a small collaboration that gives people a new reason to talk about creativity and community.`,
        `In this fictional story, ${query} looks back at the ordinary moments that can become the beginning of something memorable. A shared interest brings a small group together for a new creative experiment.`,
      ][index % 4],
      'The first meeting takes place in a modest shared workspace, where sketches, notebooks, and half-finished ideas cover a long table. The group agrees to try one small experiment before deciding what the larger project should become.',
      'Each participant contributes a different perspective. One focuses on the visual details, another on the story behind the idea, and a third considers how neighbors might take part. Their early conversations help turn a loose concept into a practical plan.',
      'A short rehearsal gives the team a chance to see what works. They simplify a few details, leave room for improvisation, and discover that the quieter moments connect most strongly with their small test audience.',
      'The project ends with plans for another gathering. Its lasting effect is the connection between the people involved, and the reminder that a compelling story can begin with curiosity, a familiar place, and a willingness to try something new.',
    ],
  }));
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function dateLabel(value) {
  return new Date(`${value}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export function createSearchExperience({ onSearch, onSelectionChange, onDirectionChange, onDraft }) {
  const $ = (selector) => document.querySelector(selector);
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
    const inspect = container.closest('.result-card').querySelector('.result-inspect-button');
    inspect.disabled = !ready;
    inspect.hidden = !ready;
    inspect.previousElementSibling.hidden = !ready;
    inspect.title = ready ? 'Inspect article' : selected ? 'Adding to CSA' : 'Select this story to inspect';
    container.hidden = !selected;
    container.classList.toggle('is-loading', selected && !ready);
    if (ready) container.append(node('span', 'visually-hidden', 'Added to CSA. Inspect article is ready.'));
    else if (selected) {
      const adding = node('span', 'result-adding');
      const spinner = node('span', 'output-processing-spinner');
      spinner.setAttribute('aria-hidden', 'true');
      adding.append(spinner, node('span', '', 'Adding to CSA'));
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
      startAddition(id);
    }
    onSelectionChange(state.projectId, [...state.selected], [...state.readyArticleIds]);
    render();
    $('#result-list').querySelector(`[data-article-id="${id}"] .result-select-button`)?.focus({ preventScroll: true });
  }

  function openPreview(id) {
    const article = state?.articles.find(article => article.id === id);
    if (!article || !state.readyArticleIds.has(id)) return;
    previewArticle = { ...article, projectId: state.projectId };
    document.querySelector('.article-preview-badge').textContent = 'Fictional article preview';
    $('#article-preview-notice').hidden = false;
    $('#article-preview-meta').hidden = false;
    $('#article-preview-back').textContent = 'Back to results';
    $('#article-preview-title').textContent = article.title;
    $('#article-preview-meta').textContent = `${article.source} · ${dateLabel(article.date)}`;
    $('#article-preview-body').replaceChildren(...article.paragraphs.map(paragraph => node('p', '', paragraph)));
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
    ).sort((a, b) => state.sort === 'relevance' ? relevance(b) - relevance(a) : state.sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  }

  function chosenArticles() {
    return state.articles.filter(article => state.selected.has(article.id));
  }

  function render() {
    if (!state) return;
    const filtered = filteredArticles();
    const visible = filtered.slice(0, state.visibleCount);
    $('#results-count').textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'story' : 'stories'} found`;
    const list = $('#result-list');
    list.replaceChildren(...visible.map((article) => {
      const item = node('li', 'result-item');
      const card = node('div', 'result-card');
      card.dataset.articleId = article.id;
      card.dataset.selected = String(state.selected.has(article.id));
      const selection = node('button', 'result-select-button');
      selection.type = 'button';
      selection.setAttribute('aria-label', `Select story ${article.id.split('-').pop()}: ${article.title}`);
      selection.setAttribute('role', 'checkbox');
      selection.setAttribute('aria-checked', String(state.selected.has(article.id)));
      const indicator = node('span', 'result-selection-indicator');
      indicator.setAttribute('aria-hidden', 'true');
      if (state.selected.has(article.id)) indicator.append(createIcon('check'));
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
      inspect.setAttribute('aria-label', `Inspect story ${article.id.split('-').pop()}: ${article.title}`);
      inspect.setAttribute('aria-haspopup', 'dialog');
      inspect.setAttribute('aria-controls', 'article-preview-dialog');
      const eye = createIcon('visibility');
      inspect.append(eye);
      const separator = node('span', '', '|');
      separator.setAttribute('aria-hidden', 'true');
      publication.append(separator, inspect);
      const date = node('span', 'result-date');
      date.append(node('span', 'result-date-label', 'Published date: '), document.createTextNode(dateLabel(article.date)), node('span', 'result-date-separator', ' |'));
      meta.append(date, publication);
      copy.append(
        meta,
        node('strong', 'result-title', article.title),
        node('span', 'result-snippet', article.excerpt),
      );
      card.append(selection, indicator, thumbnail, copy);
      const previewButton = node('button', 'icon-button result-preview-button');
      previewButton.type = 'button';
      previewButton.disabled = true;
      previewButton.dataset.previewArticleId = article.id;
      previewButton.setAttribute('aria-label', `Preview story ${article.id.split('-').pop()}: ${article.title}`);
      previewButton.title = 'Article preview';
      const svg = createIcon('open_in_new');
      previewButton.append(svg);
      item.append(card, previewButton);
      const addition = node('div', 'result-addition');
      addition.dataset.additionArticleId = article.id;
      addition.setAttribute('role', 'status');
      addition.setAttribute('aria-live', 'polite');
      addition.setAttribute('aria-atomic', 'true');
      card.append(addition);
      renderAddition(addition, article);
      return item;
    }));
    $('#results-empty').hidden = filtered.length > 0;
    $('#load-more').hidden = filtered.length === 0;
    $('#load-more').disabled = visible.length >= filtered.length;
    $('#load-more').textContent = visible.length >= filtered.length ? 'All results shown' : 'Load more';
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
    toggleSelection(id);
  });
  $('#create-draft').addEventListener('click', () => {
    if (!state) return;
    const articles = chosenArticles();
    if (articles.length) onDraft({ query: state.query, articles, editorialDirection: state.editorialDirection });
  });

  return {
    show(project, { addingSources = false } = {}) {
      clearAdditionTimers();
      const query = project.sources[0].title;
      const articles = sampleArticles(query);
      const savedSelection = Array.isArray(project.selectedArticleIds) ? project.selectedArticleIds : [];
      const selected = new Set(savedSelection.filter(id => articles.some(article => article.id === id)));
      const savedAdded = Array.isArray(project.addedArticleIds) ? project.addedArticleIds : savedSelection;
      const readyArticleIds = new Set(savedAdded.filter(id => articles.some(article => article.id === id)));
      state = { projectId: project.id, addingSources, query, articles, editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '', sort: 'newest', source: 'all', after: '', visibleCount: 4, selected, readyArticleIds };
      $('#create-draft').textContent = addingSources ? 'Add sources' : 'Draft';
      $('.results-direction').hidden = addingSources;
      $('#results-help').textContent = addingSources ? 'Select at least one article to add it to your project.' : 'Select at least one article to enable Draft.';
      $('#search-results').hidden = false;
      $('#results-heading').textContent = `Search results for ${query}`;
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
      for (const id of selected) startAddition(id);
    },
    hide() { clearAdditionTimers(); if (preview.open) preview.close(); previewArticle = null; state = null; $('#search-results').hidden = true; },
  };
}
