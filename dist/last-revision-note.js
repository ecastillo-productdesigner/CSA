import { createEditorPopover } from './editor-popover.js?v=20261027-metadata';

const validTime = value => typeof value === 'number' && value > 0 && Number.isFinite(new Date(value).getTime()) ? value : null;

export function revisionHistory(output) {
  const requests = Array.isArray(output?.revisionRequests) ? output.revisionRequests : [];
  return requests.flatMap((request, index) => {
    if (typeof request?.instructions !== 'string' || !request.instructions.trim()) return [];
    const completedAt = validTime(request.completedAt);
    return [{ details: { instructions: request.instructions, completedAt }, order: completedAt ?? validTime(request.requestedAt) ?? 0, index }];
  }).sort((a, b) => a.order - b.order || a.index - b.index).map(entry => entry.details);
}
export function revisionRequestLabel(count) { return count > 1 ? 'Requested Revisions' : 'Requested Revision'; }
export function latestRevisionDetails(output) { return revisionHistory(output).at(-1) || null; }
export function latestRevisionNote(output) { return latestRevisionDetails(output)?.instructions || ''; }

export function createLastRevisionNote({ container = document.querySelector('#material-editor'), closePanels = () => {} } = {}) {
  const trigger = document.querySelector('#editor-revision-note-button');
  const popover = document.querySelector('#editor-revision-note-popover');
  const list = document.querySelector('#editor-revision-history');
  const label = document.querySelector('#editor-revision-note-label');
  const heading = document.querySelector('#editor-revision-note-heading');
  const dismiss = document.querySelector('#editor-revision-note-close');
  let notes = [];
  function render() {
    const title = revisionRequestLabel(notes.length);
    label.textContent = title;
    heading.textContent = title;
    dismiss.setAttribute('aria-label', `Close ${title}`);
    list.replaceChildren(...notes.map((details, index) => {
      const entry = document.createElement('li');
      const heading = document.createElement('h3');
      heading.textContent = `Revision ${index + 1}`;
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
      noteLabel.textContent = 'Requested Change: ';
      const copy = document.createElement('dd');
      copy.className = 'editor-direction-copy';
      copy.textContent = details.instructions;
      noteRow.append(noteLabel, copy);
      fields.append(dateRow, noteRow);
      entry.append(heading, fields);
      return entry;
    }));
  }
  const controller = createEditorPopover({ container, trigger, popover, dismiss, onOpen() { closePanels(); render(); } });
  function update(output) {
    controller.close();
    notes = revisionHistory(output);
    render();
    trigger.hidden = !notes.length;
  }
  update(null);
  return { update, close: controller.close };
}
