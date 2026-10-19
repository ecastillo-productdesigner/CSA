// This browser-only demo gate is bypassable. It does not protect public source files.
const passwordDigest = '2a97516c354b68848cdbd8f54a226a0a55b21ed138e207ad6c5cbb9c00aa5aea';
const sessionKey = 'csa.demo-access.v1';
const gate = document.querySelector('#demo-access');
const workspace = document.querySelector('#workspace-app');
const form = document.querySelector('#demo-access-form');
const password = document.querySelector('#demo-password');
const visibility = document.querySelector('#demo-password-visibility');
const submit = document.querySelector('#demo-access-submit');
const error = document.querySelector('#demo-password-error');

function rememberAccess() {
  try { sessionStorage.setItem(sessionKey, passwordDigest); } catch { /* Access still works without storage. */ }
}

function clearError() {
  error.hidden = true;
  error.textContent = '';
  password.removeAttribute('aria-invalid');
}

function showError(message, invalidPassword = false) {
  error.textContent = message;
  error.hidden = false;
  if (invalidPassword) password.setAttribute('aria-invalid', 'true');
  password.focus();
  password.select();
}

async function openWorkspace() {
  await import('./app.js?v=20261019-mobile-greeting');
  workspace.hidden = false;
  workspace.inert = false;
  gate.hidden = true;
  password.value = '';
  password.type = 'password';
  visibility.textContent = 'Show';
  visibility.setAttribute('aria-label', 'Show password');
  visibility.setAttribute('aria-pressed', 'false');
  document.querySelector('#main').focus();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submit.disabled) return;
  clearError();
  submit.disabled = true;
  submit.textContent = 'Opening…';
  try {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password.value));
    const digest = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
    if (digest !== passwordDigest) {
      showError('That password isn’t correct. Please try again.', true);
      return;
    }
    await openWorkspace();
    rememberAccess();
  } catch {
    showError('Couldn’t open the workspace. Refresh the page and try again.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Open workspace';
  }
});

password.addEventListener('input', clearError);
visibility.addEventListener('click', () => {
  const showing = password.type === 'password';
  password.type = showing ? 'text' : 'password';
  visibility.textContent = showing ? 'Hide' : 'Show';
  visibility.setAttribute('aria-label', showing ? 'Hide password' : 'Show password');
  visibility.setAttribute('aria-pressed', String(showing));
  password.focus();
});

document.addEventListener('csa:end-demo-session', event => {
  try {
    sessionStorage.removeItem(sessionKey);
    if (event.detail?.logout) sessionStorage.removeItem('csa.editor.active.v1');
  } catch { /* No saved access to clear. */ }
  window.location.reload();
});

let remembered = false;
try { remembered = sessionStorage.getItem(sessionKey) === passwordDigest; } catch { /* Ask for the password when storage is unavailable. */ }
if (remembered) {
  openWorkspace().catch(() => showError('Couldn’t open the workspace. Refresh the page and try again.'));
}
