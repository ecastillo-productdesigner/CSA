import { createIcon } from './icons.js?v=20261026-drafting-card-size';

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
    button.setAttribute('aria-pressed', String(output.experienceFeedback?.rating === rating));
    button.append(createIcon(symbol)); pill.append(button);
  }
  return pill;
}

export function createVariantFeedback({ save, refreshDropdowns, closeDropdowns, onOpenCms = () => {} }) {
  const dialog = document.querySelector('#experience-feedback-dialog');
  const form = document.querySelector('#experience-feedback-form');
  const details = document.querySelector('#feedback-details');
  const actions = document.querySelector('#feedback-actions');
  const ratingLabel = document.querySelector('#feedback-rating-label');
  const category = document.querySelector('#feedback-category');
  const severity = document.querySelector('#feedback-severity');
  const description = document.querySelector('#feedback-description');
  const comments = document.querySelector('#feedback-comments');
  const submit = document.querySelector('#feedback-submit');
  const error = document.querySelector('#feedback-error');
  const complete = document.querySelector('#experience-feedback-complete');
  const exportSection = document.querySelector('#experience-feedback-export');
  const wordpressLink = document.querySelector('#feedback-wordpress-link');
  const ratings = [...dialog.querySelectorAll('[data-experience-rating]')];
  let target = null;
  let rating = '';
  let detailsExpanded = true;

  function clearExport() {
    if (exportSection) exportSection.hidden = true;
    wordpressLink?.removeAttribute('href');
  }

  function showExport(value) {
    clearExport();
    if (!exportSection || !wordpressLink || typeof value !== 'string') return false;
    let url;
    try { url = new URL(value); }
    catch { return false; }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return false;
    // The action opens the local CMS preview through the supplied callback.
    exportSection.hidden = false;
    return true;
  }

  wordpressLink?.addEventListener('click', () => {
    if (target && !exportSection.hidden) onOpenCms(target.project, target.variant);
  });

  const requiresSeverity = () => rating === 'down';

  function valid() {
    return ['up', 'down'].includes(rating) && Boolean(category.value) && (!requiresSeverity() || Boolean(severity.value)) && Boolean(description.value.trim()) && description.value.length <= 500;
  }

  function refresh() {
    details.hidden = !detailsExpanded;
    actions.hidden = !detailsExpanded;
    ratingLabel.classList.toggle('visually-hidden', !detailsExpanded);
    dialog.dataset.feedbackExpanded = String(detailsExpanded);
    severity.required = requiresSeverity();
    document.querySelector('#feedback-severity-required').hidden = !requiresSeverity();
    document.querySelector('#feedback-severity-required-text').hidden = !requiresSeverity();
    ratings.forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.experienceRating === rating));
      button.setAttribute('aria-expanded', String(detailsExpanded));
    });
    document.querySelector('#feedback-description-count').textContent = `${Math.max(0, description.maxLength - description.value.length)} characters remaining`;
    submit.disabled = !detailsExpanded || !valid();
    if (valid()) error.hidden = true;
  }

  dialog.querySelector('#experience-feedback-options').addEventListener('click', event => {
    const button = event.target.closest('[data-experience-rating]');
    if (!button || !target) return;
    rating = button.dataset.experienceRating;
    detailsExpanded = true;
    refresh();
  });
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!target || form.hidden || !detailsExpanded) return;
    if (!valid()) {
      error.hidden = false;
      (!rating ? ratings[0] : !category.value ? document.querySelector('#feedback-category-trigger') : requiresSeverity() && !severity.value ? document.querySelector('#feedback-severity-trigger') : description).focus();
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
    document.querySelectorAll('[data-variant-feedback]').forEach(button => {
      if (button.dataset.variantFeedback === target.variant.id) {
        button.setAttribute('aria-pressed', String(button.dataset.feedbackRating === rating));
      }
    });
    closeDropdowns();
    form.hidden = true;
    complete.hidden = false;
    document.querySelector('#experience-feedback-thanks').textContent = saved ? 'Thanks for your feedback!' : 'Thanks! Your feedback is saved for this session.';
    document.querySelector('#experience-feedback-close').focus();
  });
  dialog.addEventListener('close', () => { closeDropdowns(); clearExport(); target = null; });

  return {
    open(project, variant, initialRating, options = {}) {
      closeDropdowns();
      const hasExport = showExport(options?.exportUrl);
      detailsExpanded = !hasExport;
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
      if (hasExport) wordpressLink.focus();
    },
  };
}
