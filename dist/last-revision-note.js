const validTime = value => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime()) ? value : null;

export function revisionHistory(output) {
  const requests = Array.isArray(output?.revisionRequests) ? output.revisionRequests : [];
  return requests.flatMap((request, index) => {
    if (typeof request?.instructions !== 'string' || !request.instructions.trim()) return [];
    const completedAt = validTime(request.completedAt);
    const details = { instructions: request.instructions, completedAt };
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
    const fields = document.createElement('dl');
    fields.className = 'editor-seo-metadata';
    const dateRow = document.createElement('div');
    const dateLabel = document.createElement('dt');
    dateLabel.textContent = 'Revised: ';
    const dateValue = document.createElement('dd');
    const time = document.createElement('time');
    if (details.completedAt != null) {
      time.textContent = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(details.completedAt);
      time.dateTime = new Date(details.completedAt).toISOString();
    } else time.textContent = 'Time unavailable';
    dateValue.append(time);
    dateRow.append(dateLabel, dateValue);
    const noteRow = document.createElement('div');
    const noteLabel = document.createElement('dt');
    noteLabel.textContent = 'Requested Revision: ';
    const copy = document.createElement('dd');
    copy.className = 'editor-direction-copy';
    const request = details.instructions.trim();
    const ending = /[.!?…]$/.test(request) ? '' : '.';
    copy.textContent = `You asked for “${request}${ending}” ${details.changeSummary || 'Result not recorded.'}`;
    noteRow.append(noteLabel, copy);
    fields.append(dateRow, noteRow);
    entry.append(fields);
    return entry;
  }).reverse());
}
