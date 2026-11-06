import { sourceIdentityKey } from './source-model.js?v=20261106-own-material-source';

// Keep the editable material as one live source; other drafts retain their snapshots.
export function syncOwnMaterialSource(project, output) {
  if (!output?.id || (project?.ownMaterialOutputId !== output.id && output.ownMaterial !== true) || !Array.isArray(project.sources)) return false;
  const sources = project.sources;
  const index = sources.findIndex(source => source.ownMaterialOutputId === output.id);
  const text = Array.isArray(output.document?.ops)
    ? output.document.ops.map(op => typeof op?.insert === 'string' ? op.insert : '').join('').replace(/\n$/, '')
    : String(output.draftText || '');
  const hasText = Boolean(text.replace(/[\s\u200B-\u200D\uFEFF]/gu, ''));
  const enteredTitle = String(output.title || '').trim();
  const hasTitle = Boolean(enteredTitle.replace(/[\s\u200B-\u200D\uFEFF]/gu, '') && (enteredTitle !== 'Untitled story' || output.titleProvided === true));
  const hasMaterial = hasText || hasTitle;
  const identity = { type: 'text', ownMaterialOutputId: output.id };
  if (hasMaterial && project.removedSourceKeys?.includes(sourceIdentityKey(identity))) return false;
  let changed = false;
  let source = index >= 0 ? sources[index] : null;
  if (!hasMaterial) {
    if (source) {
      sources.splice(index, 1);
      for (const draft of project.outputs || []) {
        if (Array.isArray(draft.selectedSourceIndexes)) {
          draft.selectedSourceIndexes = draft.selectedSourceIndexes.filter(value => value !== index).map(value => value > index ? value - 1 : value);
        }
      }
      changed = true;
    }
    source = null;
  } else {
    const paragraph = text.split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
    const words = paragraph.split(/\s+/u);
    const title = hasTitle ? enteredTitle : words.slice(0, 8).join(' ') + (words.length > 8 ? '…' : '');
    const sourceText = hasText ? text : enteredTitle;
    if (!source) {
      source = { ...identity, title, text: sourceText, selected: true };
      sources.push(source);
      changed = true;
    } else if (source.title !== title || source.text !== sourceText) {
      source.title = title;
      source.text = sourceText;
      changed = true;
    }
  }
  const snapshots = source ? [structuredClone(source)] : [];
  const indexes = source ? [sources.indexOf(source)] : [];
  if (JSON.stringify(output.sourceSnapshots) !== JSON.stringify(snapshots)
    || JSON.stringify(output.selectedSourceIndexes) !== JSON.stringify(indexes)
    || output.sourceCount !== snapshots.length) {
    output.sourceSnapshots = snapshots;
    output.selectedSourceIndexes = indexes;
    output.sourceCount = snapshots.length;
    changed = true;
  }
  return changed;
}
