import { createAudienceSuggestingAnimation } from './drafting-animation.js?v=20261110-audience-source-groups';
import { createDropdownTransition } from './dropdown-transition.js?v=20261026-drafting-card-size';
import { tokenNumber, tokenValue, breakpointQuery } from './design-system/runtime.js?v=20261026-drafting-card-size';
import { createIcon } from './icons.js?v=20261026-drafting-card-size';
import { bindTapActivation } from './tap-activation.js?v=20261026-drafting-card-size';
import { toolFavorites } from './tool-favorites.js?v=20261105-filter-settings';
import { bindTabSelection } from './selection-controls.js?v=20261026-drafting-card-size';
import { createTabPanelTransition } from './tab-panel-transition.js?v=20261026-drafting-card-size';

export function createToolDropdowns({ root = document, favoritesStore = toolFavorites, notify = () => {}, audienceSuggestions = null, onAudienceSourcesOpen = null, createSuggestionAnimation = createAudienceSuggestingAnimation } = {}) {
  const controls = [...root.querySelectorAll('.composer-field, .results-sort-field, .results-source-field, .feedback-select-field, .editor-style-field, .word-count-field')].map(field => {
    const select = field.querySelector('select');
    const label = field.dataset.label;
    const draftSetting = field.matches('.composer-field') && ['Format', 'Audience', 'Voice'].includes(label);
    const sourceFilter = field.matches('.results-source-field');
    if (sourceFilter) select.multiple = true;
    const key = sourceFilter ? 'source' : draftSetting ? label.toLowerCase() : select.id.replace(/^(composer-|output-edit-)/, '');
    const supportsFavorites = sourceFilter || (draftSetting && ['format', 'audience'].includes(key));
    const suggestionProvider = draftSetting && key === 'audience' ? audienceSuggestions : null;
    const favoriteChoice = option => Boolean(option.value) && !(sourceFilter && option.value === 'all');
    let opensUp = false;
    field.dataset.tool = key;
    if (field.dataset.fixedValue) {
      const value = field.dataset.fixedValue;
      const display = document.createElement('div');
      display.className = 'tool-fixed-value';
      display.textContent = [...select.options].find(option => option.value === value).textContent;
      display.setAttribute('aria-label', `${label}: ${display.textContent}`);
      field.append(display);
      function refresh() {
        select.value = value;
        field.dataset.hasValue = 'true';
      }
      select.addEventListener('change', refresh);
      refresh();
      return { connected: () => field.isConnected, contains: target => field.contains(target), close() {}, refresh };
    }
    const editorStyle = field.matches('.editor-style-field');
    const floating = field.matches('.feedback-select-field') || editorStyle || sourceFilter;
    const inWorkspacePanel = Boolean(field.closest('#composer-tools, .composer-tools'));
    const mobileWorkspacePanel = () => inWorkspacePanel && window.matchMedia(breakpointQuery()).matches;
    const placeholder = field.dataset.placeholder || (draftSetting ? label : ['format', 'audience', 'voice'].includes(key) ? `Select ${label}` : label);
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'tool-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', supportsFavorites ? 'dialog' : 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', `${select.id}-options`);
    const text = document.createElement('span');
    const singleChevron = draftSetting || sourceFilter || field.matches('.results-sort-field');
    const chevron = createIcon(singleChevron ? 'keyboard_arrow_down' : 'unfold_less', 'tool-dropdown-chevron');
    trigger.append(text, chevron);
    const fieldLabel = field.querySelector('.composer-field-label');
    const readyDot = suggestionProvider && fieldLabel ? document.createElement('span') : null;
    if (readyDot) {
      readyDot.className = 'audience-ready-dot';
      readyDot.setAttribute('aria-hidden', 'true');
      readyDot.hidden = true;
      fieldLabel.classList.add('audience-ready-label');
      fieldLabel.append(readyDot);
    }

    const menu = document.createElement('div');
    menu.id = `${select.id}-options`;
    menu.className = 'tool-dropdown-menu';
    menu.hidden = true;
    if (supportsFavorites) {
      menu.setAttribute('role', 'dialog');
      menu.setAttribute('aria-label', `${label} options`);
    }
    const list = document.createElement('div');
    list.id = `${select.id}-choices`;
    list.className = 'tool-dropdown-list';
    list.setAttribute('role', supportsFavorites ? 'group' : 'listbox');
    list.setAttribute('aria-label', label);
    let rows = [];
    let displayedRows = [];
    let optionsSignature = '';
    let suggestedRows = [];
    let suggestedSignature = '';
    let selectedSuggestedChoice = null;
    let activeTab = 'all';
    let contextKey;
    let contextSignature = '';
    let suggestions = [];
    let suggestionGroups = [];
    let available = false;
    let busy = false;
    let readyToReview = false;
    const readyLabel = 'Audience Generation Ready to Review';
    let suggestionError = '';
    let requestSequence = 0;
    let suggestionWait = null;
    let panelAnimation = null;
    let triggerAnimation = null;
    let destroyed = false;
    let tabs, tabItems, tabSelection, suggestionPanel, panelTransition;
    let suggestionView, suggestionList, suggestionStatus, suggestionErrorMessage, suggestionActions, suggestionAction, suggestionLoading;

    function descriptors(items) {
      const seen = new Set();
      return (Array.isArray(items) ? items : []).filter(item => {
        if (!item || typeof item.value !== 'string' || !item.value || typeof item.label !== 'string' || !item.label.trim() || seen.has(item.value)) return false;
        seen.add(item.value);
        return true;
      }).map(({ value, label }) => ({ value, label }));
    }
    function cancelSuggestionWait() {
      if (!suggestionWait) return;
      clearTimeout(suggestionWait.timer);
      suggestionWait.resolve(false);
      suggestionWait = null;
    }
    function waitForSuggestions() {
      return new Promise(resolve => {
        suggestionWait = { resolve, timer: setTimeout(() => {
          suggestionWait = null;
          resolve(true);
        }, tokenNumber('component.drafting.audience-suggest-duration')) };
      });
    }
    function syncSuggestionContext() {
      if (!suggestionProvider) return;
      const context = suggestionProvider.getContext();
      const current = descriptors(context.suggestions);
      suggestionGroups = (Array.isArray(context.groups) ? context.groups : []).filter(group => group && typeof group.id === 'string' && typeof group.key === 'string').map(group => ({
        id: group.id, key: group.key, suggestions: descriptors(group.suggestions),
        sources: (Array.isArray(group.sources) ? group.sources : []).filter(source => typeof source?.title === 'string').map(source => ({ title: source.title })),
      })).filter(group => group.suggestions.length);
      const signature = JSON.stringify(current);
      if (context.key !== contextKey) {
        contextKey = context.key;
        requestSequence++;
        cancelSuggestionWait();
        busy = false;
        readyToReview = false;
        suggestionError = '';
        suggestions = current;
      } else if (!busy && signature !== contextSignature) suggestions = current;
      contextSignature = signature;
      available = Boolean(context.available);
      if (!available || select.disabled) readyToReview = false;
    }
    function syncSuggestionOptions() {
      if (!suggestionProvider) return;
      const known = new Set([...select.options].map(option => option.value));
      const value = select.value;
      for (const choice of descriptors([...suggestionProvider.getOptions(), ...suggestions, ...suggestionGroups.flatMap(group => group.suggestions)])) {
        if (known.has(choice.value)) continue;
        const option = document.createElement('option');
        option.value = choice.value;
        option.textContent = choice.label;
        select.append(option);
        known.add(choice.value);
      }
      if (select.value !== value) select.value = value;
    }
    function sourceSummary(group) {
      return group.sources.length ? group.sources.map(source => source.title).join(' + ') : 'Source details were not saved';
    }
    function createChoiceRow(option, { groupId = '', describedBy = '' } = {}) {
      const row = document.createElement('div');
      row.className = 'tool-dropdown-row';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tool-dropdown-option';
      button.dataset.emptyChoice = String(draftSetting && !option.value);
      button.disabled = option.disabled;
      if (sourceFilter) button.setAttribute('role', 'checkbox');
      else if (!supportsFavorites) button.setAttribute('role', 'option');
      button.tabIndex = supportsFavorites ? 0 : -1;
      button.textContent = option.textContent;
      if (describedBy) button.setAttribute('aria-describedby', describedBy);
      button.append(createIcon('check', 'tool-dropdown-check'));
      bindTapActivation(button, () => {
        if (!transition.expanded || select.disabled || option.disabled) return;
        // Generated choices use the same native change path as catalog choices.
        syncSuggestionOptions();
        if (suggestionProvider) selectedSuggestedChoice = groupId ? { value: option.value, groupId } : null;
        if (sourceFilter && option.value !== 'all') {
          option.selected = !option.selected;
          const all = [...select.options].find(choice => choice.value === 'all');
          if (all) all.selected = false;
          if (![...select.options].some(choice => choice.selected)) select.value = 'all';
        } else select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        if (sourceFilter) button.focus({ preventScroll: true });
        else close(true);
      });
      row.append(button);
      let favorite;
      if (supportsFavorites && favoriteChoice(option)) {
        favorite = document.createElement('button');
        favorite.type = 'button';
        favorite.className = 'tool-option-favorite';
        favorite.append(createIcon('favorite'));
        if (describedBy) favorite.setAttribute('aria-describedby', describedBy);
        bindTapActivation(favorite, () => {
          if (!transition.expanded || select.disabled) return;
          const { saved, persisted } = favoritesStore.toggle(key, option.value);
          if (saved && groupId && activeTab === 'suggested') suggestionView.scrollTop = 0;
          if (!persisted) notify('Favorites updated for this session only. Browser storage is unavailable');
        });
        row.append(favorite);
      }
      return { row, button, favorite, option, groupId };
    }
    function refreshRows() {
      // Keep generated options in the native select for saved settings and the
      // selected trigger label, but show them only in the Suggested tab.
      const generatedValues = new Set(suggestionProvider ? descriptors([
        ...suggestionProvider.getOptions(), ...suggestions, ...suggestionGroups.flatMap(group => group.suggestions),
      ]).map(choice => choice.value) : []);
      const options = [...select.options].filter(option => !suggestionProvider
        || (!generatedValues.has(option.value) && !option.value.startsWith('suggested-audience:')));
      const signature = JSON.stringify(options.map(option => [option.value, option.textContent, option.disabled]));
      if (signature === optionsSignature && options.every((option, index) => rows[index]?.option === option)) return;
      optionsSignature = signature;
      rows = options.map(option => createChoiceRow(option));
      list.replaceChildren(...rows.map(({ row }) => row));
      displayedRows = rows;
    }
    function refreshSuggestedRows() {
      if (!suggestionProvider) return;
      const sourceGroups = suggestionGroups.length ? [...suggestionGroups].sort((a, b) => Number(b.key === contextKey) - Number(a.key === contextKey))
        : suggestions.length ? [{ id: 'current', key: contextKey, sources: [], suggestions }] : [];
      const favorites = new Set(favoritesStore.values(key));
      // Favorites share a compact section above the source-grouped choices.
      const groups = [true, false].flatMap(saved => sourceGroups.map(group => ({
        ...group, favorite: saved,
        suggestions: group.suggestions.filter(choice => favorites.has(choice.value) === saved),
      })).filter(group => group.suggestions.length));
      const optionFor = value => [...select.options].find(option => option.value === value);
      const signature = JSON.stringify([contextKey, groups, [...select.options].map(option => [option.value, option.disabled])]);
      if (signature === suggestedSignature && suggestedRows.every(choice => optionFor(choice.option.value) === choice.option)) return;
      suggestedSignature = signature;
      suggestedRows = [];
      const children = [];
      const empty = groups.length && optionFor('');
      if (empty) {
        const choice = createChoiceRow(empty);
        suggestedRows.push(choice);
        children.push(choice.row);
      }
      let favoriteSection;
      groups.forEach((group, index) => {
        if (group.favorite) {
          if (!favoriteSection) {
            favoriteSection = document.createElement('div');
            favoriteSection.className = 'audience-suggestion-group';
            favoriteSection.setAttribute('role', 'group');
            favoriteSection.setAttribute('aria-label', 'Favorite audiences');
            children.push(favoriteSection);
          }
          for (const descriptor of group.suggestions) {
            const option = optionFor(descriptor.value);
            if (!option) continue;
            const choice = createChoiceRow(option, { groupId: group.id });
            choice.button.title = sourceSummary(group);
            suggestedRows.push(choice);
            favoriteSection.append(choice.row);
          }
          return;
        }
        const section = document.createElement('div');
        section.className = 'audience-suggestion-group';
        section.dataset.generation = group.id;
        section.setAttribute('role', 'group');
        const header = document.createElement('div');
        header.className = 'audience-generation-header';
        header.id = `${select.id}-generation-${index}`;
        header.title = sourceSummary(group);
        const label = document.createElement('p');
        label.className = 'audience-generation-label';
        const count = group.sources.length;
        label.append(createIcon('folder_open'));
        const caption = document.createElement('span');
        caption.textContent = count ? 'Suggested from ' : 'Previously suggested';
        if (count) {
          const sourceCount = document.createElement(onAudienceSourcesOpen ? 'button' : 'span');
          sourceCount.textContent = `${count} ${count === 1 ? 'source' : 'sources'}`;
          sourceCount.title = sourceSummary(group);
          if (onAudienceSourcesOpen) {
            sourceCount.type = 'button';
            sourceCount.className = 'text-button audience-generation-source-link';
            sourceCount.setAttribute('aria-label', `Open Sources panel with ${count} ${count === 1 ? 'source' : 'sources'} used for these audiences`);
            bindTapActivation(sourceCount, () => {
              if (!transition.expanded || select.disabled || busy) return;
              close(false, { animate: false });
              onAudienceSourcesOpen(group.id);
            });
          }
          caption.append(sourceCount);
        }
        label.append(caption);
        header.append(label);
        if (group.key === contextKey && count) {
          const current = document.createElement('span');
          current.className = 'audience-generation-current';
          current.textContent = 'Current source selection';
          header.append(current);
        }
        section.setAttribute('aria-labelledby', header.id);
        section.append(header);
        for (const descriptor of group.suggestions) {
          const option = optionFor(descriptor.value);
          if (!option) continue;
          const choice = createChoiceRow(option, { groupId: group.id, describedBy: header.id });
          suggestedRows.push(choice);
          section.append(choice.row);
        }
        children.push(section);
      });
      suggestionList.replaceChildren(...children);
    }
    const activeRows = () => suggestionProvider && activeTab === 'suggested' ? busy ? [] : suggestedRows : displayedRows;
    function renderSuggestionLoading() {
      if (!suggestionProvider) return;
      if (busy && !panelAnimation) {
        panelAnimation = createSuggestionAnimation();
        triggerAnimation = createSuggestionAnimation({ compact: true });
        suggestionLoading.append(panelAnimation.element);
        trigger.append(triggerAnimation.element);
      } else if (!busy && panelAnimation) {
        for (const animation of [panelAnimation, triggerAnimation]) {
          animation.destroy();
          animation.element.remove();
        }
        panelAnimation = triggerAnimation = null;
      }
      suggestionLoading.hidden = !busy;
      const closedBusy = busy && !transition.expanded;
      const closedReady = readyToReview && !busy && !transition.expanded && !select.disabled;
      trigger.dataset.suggesting = String(closedBusy);
      trigger.dataset.suggestionsReady = String(closedReady);
      if (readyDot) readyDot.hidden = !closedReady;
      const selected = select.options[select.selectedIndex];
      text.textContent = closedReady ? readyLabel : select.value && selected ? selected.textContent : placeholder;
      trigger.title = closedReady ? readyLabel : select.title;
      trigger.setAttribute('aria-busy', String(busy));
      trigger.setAttribute('aria-label', busy ? 'Audience: Suggesting Audiences' : closedReady ? `Audience: ${readyLabel}` : select.value || (draftSetting && placeholder !== label) ? `${label}: ${text.textContent}` : text.textContent);
      if (triggerAnimation) triggerAnimation.element.hidden = !closedBusy;
    }
    function renderSuggestionState() {
      if (!suggestionProvider) return;
      list.hidden = activeTab !== 'all';
      suggestionView.hidden = activeTab !== 'suggested';
      tabSelection.sync(activeTab);
      suggestionView.setAttribute('aria-busy', String(busy));
      suggestionView.dataset.hasHistory = String(suggestedRows.length > 0);
      const complete = suggestions.length > 0 && !busy && !suggestionError;
      if (complete && transition.expanded && activeTab === 'suggested' && document.activeElement === suggestionAction) {
        (suggestedRows.find(choice => choice.option.value && !choice.button.disabled)?.button || tabItems.find(tab => tab.value === activeTab)).focus({ preventScroll: true });
      }
      suggestionStatus.hidden = complete || busy;
      suggestionList.hidden = busy || !suggestedRows.length;
      suggestionStatus.textContent = complete ? '' : busy ? 'Suggesting audiences…'
        : !available ? 'Add a source to suggest audiences'
        : suggestionGroups.length ? 'Suggest audiences for your current source selection.'
        : 'Suggest audiences based on your project sources.';
      suggestionErrorMessage.textContent = suggestionError;
      suggestionErrorMessage.hidden = !suggestionError;
      suggestionActions.hidden = complete || busy;
      suggestionAction.textContent = busy ? 'Suggesting Audiences…' : suggestionError ? 'Try Again' : 'Suggest Audiences';
      suggestionAction.className = 'primary-button audience-suggestion-action';
      suggestionAction.disabled = complete || busy || !available || select.disabled;
      renderSuggestionLoading();
      if (transition.expanded) positionMenu();
    }
    async function generateSuggestions() {
      suggestionProvider.prepare?.();
      syncSuggestionContext();
      if (busy || !available || select.disabled || destroyed) { refresh(); return; }
      const keyAtStart = contextKey;
      const sequence = ++requestSequence;
      busy = true;
      readyToReview = false;
      suggestionError = '';
      const focusResults = document.activeElement === suggestionAction;
      if (focusResults) tabItems.find(tab => tab.value === activeTab).focus({ preventScroll: true });
      renderSuggestionState();
      try {
        if (!await waitForSuggestions() || destroyed) return;
        suggestionProvider.prepare?.();
        if (sequence !== requestSequence || suggestionProvider.getContext().key !== keyAtStart) { refresh(); return; }
        if (!suggestionProvider.getContext().available) { busy = false; refresh(); return; }
        const result = descriptors(await suggestionProvider.generate());
        if (destroyed) return;
        if (sequence !== requestSequence || suggestionProvider.getContext().key !== keyAtStart) { refresh(); return; }
        if (!suggestionProvider.getContext().available) { busy = false; refresh(); return; }
        if (result.length !== 3) throw new Error('Expected three audience suggestions');
        // Read the provider snapshot before assigning the returned results so
        // providers can persist either during generation or on their next refresh.
        contextSignature = JSON.stringify(descriptors(suggestionProvider.getContext().suggestions));
        suggestions = result;
        busy = false;
        // Only signal unread results when completion happens outside the menu.
        // The chosen audience value stays intact until the user selects a row.
        readyToReview = !transition.expanded;
        refresh();
        if (focusResults && transition.expanded && activeTab === 'suggested' && document.activeElement === tabItems.find(tab => tab.value === activeTab)) {
          suggestedRows.find(choice => choice.option.value && !choice.button.disabled)?.button.focus({ preventScroll: true });
        }
        notify('Suggested audiences are ready');
      } catch {
        if (destroyed) return;
        if (sequence !== requestSequence || suggestionProvider.getContext().key !== keyAtStart) { refresh(); return; }
        if (!suggestionProvider.getContext().available) { busy = false; refresh(); return; }
        busy = false;
        readyToReview = false;
        suggestionError = 'Couldn’t suggest audiences. Try again';
        refresh();
      }
    }
    if (suggestionProvider) {
      menu.dataset.audienceSuggestions = 'true';
      tabs = document.createElement('div');
      tabs.className = 'output-status-tabs audience-suggestion-tabs';
      tabs.setAttribute('aria-label', 'Audience choices');
      tabItems = ['all', 'suggested'].map(value => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.id = `${select.id}-${value}-tab`;
        tab.value = value;
        const tabLabel = value === 'all' ? 'All Audiences' : 'Suggested';
        tab.setAttribute('aria-label', tabLabel);
        if (value === 'suggested') tab.append(createIcon('wand_stars'), document.createTextNode(tabLabel));
        else tab.textContent = tabLabel;
        tabs.append(tab);
        return tab;
      });
      suggestionPanel = document.createElement('div');
      suggestionPanel.id = `${select.id}-audience-panel`;
      suggestionPanel.className = 'output-status-content audience-suggestion-panel';
      suggestionView = document.createElement('div');
      suggestionView.className = 'audience-suggestion-view';
      suggestionLoading = document.createElement('div');
      suggestionLoading.className = 'audience-suggestion-loading';
      suggestionLoading.hidden = true;
      suggestionStatus = document.createElement('p');
      suggestionStatus.className = 'saved-drafts-empty';
      suggestionStatus.setAttribute('role', 'status');
      suggestionStatus.setAttribute('aria-live', 'polite');
      suggestionErrorMessage = document.createElement('p');
      suggestionErrorMessage.className = 'form-error';
      suggestionErrorMessage.setAttribute('role', 'alert');
      suggestionList = document.createElement('div');
      suggestionList.className = 'tool-dropdown-list';
      suggestionList.setAttribute('role', 'group');
      suggestionList.setAttribute('aria-label', 'Suggested audiences');
      suggestionActions = document.createElement('div');
      suggestionActions.className = 'audience-suggestion-actions';
      suggestionAction = document.createElement('button');
      suggestionAction.type = 'button';
      suggestionAction.addEventListener('click', () => { if (transition.expanded && !suggestionAction.disabled && !suggestionActions.hidden) void generateSuggestions(); });
      suggestionActions.append(suggestionAction);
      suggestionView.append(suggestionLoading, suggestionStatus, suggestionErrorMessage, suggestionActions, suggestionList);
      suggestionPanel.append(list, suggestionView);
      menu.append(tabs, suggestionPanel);
      panelTransition = createTabPanelTransition(suggestionPanel);
      tabSelection = bindTabSelection({ root: tabs, items: tabItems, panel: suggestionPanel, onSelect(value) {
        activeTab = value;
        panelTransition.run(() => refresh());
      } });
    } else menu.append(list);
    field.append(trigger, menu);
    const transition = createDropdownTransition(menu, { onClosed: settleMenu });

    function settleMenu() {
      if (menu.parentElement !== field) field.append(menu);
      delete menu.dataset.workspaceDropdown;
      menu.removeAttribute('style');
    }
    function refreshFavorites() {
      if (!supportsFavorites) return;
      const favorites = new Set(favoritesStore.values(key));
      for (const { favorite, option } of [...rows, ...suggestedRows]) {
        if (!favorite) continue;
        const saved = favorites.has(option.value);
        favorite.setAttribute('aria-pressed', String(saved));
        const favoriteLabel = saved ? `Remove ${option.textContent} from favorites` : `Add ${option.textContent} to favorites`;
        favorite.setAttribute('aria-label', favoriteLabel);
        favorite.title = favoriteLabel;
      }
      // Keep reset first, then favorites and remaining choices in catalog order.
      const rank = ({ option }) => !favoriteChoice(option) ? 0 : favorites.has(option.value) ? 1 : 2;
      const ordered = [...rows].sort((a, b) => rank(a) - rank(b));
      if (ordered.some((choice, index) => choice !== displayedRows[index])) {
        const active = list.contains(document.activeElement) ? document.activeElement : null;
        list.append(...ordered.map(({ row }) => row));
        if (active && document.activeElement !== active) active.focus({ preventScroll: true });
      }
      displayedRows = ordered;
      if (transition.expanded) positionMenu();
    }
    const unsubscribeFavorites = supportsFavorites ? favoritesStore.subscribe(suggestionProvider ? refresh : refreshFavorites) : () => {};
    function refresh() {
      const focusedRows = activeRows();
      const focused = focusedRows.find(choice => choice.row.contains(document.activeElement));
      const focusFavorite = focused && document.activeElement === focused.favorite;
      syncSuggestionContext();
      syncSuggestionOptions();
      refreshRows();
      refreshSuggestedRows();
      trigger.disabled = select.disabled;
      field.dataset.hasValue = String(Boolean(select.value));
      trigger.title = select.title;
      if (select.disabled) close(false, { animate: false });
      const selected = select.options[select.selectedIndex];
      const selectedPublications = sourceFilter ? [...select.options].filter(option => option.selected && option.value !== 'all').map(option => option.textContent) : [];
      const selectedLabel = sourceFilter
        ? selectedPublications.length > 2 ? `${selectedPublications.length} publications` : selectedPublications.join(' + ') || 'All sources'
        : select.value && selected ? selected.textContent : placeholder;
      text.textContent = selectedLabel;
      const accessibleLabel = sourceFilter ? selectedPublications.join(', ') || 'All sources' : selectedLabel;
      trigger.setAttribute('aria-label', select.value || (draftSetting && placeholder !== label) ? `${label}: ${accessibleLabel}` : accessibleLabel);
      if (sourceFilter) trigger.title = accessibleLabel;
      // One audience value can occur in several source generations. Track the
      // clicked occurrence separately so only that row receives a checkmark.
      const matchingSuggestions = suggestedRows.filter(choice => choice.groupId && choice.option.selected);
      const checkedSuggestion = matchingSuggestions.find(choice => choice.option.value === selectedSuggestedChoice?.value
        && choice.groupId === selectedSuggestedChoice?.groupId) || matchingSuggestions[0];
      selectedSuggestedChoice = checkedSuggestion ? { value: checkedSuggestion.option.value, groupId: checkedSuggestion.groupId } : null;
      [...rows, ...suggestedRows].forEach(choice => {
        const { row, button, option, groupId } = choice;
        const checked = option.selected && (!groupId || choice === checkedSuggestion);
        row.dataset.selected = String(checked);
        button.setAttribute(sourceFilter ? 'aria-checked' : supportsFavorites ? 'aria-pressed' : 'aria-selected', String(checked));
      });
      refreshFavorites();
      renderSuggestionState();
      if (suggestionProvider && transition.expanded && focused) {
        const replacement = activeRows().find(choice => choice.option.value === focused.option.value && choice.groupId === focused.groupId);
        if (replacement && replacement !== focused) (focusFavorite ? replacement.favorite || replacement.button : replacement.button).focus({ preventScroll: true });
        else if (!replacement) tabItems.find(tab => tab.value === activeTab).focus({ preventScroll: true });
      }
    }
    function close(restoreFocus = false, { animate = true } = {}) {
      field.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
      if (restoreFocus) trigger.focus({ preventScroll: true });
      panelTransition?.cancel();
      transition.close({ animate });
      renderSuggestionLoading();
    }
    function positionMenu() {
      if (floating || inWorkspacePanel || suggestionProvider) {
        const bounds = trigger.getBoundingClientRect();
        const below = document.documentElement.clientHeight - bounds.bottom - tokenNumber('foundation.space.12') - (suggestionProvider ? tokenNumber('foundation.space.8') : 0);
        const topLimit = mobileWorkspacePanel() ? tokenNumber('foundation.size.90') : tokenNumber('foundation.space.12');
        const above = bounds.top - topLimit - tokenNumber('foundation.space.8');
        opensUp = below < tokenNumber('foundation.size.160') && above > below;
        const menuWidth = editorStyle ? Math.min(tokenNumber('foundation.size.220'), document.documentElement.clientWidth - tokenNumber('foundation.space.24')) : suggestionProvider ? Math.min(bounds.width, document.documentElement.clientWidth - tokenNumber('foundation.space.24')) : bounds.width;
        menu.style.position = 'fixed';
        menu.style.left = `${editorStyle || suggestionProvider ? Math.max(tokenNumber('foundation.space.12'), Math.min(bounds.left, document.documentElement.clientWidth - menuWidth - tokenNumber('foundation.space.12'))) : bounds.left}px`;
        menu.style.right = 'auto';
        menu.style.width = `${menuWidth}px`;
        menu.style.maxHeight = `${Math.max(suggestionProvider ? 0 : tokenNumber('foundation.size.80'), Math.min(tokenNumber('foundation.size.360'), opensUp ? above : below))}px`;
        menu.style.top = `${opensUp ? Math.max(topLimit, bounds.top - menu.getBoundingClientRect().height - tokenNumber('foundation.space.8')) : bounds.bottom + tokenNumber('foundation.space.8')}px`;
      }
    }
    function open() {
      if (select.disabled) return;
      closeAll(menu);
      if (supportsFavorites) favoritesStore.refresh();
      refresh();
      if (readyToReview) {
        readyToReview = false;
        activeTab = 'suggested';
        renderSuggestionState();
      }
      if (inWorkspacePanel || editorStyle || sourceFilter || suggestionProvider) {
        document.body.append(menu);
        menu.dataset.workspaceDropdown = 'true';
        menu.style.zIndex = tokenValue('foundation.layer.30');
      }
      menu.hidden = false;
      field.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
      positionMenu();
      transition.open({ opensUp });
      renderSuggestionLoading();
      const selected = displayedRows.find(choice => choice.option.selected && !choice.button.disabled);
      (suggestionProvider ? tabItems.find(tab => tab.value === activeTab) : selected?.button || displayedRows.find(choice => !choice.button.disabled)?.button)?.focus({ preventScroll: true });
    }
    trigger.addEventListener('click', () => { if (!transition.expanded) open(); else close(true); });
    trigger.addEventListener('keydown', event => {
      if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
      event.preventDefault();
      open();
    });
    menu.addEventListener('keydown', event => {
      if (!transition.expanded || event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); close(true); return;
      }
      const visible = activeRows().filter(choice => !choice.button.disabled);
      if (event.key === 'Tab') {
        if (!supportsFavorites) { close(true); return; }
        const targets = [
          ...(suggestionProvider ? [tabItems.find(tab => tab.value === activeTab)] : []),
          ...(suggestionProvider && activeTab === 'suggested' && !suggestionAction.disabled ? [suggestionAction] : []),
          ...visible.flatMap(choice => [choice.button, choice.favorite].filter(Boolean)),
        ];
        if (document.activeElement === (event.shiftKey ? targets[0] : targets.at(-1))) close(true);
        return;
      }
      if (suggestionProvider && activeTab === 'suggested' && !visible.length && ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        (suggestionAction.disabled ? tabItems.find(tab => tab.value === activeTab) : suggestionAction).focus();
        return;
      }
      if (!visible.length) return;
      const index = visible.findIndex(choice => choice.row.contains(document.activeElement));
      if (supportsFavorites && index >= 0 && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        (event.key === 'ArrowRight' ? visible[index].favorite || visible[index].button : visible[index].button).focus();
        return;
      }
      if (suggestionProvider && activeTab === 'suggested' && !suggestionAction.disabled) {
        const onAction = document.activeElement === suggestionAction;
        if (onAction && ['ArrowDown', 'ArrowUp', 'End'].includes(event.key)) {
          event.preventDefault(); (event.key === 'ArrowDown' ? visible[0] : visible.at(-1)).button.focus(); return;
        }
        if (event.key === 'Home' || (event.key === 'ArrowUp' && index === 0) || (event.key === 'ArrowDown' && (tabs.contains(event.target) || index === visible.length - 1))) {
          event.preventDefault(); suggestionAction.focus(); return;
        }
      }
      const next = event.key === 'ArrowDown' ? (index + 1) % visible.length
        : event.key === 'ArrowUp' ? (index < 0 ? visible.length - 1 : (index - 1 + visible.length) % visible.length)
        : event.key === 'Home' ? 0 : event.key === 'End' ? visible.length - 1 : null;
      if (next === null) return;
      event.preventDefault();
      const moveFavorite = supportsFavorites && index >= 0 && document.activeElement === visible[index].favorite;
      (moveFavorite ? visible[next]?.favorite || visible[next]?.button : visible[next]?.button)?.focus();
    });
    select.addEventListener('change', refresh);
    if (floating || inWorkspacePanel || suggestionProvider) {
      document.addEventListener('scroll', event => {
        if (menu.hidden || menu.contains(event.target)) return;
        if (sourceFilter && transition.expanded) {
          // Filtering can change the results height and adjust the canvas scroll.
          // Keep the multi-select anchored so another publication can be chosen.
          const bounds = trigger.getBoundingClientRect();
          if (bounds.bottom > 0 && bounds.top < document.documentElement.clientHeight) {
            positionMenu();
            return;
          }
        }
        close();
      }, true);
      window.addEventListener('resize', () => close());
    }
    refresh();
    return {
      menu,
      connected: () => field.isConnected,
      contains: target => field.contains(target) || menu.contains(target),
      close,
      refresh() { transition.settle(); refresh(); },
      destroy() { destroyed = true; requestSequence++; cancelSuggestionWait(); busy = false; readyToReview = false; renderSuggestionLoading(); tabSelection?.destroy(); panelTransition?.destroy(); unsubscribeFavorites(); transition.destroy(); },
    };
  });

  function closeAll(exceptMenu = null) { controls.forEach(control => { if (control.menu !== exceptMenu) control.close(); }); }
  const removalObserver = typeof MutationObserver === 'function' ? new MutationObserver(() => {
    controls.forEach(control => { if (!control.connected()) control.close(false, { animate: false }); });
  }) : null;
  removalObserver?.observe(document.body, { childList: true, subtree: true });
  // On touch browsers, moving between buttons can blur to the page before click.
  // Close on an actual outside interaction, not that temporary loss of focus.
  for (const eventName of ['pointerdown', 'focusin']) {
    document.addEventListener(eventName, event => {
      controls.forEach(control => { if (!control.contains(event.target)) control.close(); });
    });
  }
  const onStorage = () => favoritesStore.refresh();
  window.addEventListener('storage', onStorage);
  return {
    close: closeAll,
    refresh: () => controls.forEach(control => control.refresh()),
    destroy() { window.removeEventListener('storage', onStorage); removalObserver?.disconnect(); controls.forEach(control => control.destroy?.()); closeAll(); },
  };
}
