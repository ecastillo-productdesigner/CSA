import { createEditorialPlanReview } from '../editorial-plan-review.js?v=20261117-plan-review';
import { buildEditorialPlans, applyEditorialPlan } from '../editorial-plans.js?v=20261117-plan-review';
import { populateOutputContent } from '../outputs.js?v=20261117-plan-review';
import { createDraftingAnimation } from '../drafting-animation.js?v=20261111-source-paper-count';
import { tokenNumber } from './runtime.js?v=20261029-revision-indicator-location';

// The production dialog with isolated sample records; never writes app storage.
export function mountEditorialPlanSpecimen(root) {
  if (!root) return;
  const opener = root.querySelector('button');
  const status = root.querySelector('[role="status"]');
  const preview = root.querySelector('[data-plan-preview]');
  let animation = null;
  let timer = null;
  let outputs = [];
  const sources = [{ title: 'Neighbors plan a shared garden', text: 'Neighbors are planning a shared garden. Volunteers are considering planting schedules, maintenance, and ways for residents to get involved.' }];
  const review = createEditorialPlanReview({
    onConfirm({ plans }) {
      for (const output of outputs) applyEditorialPlan(output, plans.find(plan => plan.outputId === output.id));
      opener.disabled = true;
      status.textContent = 'Creating Drafts';
      animation = createDraftingAnimation({ label: 'Creating Drafts', selectionKeys: ['format', 'audience'] });
      preview.replaceChildren(animation.element);
      timer = setTimeout(() => {
        timer = null;
        animation.destroy();
        animation = null;
        preview.replaceChildren();
        for (const output of outputs) {
          populateOutputContent(output);
          const article = document.createElement('article');
          article.className = 'ds-stack';
          const title = document.createElement('h4');
          title.textContent = output.title;
          const text = document.createElement('p');
          text.textContent = output.draftText;
          article.append(title, text);
          preview.append(article);
        }
        status.textContent = 'Two drafts created in this preview';
        opener.disabled = false;
      }, tokenNumber('component.drafting.processing-duration'));
      return true;
    },
  });
  opener.addEventListener('click', () => {
    outputs = [
      { id: 'ds-plan-family', title: 'What Neighbors Need to Know', labels: [{ key: 'format', label: 'Standard Format' }, { key: 'audience', label: 'Local Residents' }, { key: 'voice', label: 'Us Weekly' }], toolPreferences: { format: 'standard', audience: 'general', voice: 'us-weekly' }, sourceSnapshots: sources, editorialDirection: 'Explain what this means for local families.' },
      { id: 'ds-plan-context', title: 'Five Questions Behind a Shared Garden', labels: [{ key: 'format', label: 'Listicle' }, { key: 'audience', label: 'Community Volunteers' }, { key: 'voice', label: "Woman's World" }], toolPreferences: { format: 'listicle', audience: 'general', voice: 'womans-world' }, sourceSnapshots: sources, editorialDirection: 'Focus on practical ways to get involved.' },
    ];
    review.open({ projectId: 'ds-editorial-plans', plans: buildEditorialPlans(outputs), opener });
  });
  window.addEventListener('pagehide', () => {
    if (timer !== null) clearTimeout(timer);
    animation?.destroy();
  }, { once: true });
}
