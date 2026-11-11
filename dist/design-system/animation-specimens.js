import { createDraftingAnimation, createAudienceSuggestingAnimation, createSourceAddingAnimation, createRevisionAnimation } from '../drafting-animation.js?v=20261111-source-paper-count';
import { tokenNumber } from './runtime.js?v=20261029-revision-indicator-location';

// Motion examples use the production component with isolated playback controls.
export function mountAnimationSpecimens(root) {
  if (!root) return;
  const previews = [
    { id: 'audience', label: 'Suggesting Audiences', duration: 'audience-suggest-duration', create: () => [createAudienceSuggestingAnimation(), createAudienceSuggestingAnimation({ compact: true })] },
    { id: 'audience-single', label: 'Suggesting Audience', duration: 'audience-suggest-duration', create: () => [createAudienceSuggestingAnimation({ label: 'Suggesting Audience' })] },
    { id: 'draft', label: 'Creating Draft', duration: 'processing-duration', create: () => [createDraftingAnimation({ compact: true, selectionKeys: ['format', 'audience', 'voice'] })] },
    { id: 'drafts', label: 'Creating Drafts', duration: 'processing-duration', create: () => [createDraftingAnimation({ compact: true, label: 'Creating Drafts', selectionKeys: ['format', 'audience', 'voice'] })] },
    { id: 'revision', label: 'Revising Draft', duration: 'revision-duration', create: () => [createRevisionAnimation({ selectionKeys: ['format', 'audience', 'voice'] })] },
    { id: 'source', label: 'Adding Source', duration: 'source-add-duration', create: () => [createSourceAddingAnimation()] },
    { id: 'sources', label: 'Adding Sources', duration: 'source-add-duration', create: () => [createSourceAddingAnimation({ label: 'Adding Sources' })] },
  ];
  const cleanups = [];
  for (const preview of previews) {
    const panel = root.querySelector(`[data-animation-preview="${preview.id}"]`);
    const mounts = [...panel.querySelectorAll('[data-animation-mount]')];
    const play = panel.querySelector('[data-animation-play]');
    const stop = panel.querySelector('[data-animation-stop]');
    const status = panel.querySelector('[data-animation-status]');
    let animations = [];
    let timer = null;
    function cancelTimer() { if (timer !== null) clearTimeout(timer); timer = null; }
    function render(playing) {
      animations.forEach(animation => animation.destroy());
      animations = preview.create();
      animations.forEach((animation, index) => {
        // The control's status provides one announcement for both audience sizes.
        animation.element.querySelector('.drafting-message')?.setAttribute('aria-live', 'off');
        mounts[index].replaceChildren(animation.element);
        if (!playing) animation.destroy();
      });
    }
    function finish(message) {
      cancelTimer();
      animations.forEach(animation => animation.destroy());
      play.disabled = false;
      play.textContent = 'Replay Animation';
      play.setAttribute('aria-label', `Replay ${preview.label} animation`);
      stop.hidden = true;
      status.textContent = message;
    }
    play.addEventListener('click', () => {
      cancelTimer();
      render(true);
      play.disabled = true;
      stop.hidden = false;
      status.textContent = 'Playing a 10-second preview';
      timer = setTimeout(() => finish('Preview complete'), tokenNumber(`component.drafting.${preview.duration}`));
    });
    stop.addEventListener('click', () => {
      finish('Preview stopped');
      play.focus();
    });
    render(false);
    cleanups.push(() => { cancelTimer(); animations.forEach(animation => animation.destroy()); });
  }
  window.addEventListener('pagehide', () => cleanups.forEach(cleanup => cleanup()), { once: true });
}
