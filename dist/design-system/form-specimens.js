import { parseSourceLinks, formatSourceLinks } from '../source-links.js?v=20261022-toast-copy';

const mounted = new WeakMap();

/** Mount isolated examples of the current demo-access and article-link fields. */
export function mountFormSpecimens(root) {
  if (!root) return null;
  mounted.get(root)?.destroy();
  root.innerHTML = `
    <div class="ds-form-grid">
      <section class="ds-form-example" aria-labelledby="ds-form-password-title">
        <h4 id="ds-form-password-title">Single-line input</h4>
        <label class="field-label" for="ds-form-password">Password</label>
        <div class="demo-password-field"><input id="ds-form-password" type="password" value="example" autocomplete="off"><button id="ds-form-password-visible" type="button" aria-label="Show password example" aria-controls="ds-form-password" aria-pressed="false">Show</button></div>
        <p class="ds-caption">The demo access field pairs a password input with a Show control. Focus the input to see its shared outline.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-disabled-title">
        <h4 id="ds-form-disabled-title">Disabled input</h4>
        <label class="field-label" for="ds-form-password-disabled">Password</label>
        <div class="demo-password-field"><input id="ds-form-password-disabled" type="password" value="example" autocomplete="off" disabled><button type="button" aria-label="Show password example unavailable" disabled>Show</button></div>
        <p class="ds-caption">Disabled controls keep their field shape and cannot be edited or activated.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-links-title">
        <h4 id="ds-form-links-title">Article URLs</h4>
        <form class="new-project-search" id="ds-form-links" novalidate>
          <label for="ds-form-query">Article URLs</label>
          <div class="new-project-input"><textarea id="ds-form-query" aria-describedby="ds-form-link-error" rows="5" wrap="soft" placeholder="Enter article URLs (one per line or separated by commas)&#10;&#10;Examples:&#10;https://www.centredaily.com/news/local/article123.html&#10;https://www.miamiherald.com/sports/article456.html" autocomplete="off" maxlength="4000" required></textarea></div>
          <p class="form-error" id="ds-form-link-error" role="status" hidden>Paste a valid website link to continue.</p>
          <div class="ds-form-actions"><button class="ds-text-action" id="ds-form-validate" type="button">Validate example</button><button class="new-project-continue" id="ds-form-continue" type="submit" disabled>Continue</button></div>
          <p class="ds-caption" id="ds-form-validation" role="status" aria-live="polite"></p>
        </form>
        <p class="ds-caption">New Project accepts one or more article URLs. This example validates links locally.</p>
      </section>
      <section class="ds-form-example" aria-labelledby="ds-form-error-title">
        <h4 id="ds-form-error-title">Validation error</h4>
        <div class="new-project-search">
          <label for="ds-form-invalid-query">Article URLs</label>
          <div class="new-project-input"><textarea id="ds-form-invalid-query" aria-describedby="ds-form-invalid-error" aria-invalid="true" rows="5" wrap="soft" readonly>not-a-website</textarea></div>
          <p class="form-error" id="ds-form-invalid-error" role="status">Paste a valid website link to continue.</p>
        </div>
        <p class="ds-caption">Validation pairs the field's invalid state with the app's inline error message.</p>
      </section>
    </div>`;

  const field = root.querySelector('#ds-form-query');
  const error = root.querySelector('#ds-form-link-error');
  const continuation = root.querySelector('#ds-form-continue');
  const result = root.querySelector('#ds-form-validation');
  const form = root.querySelector('#ds-form-links');
  const validateButton = root.querySelector('#ds-form-validate');
  const password = root.querySelector('#ds-form-password');
  const visibility = root.querySelector('#ds-form-password-visible');

  function validate(showEmptyError = false) {
    const formatted = formatSourceLinks(field.value);
    if (formatted !== field.value) field.value = formatted;
    const links = parseSourceLinks(field.value);
    const invalid = !links && (Boolean(field.value.trim()) || showEmptyError);
    field.setCustomValidity(invalid ? 'Paste a valid website link to continue.' : '');
    field.setAttribute('aria-invalid', String(invalid));
    error.hidden = !invalid;
    continuation.disabled = !links;
    return links;
  }
  function onInput() {
    result.textContent = '';
    validate();
  }
  function onValidate() {
    const links = validate(true);
    result.textContent = links ? `${links.length} valid article ${links.length === 1 ? 'URL' : 'URLs'}` : '';
    if (!links) field.focus();
  }
  function onSubmit(event) {
    event.preventDefault();
    onValidate();
  }
  function onVisibility() {
    const visible = password.type === 'password';
    password.type = visible ? 'text' : 'password';
    visibility.textContent = visible ? 'Hide' : 'Show';
    visibility.setAttribute('aria-label', visible ? 'Hide password example' : 'Show password example');
    visibility.setAttribute('aria-pressed', String(visible));
  }
  field.addEventListener('input', onInput);
  form.addEventListener('submit', onSubmit);
  validateButton.addEventListener('click', onValidate);
  visibility.addEventListener('click', onVisibility);
  const api = {
    destroy() {
      field.removeEventListener('input', onInput);
      form.removeEventListener('submit', onSubmit);
      validateButton.removeEventListener('click', onValidate);
      visibility.removeEventListener('click', onVisibility);
      mounted.delete(root);
    },
  };
  mounted.set(root, api);
  return api;
}
