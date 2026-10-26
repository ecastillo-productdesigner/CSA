const listicleHeadings = [
  'How the story begins',
  'What shapes the story',
  'Why the details matter',
  'What comes next',
];

export function formatDraftContent(paragraphs, { format, headings = [] } = {}) {
  if (!Array.isArray(paragraphs) || paragraphs.some(paragraph => typeof paragraph !== 'string')) {
    throw new TypeError('Draft paragraphs must be an array of strings');
  }
  if (format !== 'listicle') {
    return {
      draftText: paragraphs.join('\n\n'),
      document: { ops: paragraphs.map(paragraph => ({ insert: `${paragraph}\n` })) },
    };
  }
  if (paragraphs.length < 5) throw new RangeError('A listicle needs an introduction and at least four body paragraphs');
  const bodies = paragraphs.slice(1);
  const blocks = [paragraphs[0]];
  const ops = [{ insert: `${paragraphs[0]}\n` }];
  let offset = 0;
  for (let index = 0; index < 4; index += 1) {
    const count = Math.floor(bodies.length / 4) + (index < bodies.length % 4 ? 1 : 0);
    const body = bodies.slice(offset, offset + count).join(' ');
    offset += count;
    const supplied = Array.isArray(headings) ? headings[index] : undefined;
    const heading = `${index + 1}. ${typeof supplied === 'string' && supplied.trim() ? supplied.trim() : listicleHeadings[index]}`;
    blocks.push(heading, body);
    ops.push({ insert: heading }, { insert: '\n', attributes: { header: 2 } }, { insert: `${body}\n` });
  }
  return { draftText: blocks.join('\n\n'), document: { ops } };
}
