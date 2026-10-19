const profileKey = 'csa.profile.v1';

function readProfile() {
  try {
    const value = JSON.parse(localStorage.getItem(profileKey) || '{}');
    return {
      name: typeof value.name === 'string' && value.name.trim() ? value.name.trim().slice(0, 60) : 'Julia',
      photo: typeof value.photo === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(value.photo) && value.photo.length < 300000 ? value.photo : '',
    };
  } catch { return { name: 'Julia', photo: '' }; }
}

export function createProfile({ notify, onClose, onSessionEnd }) {
  const menu = document.querySelector('#profile-menu');
  const trigger = document.querySelector('#show-profile');
  const dialog = document.querySelector('#profile-settings-dialog');
  const form = document.querySelector('#profile-settings-form');
  const name = document.querySelector('#profile-settings-name');
  const photo = document.querySelector('#profile-photo-input');
  const preview = document.querySelector('#profile-settings-photo');
  const submit = form.querySelector('[type="submit"]');
  let profile = readProfile();
  let pendingPhoto = profile.photo;
  let photoSequence = 0;

  function apply() {
    document.querySelector('#profile-name').textContent = profile.name;
    trigger.setAttribute('aria-label', `Profile options for ${profile.name}`);
    document.querySelector('#profile-photo').src = profile.photo || './assets/profile-photo.png';
    document.querySelector('#greeting-name').textContent = `Hello ${profile.name},`;
    document.querySelector('#project-start-heading').textContent = `Hello ${profile.name}, what are you making today?`;
  }
  function save(next) {
    try { localStorage.setItem(profileKey, JSON.stringify(next)); }
    catch { notify('Your profile could not be saved. Browser storage may be full.'); return false; }
    profile = next;
    apply();
    return true;
  }

  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  });
  document.querySelector('#profile-settings').addEventListener('click', () => {
    onClose();
    name.value = profile.name;
    name.setCustomValidity('');
    pendingPhoto = profile.photo;
    preview.src = pendingPhoto || './assets/profile-photo.png';
    submit.disabled = false;
    dialog.showModal();
    name.focus();
  });
  for (const button of dialog.querySelectorAll('[data-close-profile-settings]')) button.addEventListener('click', () => dialog.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const nextName = name.value.trim();
    name.setCustomValidity(nextName ? '' : 'Enter your name.');
    if (submit.disabled || !form.reportValidity()) return;
    if (save({ ...profile, name: nextName, photo: pendingPhoto })) { dialog.close(); notify('Profile saved.'); }
  });
  name.addEventListener('input', () => name.setCustomValidity(''));
  dialog.addEventListener('close', () => {
    photoSequence += 1;
    pendingPhoto = profile.photo;
    preview.src = pendingPhoto || './assets/profile-photo.png';
    photo.value = '';
    submit.disabled = false;
    trigger.focus({ preventScroll: true });
  });


  document.querySelector('#profile-change-photo').addEventListener('click', () => photo.click());
  photo.addEventListener('change', async () => {
    const file = photo.files?.[0];
    photo.value = '';
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify('Choose a PNG, JPG, or WebP photo up to 5 MB.'); return;
    }
    const sequence = ++photoSequence;
    submit.disabled = true;
    let bitmap;
    try {
      bitmap = await createImageBitmap(file);
      if (!dialog.open || sequence !== photoSequence) return;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      const size = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width - size) / 2, (bitmap.height - size) / 2, size, size, 0, 0, 256, 256);
      pendingPhoto = canvas.toDataURL('image/webp', .85);
      preview.src = pendingPhoto;
    } catch {
      if (dialog.open && sequence === photoSequence) notify('This photo could not be opened. Try another image.');
    } finally {
      bitmap?.close();
      if (sequence === photoSequence) submit.disabled = false;
    }
  });
  document.querySelector('#demo-lock').addEventListener('click', () => onSessionEnd(false));
  document.querySelector('#profile-logout').addEventListener('click', () => onSessionEnd(true));
  apply();
}
