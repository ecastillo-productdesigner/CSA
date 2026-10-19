// Commit a touch tap before Safari's compatibility click, without selecting on a swipe.
export function bindTapActivation(button, activate, { now = Date.now } = {}) {
  let pointer = null;
  let ignoreClickUntil = 0;
  const moved = event => Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10;

  button.addEventListener('pointerdown', event => {
    if (!['touch', 'pen'].includes(event.pointerType) || event.isPrimary === false || event.button > 0) return;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    ignoreClickUntil = now() + 800;
    // Prevent an intermediate focus change from dismissing the option before pointerup.
    event.preventDefault();
  });
  button.addEventListener('pointermove', event => {
    if (pointer?.id === event.pointerId && moved(event)) pointer.moved = true;
  });
  button.addEventListener('pointercancel', event => {
    if (pointer?.id !== event.pointerId) return;
    pointer = null;
    ignoreClickUntil = now() + 800;
  });
  button.addEventListener('pointerup', event => {
    if (pointer?.id !== event.pointerId) return;
    const isTap = !pointer.moved && !moved(event);
    pointer = null;
    ignoreClickUntil = now() + 800;
    event.preventDefault();
    if (isTap && !button.disabled) activate();
  });
  button.addEventListener('click', event => {
    if (event.detail > 0 && now() < ignoreClickUntil) { event.preventDefault(); return; }
    if (!button.disabled) activate();
  });
}
