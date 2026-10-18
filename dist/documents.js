// Keep original documents out of the small localStorage project records.
let databasePromise;

function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('csa.documents.v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('documents');
      request.onsuccess = () => {
        const database = request.result;
        database.onversionchange = () => { database.close(); databasePromise = null; };
        resolve(database);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Document storage is busy. Close other CSA tabs and try again.'));
    }).catch(error => { databasePromise = null; throw error; });
  }
  return databasePromise;
}

export async function saveDocuments(files) {
  const sources = await Promise.all(files.map(async file => ({
    type: 'file', title: file.name, size: file.size, attachmentId: crypto.randomUUID(),
    ...(/\.(txt|md)$/i.test(file.name) ? { text: (await file.slice(0, 100000).text()).slice(0, 100000) } : {}),
  })));
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    sources.forEach((source, index) => store.put(files[index], source.attachmentId));
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Documents could not be saved.'));
    transaction.onerror = () => {}; // onabort handles failed writes atomically.
  });
  return sources;
}

export async function downloadDocument(source) {
  const database = await openDatabase();
  const file = await new Promise((resolve, reject) => {
    const request = database.transaction('documents').objectStore('documents').get(source.attachmentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (!(file instanceof Blob)) throw new Error('This document is no longer available in this browser. Please add it again.');
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = source.title;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function deleteDocuments(attachmentIds) {
  if (!attachmentIds.length) return;
  const database = await openDatabase();
  await new Promise((resolve, reject) => {
    const transaction = database.transaction('documents', 'readwrite');
    const store = transaction.objectStore('documents');
    attachmentIds.forEach(id => store.delete(id));
    transaction.oncomplete = resolve;
    transaction.onabort = () => reject(transaction.error || new Error('Uploaded documents could not be removed.'));
    transaction.onerror = () => {};
  });
}
