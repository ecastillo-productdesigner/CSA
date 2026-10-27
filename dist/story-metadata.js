import { createEditorPopover } from './editor-popover.js?v=20261027-metadata';

const stopWords = new Set('about after again also another around became become been before being behind between both could each entirely every first found from have into itself just like made more most much nearby neither none once only ordinary other over same should some story stories such than that their them then there these they this those through together under very were what when where which while with without would your'.split(' '));
const clean = value => typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';

export function storyMetadata(title, body) {
  const heading = clean(title);
  const text = clean(body);
  const opening = text.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() || text;
  const description = opening.length > 180 ? `${opening.slice(0, 177).replace(/\s+\S*$/u, '')}…` : opening;
  const scores = new Map();
  for (const [content, weight] of [[heading, 3], [text, 1]]) {
    for (const word of content.toLowerCase().match(/[\p{L}][\p{L}’'-]*/gu) || []) {
      const keyword = word.replace(/[’']s$/u, '');
      if (keyword.length < 4 || stopWords.has(keyword)) continue;
      scores.set(keyword, (scores.get(keyword) || 0) + weight);
    }
  }
  return { seoTitle: heading, metaDescription: description, seoKeywords: [...scores].sort((a, b) => b[1] - a[1]).slice(0, 7).map(([word]) => word).join(', ') };
}

export function createStoryMetadata({ read, closePanels = () => {}, container = document.querySelector('#material-editor') }) {
  const trigger = document.querySelector('#editor-metadata-button');
  const popover = document.querySelector('#editor-metadata-popover');
  const dismiss = document.querySelector('#editor-metadata-close');
  const fields = { seoTitle: '#editor-seo-title', metaDescription: '#editor-meta-description', seoKeywords: '#editor-seo-keywords' };
  return createEditorPopover({ container, trigger, popover, dismiss, onOpen() {
    closePanels();
    const metadata = read();
    for (const [key, selector] of Object.entries(fields)) document.querySelector(selector).textContent = metadata[key] || '—';
  } });
}
