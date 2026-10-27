import { createRevisionAnimation } from './drafting-animation.js?v=20261027-revision-loading';

// Swap only the document area; tabs and the disabled CMS action remain visible.
export function createRevisionLoading({ host, content, createAnimation = createRevisionAnimation }) {
  let animation = null;
  let previous = [];

  function setBusy(value) {
    if (Boolean(value) === Boolean(animation)) return;
    if (value) {
      animation = createAnimation();
      previous = content.map(element => ({ element, hidden: element.hidden, inert: element.inert }));
      for (const { element } of previous) { element.hidden = true; element.inert = true; }
      host.replaceChildren(animation.element);
      host.hidden = false;
    } else {
      animation.destroy();
      animation = null;
      host.hidden = true;
      host.replaceChildren();
      for (const { element, hidden, inert } of previous) { element.hidden = hidden; element.inert = inert; }
      previous = [];
    }
  }

  return { setBusy, destroy() { setBusy(false); } };
}
