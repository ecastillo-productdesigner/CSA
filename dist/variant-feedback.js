import { createIcon } from './icons.js?v=20261021-adapt-count';

export function createFeedbackPill(output, disabled = false) {
  const pill = document.createElement('span');
  pill.className = 'variant-feedback-pill';
  pill.setAttribute('role', 'group');
  pill.setAttribute('aria-label', 'Rate this draft');
  for (const [rating, symbol, label] of [['up', 'thumb_up', 'Rate draft: Good'], ['down', 'thumb_down', 'Rate draft: Could be better']]) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'variant-feedback-trigger';
    button.dataset.variantFeedback = output.id; button.dataset.feedbackRating = rating;
    button.disabled = disabled; button.setAttribute('aria-label', label); button.title = label;
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', 'experience-feedback-dialog');
    button.append(createIcon(symbol)); pill.append(button);
  }
  return pill;
}

export function createVariantFeedback({ save, refreshDropdowns, closeDropdowns }) {
  const dialog = document.querySelector('#experience-feedback-dialog');
  const form = document.querySelector('#experience-feedback-form');
  const category = document.querySelector('#feedback-category');
  const severity = document.querySelector('#feedback-severity');
  const description = document.querySelector('#feedback-description');
  const comments = document.querySelector('#feedback-comments');
  const submit = document.querySelector('#feedback-submit');
  const error = document.querySelector('#feedback-error');
  const complete = document.querySelector('#experience-feedback-complete');
  const ratings = [...dialog.querySelectorAll('[data-experience-rating]')];
  let target = null;
  let rating = '';

  function valid() {
    return ['up', 'down'].includes(rating) && Boolean(category.value) && Boolean(description.value.trim());
  }

  function refresh() {
    ratings.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.experienceRating === rating)));
    document.querySelector('#feedback-description-count').textContent = `${Math.max(0, description.maxLength - description.value.length)} characters remaining`;
    submit.disabled = !valid();
    if (valid()) error.hidden = true;
  }

  dialog.querySelector('#experience-feedback-options').addEventListener('click', event => {
    const button = event.target.closest('[data-experience-rating]');
    if (!button || !target) return;
    rating = button.dataset.experienceRating;
    refresh();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!target) return;
    if (!valid()) {
      error.hidden = false;
      (!rating ? ratings[0] : !category.value ? document.querySelector('#feedback-category-trigger') : description).focus();
      return;
    }
    const submittedAt = Date.now();
    target.variant.experienceFeedback = {
      rating,
      category: category.value,
      severity: severity.value,
      description: description.value.trim(),
      comments: comments.value.trim(),
      submittedAt,
    };
    target.project.updatedAt = submittedAt;
    const saved = save();
    closeDropdowns();
    form.hidden = true;
    complete.hidden = false;
    document.querySelector('#experience-feedback-thanks').textContent = saved ? 'Thanks for your feedback!' : 'Thanks! Your feedback is saved for this session.';
    document.querySelector('#experience-feedback-done').focus();
  });
  dialog.addEventListener('close', () => { closeDropdowns(); target = null; });

  return {
    open(project, variant, initialRating) {
      closeDropdowns();
      target = { project, variant };
      form.reset();
      const feedback = variant.experienceFeedback || {};
      rating = ['up', 'down'].includes(initialRating) ? initialRating : ['up', 'down'].includes(feedback.rating) ? feedback.rating : '';
      category.value = feedback.category || '';
      severity.value = feedback.severity || '';
      description.value = typeof feedback.description === 'string' ? feedback.description.slice(0, 500) : '';
      comments.value = typeof feedback.comments === 'string' ? feedback.comments : '';
      form.hidden = false;
      complete.hidden = true;
      error.hidden = true;
      refresh();
      refreshDropdowns();
      dialog.showModal();
      dialog.querySelector('.experience-feedback-body').scrollTop = 0;
    },
  };
}
