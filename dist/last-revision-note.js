const validTime = value => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime()) ? value : null;

export function revisionHistory(output) {
  const requests = Array.isArray(output?.revisionRequests) ? output.revisionRequests : [];
  return requests.flatMap((request, index) => {
    if (typeof request?.instructions !== 'string' || !request.instructions.trim()) return [];
    const completedAt = validTime(request.completedAt);
    const details = { instructions: request.instructions, completedAt };
    if (typeof request.applied === 'boolean') details.applied = request.applied;
    if (typeof request.changeSummary === 'string' && request.changeSummary.trim()) details.changeSummary = request.changeSummary;
    return [{ details, order: completedAt ?? validTime(request.requestedAt) ?? 0, index }];
  }).sort((a, b) => a.order - b.order || a.index - b.index).map(entry => entry.details);
}
export function revisionRequestLabel(count) { return count > 1 ? 'Requested Revisions' : 'Requested Revision'; }
export function latestRevisionDetails(output) { return revisionHistory(output).at(-1) || null; }
export function latestRevisionNote(output) {
  const details = latestRevisionDetails(output);
  return details?.changeSummary || details?.instructions || '';
}

export function renderRevisionHistory(list, notes) {
  list.replaceChildren(...notes.map((details, index) => {
    const entry = document.createElement('li');
    if (notes.length > 1) {
      const heading = document.createElement('h3');
      heading.textContent = `Revision ${index + 1}`;
      entry.append(heading);
    }
    const time = document.createElement('time');
    if (details.completedAt != null) {
      time.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(details.completedAt);
      time.dateTime = new Date(details.completedAt).toISOString();
    } else time.textContent = 'Time unavailable';
    const fields = document.createElement('dl');
    fields.className = 'editor-seo-metadata';
    for (const [label, text] of [
      ['Requested Revision: ', details.instructions.trim()],
      ['Result: ', details.changeSummary || 'The result was not recorded.'],
    ]) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const copy = document.createElement('dd');
      copy.className = 'editor-direction-copy';
      copy.textContent = text;
      row.append(term, copy);
      fields.append(row);
    }
    entry.append(time, fields);
    return entry;
  }).reverse());
}
