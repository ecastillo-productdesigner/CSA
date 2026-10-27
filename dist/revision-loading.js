import { createRevisionAnimation } from './drafting-animation.js?v=20261027-revision-loading';

// Keep the document in the layout so the loading layer covers its exact area.
export function createRevisionLoading({ host, content, createAnimation = createRevisionAnimation }) {
  let animation = null;
  let previous = [];

  function setBusy(value, selectionKeys = []) {
    if (Boolean(value) === Boolean(animation)) return;
    if (value) {
      animation = createAnimation({ selectionKeys });
      previous = content.map(element => ({ element, visibility: element.style.visibility, inert: element.inert }));
      for (const { element } of previous) { element.style.visibility = 'hidden'; element.inert = true; }
      host.replaceChildren(animation.element);
      host.hidden = false;
    } else {
      animation.destroy();
      animation = null;
      host.hidden = true;
      host.replaceChildren();
      for (const { element, visibility, inert } of previous) { element.style.visibility = visibility; element.inert = inert; }
      previous = [];
    }
  }

  return { setBusy, destroy() { setBusy(false); } };
}
