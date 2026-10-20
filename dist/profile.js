export function createProfile({ onClose, onSessionEnd }) {
  const menu = document.querySelector('#profile-menu');
  const trigger = document.querySelector('#show-profile');
  const email = document.querySelector('#profile-email').textContent.trim();
  trigger.setAttribute('aria-label', `Profile options for ${email}`);

  menu.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
    items[next]?.focus();
  });
  document.querySelector('#profile-logout').addEventListener('click', () => onSessionEnd(true));
}
