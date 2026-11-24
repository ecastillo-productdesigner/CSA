import { storyMetadata } from './story-metadata.js?v=20261027-metadata';

const storagePrefix = 'csa.cms-preview.v1.';
const validId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const text = value => typeof value === 'string' ? value : '';

function copyDocument(value) {
  if (!Array.isArray(value?.ops)) return null;
  return { ops: value.ops.filter(op => typeof op?.insert === 'string').map(op => ({
    insert: op.insert,
    ...(op.attributes && typeof op.attributes === 'object' ? { attributes: { ...op.attributes } } : {}),
  })) };
}

export function createCmsPreviewRecord(project, output, destination, { useSentSnapshot = false } = {}) {
  let title = text(output.title) || 'Untitled story';
  let shareText = text(output.shareText);
  let document = copyDocument(output.document);
  let body = document ? document.ops.map(op => op.insert).join('').replace(/\n$/, '') : text(output.draftText);
  if (useSentSnapshot && typeof output.cmsSentContent === 'string') {
    try {
      const sent = JSON.parse(output.cmsSentContent);
      if (Array.isArray(sent) && typeof sent[0] === 'string' && Array.isArray(sent[1])) {
        title = sent[0];
        document = copyDocument({ ops: sent[1] });
        body = document.ops.map(op => op.insert).join('').replace(/\n$/, '');
        shareText = text(sent[2]);
      }
    } catch { /* Older exports without a saved signature use the available draft. */ }
  }
  const exportedAt = Number.isFinite(output.cmsSentAt) && output.cmsSentAt > 0 ? output.cmsSentAt : Date.now();
  return {
    id: validId(output.cmsDraftId) ? output.cmsDraftId : crypto.randomUUID(),
    projectId: project.id, outputId: output.id,
    title, shareText, body, document,
    metadata: storyMetadata(title, body),
    createdAt: exportedAt, updatedAt: exportedAt, exportedAt,
    destinationId: destination?.id || output.cmsDestinationId || '',
    publication: destination?.name || 'Training', status: 'Draft',
  };
}

export function readCmsPreviewRecord(id, storage = localStorage) {
  if (!validId(id)) return null;
  try {
    const record = JSON.parse(storage.getItem(storagePrefix + id) || 'null');
    return record?.id === id && typeof record.title === 'string' && typeof record.body === 'string' ? record : null;
  } catch { return null; }
}

export function saveCmsPreviewRecord(record, storage = localStorage) {
  if (!validId(record?.id) || typeof record.title !== 'string' || typeof record.body !== 'string') return false;
  try { storage.setItem(storagePrefix + record.id, JSON.stringify(record)); return true; }
  catch { return false; }
}

export function cmsPreviewUrl(id, baseUrl) {
  if (!validId(id)) throw new TypeError('Invalid CMS draft');
  const url = new URL('./cms.html', baseUrl);
  url.searchParams.set('draft', id);
  return url.href;
}
