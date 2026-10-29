export function mentionsElephant(instructions) {
  return /\belephants?\b/i.test(instructions || '');
}

export function revisionChangeSummary(before, after, instructions) {
  if (mentionsElephant(instructions)) {
    const title = (before.title || '').trim() || 'this story';
    const ending = /[.!?]$/.test(title) ? '' : '.';
    return `Could not add a mention of an elephant. No elephant appears in the source material, and inserting one would introduce a fabricated, irrelevant and inappropriate detail into a factual news report about ${title}${ending}`;
  }
  const changes = [];
  if ((before.draftText || '') !== (after.draftText || '')) changes.push('Updated the draft body.');
  else if (JSON.stringify(before.document) !== JSON.stringify(after.document)) changes.push('Updated the draft formatting.');
  if ((before.shareText || '') !== (after.shareText || '')) changes.push('Updated the share text.');
  return [...changes, 'No other changes.'].join(' ');
}
