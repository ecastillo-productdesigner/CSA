const listicleHeadings = [
  'How the story begins',
  'What shapes the story',
  'Why the details matter',
  'What comes next',
];

const explainerHeadings = ['What to Know', 'Key Details', 'The Context'];
const videoHeadings = ['Opening', 'Voiceover', 'Closing'];
const videoCues = [
  'On-screen Cue: Show the opening narration as text.',
  'On-screen Cue: Use text cards for the key details in the narration.',
  'On-screen Cue: Show the closing narration as text.',
];

function formatSections(paragraphs, format) {
  // Keep the opening and closing in place and every supplied paragraph intact.
  // Short drafts only get sections for which source material exists.
  const sections = paragraphs.length > 2
    ? [paragraphs.slice(0, 1), paragraphs.slice(1, -1), paragraphs.slice(-1)]
    : paragraphs.map(paragraph => [paragraph]);
  const blocks = [];
  const ops = [];
  const addParagraph = paragraph => {
    blocks.push(paragraph);
    ops.push({ insert: `${paragraph}\n` });
  };
  const addHeading = (heading, level) => {
    blocks.push(heading);
    ops.push({ insert: heading }, { insert: '\n', attributes: { header: level } });
  };
  sections.forEach((section, index) => {
    const isVideo = format === 'video-script';
    addHeading((isVideo ? videoHeadings : explainerHeadings)[index], 2);
    if (isVideo) {
      addParagraph(videoCues[index]);
      addHeading('Narration', 3);
    }
    section.forEach(addParagraph);
  });
  return { draftText: blocks.join('\n\n'), document: { ops } };
}

export function formatDraftContent(paragraphs, { format, headings = [] } = {}) {
  if (!Array.isArray(paragraphs) || paragraphs.some(paragraph => typeof paragraph !== 'string')) {
    throw new TypeError('Draft paragraphs must be an array of strings');
  }
  if (format === 'what-to-know' || format === 'video-script') {
    return formatSections(paragraphs, format);
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
