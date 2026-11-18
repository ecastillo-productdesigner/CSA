import { createIcon } from './icons.js?v=20261026-drafting-card-size';

const fields = [
  ['angle', 'Editorial Angle'],
  ['focus', 'Content Focus'],
  ['structure', 'Content Structure'],
  ['tone', 'Tone'],
];
const text = value => typeof value === 'string' ? value : '';
const clonePlans = plans => plans.map(plan => ({ ...plan }));

export function createEditorialPlanReview({ host = document.body, id = 'editorial-plan-review-dialog', onConfirm, onCancel = () => {}, closePanels = () => {} } = {}) {
  const doc = host.ownerDocument || document;
  const node = (tag, className = '', content) => {
    const element = doc.createElement(tag);
    element.className = className;
    if (content !== undefined) element.textContent = content;
    return element;
  };
  const button = (className, content) => {
    const element = node('button', className, content);
    element.type = 'button';
    return element;
  };
  const settingChips = (plan, className, tag = 'div') => {
    const chips = node(tag, className);
    for (const key of ['format', 'audience', 'voice']) {
      if (text(plan[key]).trim() && !/^none selected$/i.test(text(plan[key]).trim())) chips.append(node('span', `output-badge output-badge--${key}`, plan[key]));
    }
    chips.hidden = !chips.children.length;
    return chips;
  };
  const draftTitle = (plan, index) => plan.title || `Draft ${index + 1}`;
  const dialog = node('dialog', 'editorial-plan-review-dialog');
  dialog.id = id;
  dialog.setAttribute('aria-labelledby', `${id}-title`);
  dialog.setAttribute('aria-describedby', `${id}-description`);
  const header = node('div', 'editorial-plan-review-header');
  const heading = node('div', 'editorial-plan-review-heading');
  const title = node('h2', '', 'Review Editorial Plans');
  title.id = `${id}-title`;
  const description = node('p', '', 'Review how each draft will differ before creating it.');
  description.id = `${id}-description`;
  heading.append(title, description);
  const dismiss = button('icon-button');
  dismiss.setAttribute('aria-label', 'Close editorial plan review');
  dismiss.append(createIcon('close'));
  header.append(heading, dismiss);
  const body = node('div', 'editorial-plan-review-body');
  const tabs = node('div', 'editorial-plan-review-tabs');
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Content to Draft');
  const details = node('section', 'editorial-plan-review-details');
  details.id = `${id}-details`;
  details.setAttribute('role', 'tabpanel');
  body.append(tabs, details);
  const error = node('p', 'editorial-plan-review-error');
  error.setAttribute('role', 'alert');
  error.hidden = true;
  const footer = node('div', 'dialog-footer editorial-plan-review-footer');
  const back = button('secondary-button', 'Back');
  const confirm = button('primary-button', 'Create Drafts');
  footer.append(back, confirm);
  dialog.append(header, body, error, footer);
  host.append(dialog);

  let target = null;
  let active = 0;
  let opener = null;
  let accepted = false;
  let destroyed = false;
  let submitting = false;
  let tabButtons = [];
  let chipRows = [];
  const updateChipOverflow = chips => {
    const overflows = chips.scrollWidth > chips.clientWidth + 1;
    chips.setAttribute('data-fade-start', String(overflows && chips.scrollLeft > 1));
    chips.setAttribute('data-fade-end', String(overflows && chips.scrollLeft + chips.clientWidth < chips.scrollWidth - 1));
  };
  const chipResizeObserver = typeof ResizeObserver === 'function'
    ? new ResizeObserver(() => chipRows.forEach(updateChipOverflow))
    : null;

  function renderDetails() {
    if (!target) return;
    const plan = target.plans[active];
    details.replaceChildren();
    details.setAttribute('aria-labelledby', `${id}-plan-${active}`);
    const formFields = node('div', 'editorial-plan-review-fields');
    for (const [key, label] of fields) {
      const field = node('label', 'editorial-plan-review-field');
      field.append(node('span', '', label));
      const input = node('textarea');
      input.rows = 3;
      input.name = key;
      input.value = text(plan[key]);
      input.setAttribute('aria-label', `${label}, ${draftTitle(plan, active)}`);
      input.addEventListener('input', () => {
        plan[key] = input.value;
        input.removeAttribute('aria-invalid');
        error.hidden = true;
      });
      field.append(input);
      formFields.append(field);
    }
    details.append(formFields);
    tabButtons.forEach((item, index) => {
      item.setAttribute('aria-selected', String(index === active));
      item.tabIndex = index === active ? 0 : -1;
    });
  }

  function select(index, focus = false) {
    if (!target || index < 0 || index >= target.plans.length) return;
    active = index;
    renderDetails();
    if (focus) tabButtons[index].focus({ preventScroll: true });
  }

  function render() {
    chipResizeObserver?.disconnect();
    chipRows = [];
    tabs.replaceChildren();
    tabButtons = target.plans.map((plan, index) => {
      const item = button('editorial-plan-review-tab');
      item.id = `${id}-plan-${index}`;
      item.setAttribute('role', 'tab');
      item.setAttribute('aria-controls', details.id);
      const cardChips = settingChips(plan, 'editorial-plan-review-card-chips', 'span');
      cardChips.id = `${item.id}-settings`;
      cardChips.addEventListener('scroll', () => updateChipOverflow(cardChips), { passive: true });
      chipRows.push(cardChips);
      if (cardChips.hidden) {
        cardChips.hidden = false;
        cardChips.append(node('span', 'editorial-plan-review-empty', 'None Selected'));
      }
      item.append(cardChips, node('strong', 'output-card-title editorial-plan-review-tab-title', draftTitle(plan, index)));
      item.setAttribute('aria-label', draftTitle(plan, index));
      item.setAttribute('aria-describedby', cardChips.id);
      item.addEventListener('click', () => select(index));
      item.addEventListener('keydown', event => {
        const last = target.plans.length - 1;
        const next = event.key === 'ArrowRight' ? (index + 1) % (last + 1)
          : event.key === 'ArrowLeft' ? (index + last) % (last + 1)
            : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
      tabs.append(item);
      return item;
    });
    confirm.textContent = `Create ${target.plans.length} ${target.plans.length === 1 ? 'Draft' : 'Drafts'}`;
    confirm.disabled = !onConfirm;
    renderDetails();
  }

  function close() {
    if (dialog.open) dialog.close();
  }
  dismiss.addEventListener('click', close);
  back.addEventListener('click', close);
  confirm.addEventListener('click', () => {
    if (!target || submitting || !onConfirm) return;
    for (let index = 0; index < target.plans.length; index++) {
      const missing = fields.find(([key]) => !text(target.plans[index][key]).trim());
      if (!missing) continue;
      select(index);
      const input = details.querySelector(`textarea[name="${missing[0]}"]`);
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      const label = missing[1].toLowerCase();
      error.textContent = `Add ${/^[aeiou]/i.test(label) ? 'an' : 'a'} ${label} for “${draftTitle(target.plans[index], index)}”.`;
      error.hidden = false;
      return;
    }
    submitting = true;
    confirm.disabled = true;
    let saved = false;
    try { saved = onConfirm({ projectId: target.projectId, plans: clonePlans(target.plans) }) === true; }
    catch { /* Keep the editable review open if saving fails. */ }
    submitting = false;
    if (saved) {
      accepted = true;
      close();
    } else {
      confirm.disabled = false;
      error.textContent = 'Could not start drafting. Please try again.';
      error.hidden = false;
    }
  });
  dialog.addEventListener('close', () => {
    const cancelled = target && !accepted ? { projectId: target.projectId, plans: clonePlans(target.plans) } : null;
    const trigger = opener;
    target = null;
    opener = null;
    accepted = false;
    submitting = false;
    tabs.replaceChildren();
    details.replaceChildren();
    tabButtons = [];
    chipResizeObserver?.disconnect();
    chipRows = [];
    error.hidden = true;
    if (cancelled) onCancel(cancelled);
    if (trigger?.isConnected && !trigger.disabled && !trigger.closest('[hidden], [inert]')) trigger.focus({ preventScroll: true });
  });

  return {
    element: dialog,
    get isOpen() { return Boolean(dialog.open); },
    open({ projectId, plans, opener: trigger = doc.activeElement } = {}) {
      if (destroyed || dialog.open || !projectId || !Array.isArray(plans) || !plans.length) return false;
      if (plans.some(plan => !plan || typeof plan.outputId !== 'string' || !plan.outputId)) return false;
      if (new Set(plans.map(plan => plan.outputId)).size !== plans.length) return false;
      closePanels();
      target = { projectId, plans: clonePlans(plans) };
      opener = trigger;
      accepted = false;
      active = 0;
      error.hidden = true;
      render();
      dialog.showModal();
      for (const chips of chipRows) {
        updateChipOverflow(chips);
        chipResizeObserver?.observe(chips);
        for (const chip of chips.children) chipResizeObserver?.observe(chip);
      }
      body.scrollTop = 0;
      tabButtons[0].focus({ preventScroll: true });
      return true;
    },
    close,
    destroy() {
      if (destroyed) return;
      close();
      destroyed = true;
      chipResizeObserver?.disconnect();
      dialog.remove();
    },
  };
}
