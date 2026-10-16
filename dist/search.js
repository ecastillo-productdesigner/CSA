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

export function createSearchExperience({ onSearch, onSelectionChange, onDirection, onDraft }) {
  const $ = (selector) => document.querySelector(selector);
  let state = null;

  function filteredArticles() {
    return state.articles.filter((article) =>
      (state.source === 'all' || article.source === state.source) &&
      (!state.after || article.date >= state.after)
    ).sort((a, b) => state.sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
  }

  function chosenArticles() {
    if (state.selected.size) return state.articles.filter((article) => state.selected.has(article.id));
    return filteredArticles().slice(0, state.visibleCount);
  }

  function render() {
    if (!state) return;
    const filtered = filteredArticles();
    const visible = filtered.slice(0, state.visibleCount);
    $('#results-count').textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'story' : 'stories'} found`;
    $('#results-filter-button').classList.toggle('has-direction', Boolean(state.editorialDirection));
    $('#results-filter-button').title = state.editorialDirection ? 'Edit saved editorial direction' : 'Add editorial direction';
    const list = $('#result-list');
    list.replaceChildren(...visible.map((article) => {
      const item = node('li');
      const card = node('button', 'result-card');
      card.type = 'button';
      card.dataset.articleId = article.id;
      card.setAttribute('aria-label', `Select story ${article.id.split('-').pop()}: ${article.title}`);
      card.setAttribute('aria-pressed', String(state.selected.has(article.id)));
      card.title = 'Select this story for your draft';
      const thumbnail = node('span', `result-thumbnail${article.referenceImage ? ' result-thumbnail--reference' : ''}`);
      thumbnail.setAttribute('aria-hidden', 'true');
      if (!article.referenceImage) thumbnail.textContent = state.query.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
      const copy = node('span', 'result-copy');
      copy.append(
        node('span', 'result-meta', `Published date: ${dateLabel(article.date)} | ${article.source}`),
        node('strong', 'result-title', article.title),
        node('span', 'result-snippet', article.excerpt),
      );
      card.append(thumbnail, copy);
      item.append(card);
      return item;
    }));
    $('#results-empty').hidden = filtered.length > 0;
    $('#load-more').hidden = filtered.length === 0;
    $('#load-more').disabled = visible.length >= filtered.length;
    $('#load-more').textContent = visible.length >= filtered.length ? 'All results shown' : 'Load more';
    $('#create-draft').disabled = chosenArticles().length === 0;
    $('#create-draft').title = `Draft from ${chosenArticles().length} ${state.selected.size ? 'selected' : 'visible'} stories`;
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
  $('#results-filter-button').addEventListener('click', () => { if (state) onDirection(state.projectId); });
  $('#load-more').addEventListener('click', () => { if (state) { state.visibleCount += 4; render(); } });
  $('#result-list').addEventListener('click', (event) => {
    const card = event.target.closest('.result-card');
    if (!card || !state) return;
    const id = card.dataset.articleId;
    if (state.selected.has(id)) state.selected.delete(id); else state.selected.add(id);
    onSelectionChange(state.projectId, [...state.selected]);
    render();
    $('#result-list').querySelector(`[data-article-id="${id}"]`).focus({ preventScroll: true });
  });
  $('#create-draft').addEventListener('click', () => {
    if (!state) return;
    const articles = chosenArticles();
    if (articles.length) onDraft({ query: state.query, articles, editorialDirection: state.editorialDirection });
  });

  return {
    show(project) {
      const query = project.sources[0].title;
      const articles = sampleArticles(query);
      const savedSelection = Array.isArray(project.selectedArticleIds) ? project.selectedArticleIds : [];
      state = { projectId: project.id, query, articles, editorialDirection: typeof project.editorialDirection === 'string' ? project.editorialDirection : '', sort: 'newest', source: 'all', after: '', visibleCount: 4, selected: new Set(savedSelection.filter((id) => articles.some((article) => article.id === id))) };
      $('#search-results').hidden = false;
      $('#results-heading').textContent = `Search results for ${query}`;
      $('#results-query').value = query;
      $('#results-search-button').disabled = false;
      $('#results-sort').value = 'newest';
      $('#results-source').replaceChildren(node('option', '', 'All sources'), ...[...new Set(articles.map((article) => article.source))].map((source) => {
        const option = node('option', '', source); option.value = source; return option;
      }));
      $('#results-source').options[0].value = 'all';
      $('#results-after').value = '';
      $('#results-filter-panel').hidden = true;
      $('#results-toggle-filters').setAttribute('aria-expanded', 'false');
      render();
    },
    setEditorialDirection(projectId, direction) {
      if (state?.projectId !== projectId) return;
      state.editorialDirection = direction;
      render();
    },
    hide() { state = null; $('#search-results').hidden = true; },
  };
}
