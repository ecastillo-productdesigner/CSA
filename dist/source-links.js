function safeUrl(value) {
  try {
    const candidate = /^https?:\/\//i.test(value) ? value : /^(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(value) ? `https://${value}` : null;
    if (!candidate) return null;
    const url = new URL(candidate);
    return ['http:', 'https:'].includes(url.protocol) && url.hostname ? url.href : null;
  } catch { return null; }
}

function linkParts(input) {
  const text = input.trim().replace(/[,;](?=\s*(?:https?:\/\/|www\.))/gi, '\n');
  if (!text) return null;
  const parts = text.split(/\s+/).flatMap(part => {
    const links = [];
    let offset = 0;
    for (const match of part.matchAll(/https?:\/\//gi)) {
      if (match.index <= offset) continue;
      const prefix = part.slice(offset, match.index);
      // An embedded URL in a query or fragment belongs to the current link.
      if (!/[?#]/.test(prefix) && safeUrl(prefix)) {
        links.push(prefix);
        offset = match.index;
      }
    }
    links.push(part.slice(offset));
    return links;
  });
  return parts.every(part => safeUrl(part)) ? parts : null;
}

export function parseSourceLinks(input) {
  return linkParts(input)?.map(safeUrl) || null;
}

export function formatSourceLinks(input) {
  const parts = linkParts(input);
  if (!parts || parts.length < 2) return input;
  return parts.join('\n') + (input.match(/\n+$/)?.[0] || '');
}

// Display-only demo copy shared by both article preview entry points.
export function fictionalArticleParagraphs(title) {
  return [
    `In this fictional story, a neighborhood business becomes an unexpected part of the conversation around ${title}. What begins as a small creative idea draws attention to the people and everyday places behind it.`,
    'The first meeting takes place in a modest shared workspace, where sketches, notebooks, and half-finished ideas cover a long table. The group agrees to try one small experiment before deciding what the larger project should become.',
    'Each participant contributes a different perspective. One focuses on the visual details, another on the story behind the idea, and a third considers how neighbors might take part. Their early conversations help turn a loose concept into a practical plan.',
    'A short rehearsal gives the team a chance to see what works. They simplify a few details, leave room for improvisation, and discover that the quieter moments connect most strongly with their small test audience.',
    'The project ends with plans for another gathering. Its lasting effect is the connection between the people involved, and the reminder that a compelling story can begin with curiosity, a familiar place, and a willingness to try something new.',
  ];
}

const sampleArticles = [
  {
    title: 'A Neighborhood Project Brings a Community Together',
    excerpt: 'A neighborhood project is bringing people together around a fresh idea. Organizers share how the effort began and what comes next for the community.',
  },
  {
    title: 'A Local Business Finds a Fresh Way to Connect',
    excerpt: 'A local business is finding new ways to connect with its community. The people behind the effort describe the small decisions that helped it take shape.',
  },
  {
    title: 'An Unexpected Collaboration Opens a New Chapter',
    excerpt: 'An unexpected collaboration is opening a new chapter for the people involved. Their story follows the early conversations, shared plans, and first steps forward.',
  },
];

// Cards retain the submitted URL and use fictional body copy; no metadata is fetched.
export function sourceLinkArticles(urls) {
  return urls.map((value, index) => {
    const url = new URL(value);
    const source = url.hostname.replace(/^www\./, '');
    const slug = url.pathname.split('/').filter(Boolean).pop() || '';
    let title = slug;
    try { title = decodeURIComponent(slug); } catch { /* Keep malformed escapes as submitted. */ }
    title = title.replace(/\.(?:html?|aspx?|php)$/i, '').replace(/[-_]+/g, ' ').trim();
    const sampleIndex = Array.from(url.href).reduce((total, character) => total + character.codePointAt(0), 0) % sampleArticles.length;
    const sample = sampleArticles[sampleIndex];
    if (!title || /^(?:article\s*)?\d+$/i.test(title)) title = sample.title;
    return {
      id: `link-${index + 1}`, url: url.href, title,
      source, date: null, excerpt: sample.excerpt, paragraphs: [],
    };
  });
}
