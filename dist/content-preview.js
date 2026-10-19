export function formatContentPreview(preview) {
  const list = (values, empty) => values?.length ? values.map(value => `- ${value}`).join('\n') : empty;
  return [
    `# ${preview.title || 'Untitled article'}`,
    `Published: ${preview.publishedDate || 'Not available in this demo'}`,
    `Source: ${preview.source || 'Not provided'}`,
    '',
    ...(preview.paragraphs || []).flatMap(paragraph => [paragraph, '']),
    'PHOTO CAPTIONS:',
    list(preview.photoCaptions, 'No photo captions provided.'),
    '',
    'ARTICLE HEADINGS:',
    list(preview.headings, 'No article headings provided.'),
  ].join('\n');
}

export function countPreviewWords(text) {
  return text.trim().match(/\S+/g)?.length || 0;
}

export function createContentPreview({ onChange }) {
  const container = document.querySelector('#content-preview');
  const input = document.querySelector('#content-preview-text');
  const count = document.querySelector('#content-preview-word-count');
  const frame = document.querySelector('#output-placeholder');
  const original = document.querySelector('#source-story-content');
  function updateCount() {
    const words = countPreviewWords(input.value);
    count.textContent = `${words.toLocaleString('en-US')} ${words === 1 ? 'word' : 'words'}`;
  }
  input.addEventListener('input', () => { updateCount(); onChange(input.value); });
  return {
    render(preview, { readOnly = false } = {}) {
      container.hidden = false;
      original.hidden = true;
      frame.classList.add('has-content-preview');
      frame.setAttribute('aria-labelledby', 'content-preview-heading');
      input.readOnly = readOnly;
      input.value = typeof preview.text === 'string' ? preview.text : formatContentPreview(preview);
      input.scrollTop = 0;
      updateCount();
    },
    hide() {
      container.hidden = true;
      original.hidden = false;
      frame.classList.remove('has-content-preview');
      frame.setAttribute('aria-labelledby', 'source-story-title');
    },
    hasContent() { return Boolean(input.value.trim()); },
  };
}
