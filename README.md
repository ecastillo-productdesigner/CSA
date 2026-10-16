# CSA

A responsive implementation of the supplied CSA designs. Plain HTML, CSS, and JavaScript with a locally bundled Quill editor and no build step.

## Published website

Open [CSA](https://ecastillo-productdesigner.github.io/CSA/). Changes pushed to `main` automatically deploy the `dist` folder through GitHub Pages.

The site opens with a demo password screen. Access lasts for the current tab session, including refreshes. Choose **Lock demo** in the profile menu to require the password again. This browser-only gate is bypassable and does not protect the public repository, source files, or assets. It is only intended for casual demo sharing. The password digest is configured in `dist/demo-access.js`; no password is sent to a server.

## Run locally

With Node.js 20 or newer installed:

```sh
cd CSA
npm run dev
```

Open http://localhost:4173. Set `PORT` to change the port.

## What's included

- Project dashboard with three cards per row on wide screens, two at intermediate widths, and one on narrow screens. Cards show the project date and number of generated variants, excluding pending cards. Active cards have one full-width Open button; Archive and Delete remain in Recents. The pink badge reads Draft until a variant is marked sent, then shows “1 variant sent to CMS” or the plural sent count. Sent counts are distinct variants, so repeated sends of the same variant do not increase them. Counts and sent status persist in browser storage. The homepage shows active projects without collection tabs.
- Archive and Delete remain available in Recents and both offer Undo. Archived and deleted records stay in browser storage and are hidden from the homepage; no permanent deletion is performed.
- Search entry opens a results page matching the supplied design, with four article cards initially, a total matching-story count, source/date filters, and Load more. Its custom rounded sort menu offers Newest, Oldest, and Relevance, with a highlighted current choice, checkmark, and keyboard controls matching Tools. Relevance uses query matches in the sample headline and excerpt. Counts update with filters, including singular and zero-result states. Clicking a card selects or unselects it. The 16px icon in its top-right corner remains visible but is inactive and opens nothing. Selecting a result shows a spinner and “Adding to CSA” in a reserved area to its right. After three seconds, that area shows Inspect; it opens a read-only fictional article with its heading and five paragraphs. On narrow screens, the status sits below the card, aligned right. Each selection has its own timer, deselecting clears its status, and sorting/filtering keeps progress. Leaving the search clears timers; previously saved selections reopen with Inspect ready. Drafts retain the full sample article text as their sources. URL entry in either search opens the editor with a fictional sample story, Tools and Outputs, and the original link in Sources.
- Article selection and a Draft action that collects selected stories, or visible results when nothing is selected. Search drafts open Tools and Outputs beside a read-only fictional story with a heading and five paragraphs. After Create Output finishes, the preview disappears and the newest variant from that processing batch automatically opens in the editor. Its selected state persists across refresh and reopening, including when processing finishes while another project is open. Pending variants leave the current view visible until processing completes, and existing editor changes are saved before switching. Manually unselecting an output returns to a read-only preview of the latest completed variant, including saved edits. Deleting the newest output falls back to the next completed variant, or the original sample when none remain; Undo restores the matching preview. Sources and tool choices persist with the project. Material projects continue to open in the rich text editor.
- The New Project tile and sidebar plus open the blank workspace from the latest reference, with Tools and Outputs panels on the right. The compact Format, Audience, and Voice controls start with their field name and show the chosen value after selection. The fields have 14px vertical gaps. Their custom dropdowns use rounded white panels, subtle borders/shadows, and a selected checkmark. Menus support arrow keys, Home/End, Enter/Space, Escape, and outside-click dismissal; saved tool choices restore when reopening a project. Create Variant and Editorial Direction start disabled and both enable when any Format, Audience, or Voice choice is selected. Clearing every choice disables both again. The same state restores with saved choices; a selection in an empty workspace starts a browser-local draft so editorial direction can be saved.
- Create Variant adds a dashed, rounded card under Outputs with a random sample headline and badges for exactly the selected options. Format is peach, Audience is pink, and Voice is blue. Each card keeps its creation-time labels and editorial direction; multiple cards persist with the project. Creating a variant resets Format, Audience, and Voice and disables Create Variant and Editorial Direction until another choice is made. Card headlines are 14px bold. Tools and Outputs section headings share the same typography. Processing resumes after navigation or refresh. Pending cards have inactive bodies and dashed borders. Create Output simulates four seconds of processing, then makes the pending cards solid and interactive. Opening a solid card shows its own editable title and sample paragraphs; selecting it again returns to the original workspace. Variant edits are saved independently from the original material. The card’s top-right icon opens a Delete menu with keyboard/outside-click dismissal; deletion offers Undo and leaves other cards and original material intact.
- The editor body scrolls inside its own bounded area with scroll chaining contained, while its title, toolbar, and footer stay in place. Print/export retains the full document.
- Demo stories contain seven paragraphs with 20px paragraph gaps and no extra blank paragraph blocks. Untouched older samples receive the longer copy; edited stories keep their content and formatting.
- The homepage starts near the top of the screen. Its greeting stays in its starting position as the cards scroll. The first row has 16px of extra breathing room, and the top fade appears only after scrolling. A second fade softens the viewport’s bottom edge. The greeting appears first, followed by a short staggered card fade-in; reduced-motion preferences show everything immediately.
- A centered, 48px-high Send to WordPress button sits below the story area and above the word-count footer. It is enabled for generated variants, saves pending edits, and marks that variant as sent for the local demo. The homepage badge then counts it once. The notice explicitly identifies the action as a demo; WordPress publishing is not connected.
- The right Tools/Outputs rail stays 360px wide on desktop in both editor and unselected states. Both use the same spacing and responsive layout, including matching padding on narrower screens.
- Main action buttons share Continue’s 48px height, including dashboard actions, Draft, Create Variant, editorial direction, and dialog actions. Format, Audience, and Voice dropdown triggers are 36px tall with 10px corners and 14px gaps.
- Format and Audience dropdowns have a saved-choices heart and an inactive filter icon in their top bar. Row hearts appear on hover or keyboard focus (and remain visible for saved items and touch screens). Hearts save options without selecting them or closing the menu; the top heart switches between all and saved choices, including an empty state. Favorites persist in the current browser independently of project tool selections. Voice keeps its existing selection menu. Both dropdown types support keyboard navigation and Escape/outside-click dismissal.
- A curved share-arrow control sits at the top-right of Tools. It currently displays a coming-soon notice; no sharing service is connected.
- Search results have an inline **Editorial Direction (optional)** textarea above Draft, with framing guidance as its placeholder and help text below. It saves with the search project as you type and carries into the new draft. The former sliders button beside Draft is removed. The Tools settings icon continues to open the same direction in a modal. Source/date filters remain available through Filters above the results.
- The New Project tile and the sidebar plus on other pages open the Quick Start modal with search/URL entry and Continue, followed by a simple “or” divider, **Start from your own material**, and **Upload documents**. The modal is headed **New Project** and has no visible search label; the input keeps its accessible name. Upload opens the file picker directly, without a second modal, and also accepts drag-and-drop. Files can be reviewed and removed before starting. It supports PDF, DOCX, PPTX, TXT and Markdown, up to 10 MB each and 20 files. Starting opens an editor with Sources visible; text and Markdown also populate the draft. Original documents are saved in IndexedDB in the current browser and can be downloaded from Sources after refresh. Clicking the modal’s X closes it and returns to the homepage.
- **Start from your own material** closes the overlay and opens a full rich text editor in the underlying workspace alongside Tools and Outputs. Drafts include an editable title; headings, fonts, sizes, bold, italic, underline, strikethrough, text color, highlighting, links, lists, alignment, indentation, and clear formatting; undo/redo; browser spellcheck; word/character counts and reading time; Find and Replace; source links and author/tags metadata; HTML/text downloads, copy, and print/Save as PDF.
- Rich text and title/metadata changes automatically save to the current browser. Leaving the editor flushes pending edits, saved projects reopen from the dashboard, and refresh restores the open draft in the current tab. Existing plain text drafts migrate into the editor when opened. Save failures are shown in the editor, and downloads provide a local copy.
- The profile menu provides Home and Search & materials navigation, preserving the search/upload/paste starter alongside the new blank workspace.
- CSA uses light mode throughout. The profile flyover contains Home, Search & materials, and Lock demo; previous saved appearance preferences are no longer applied.
- File selection, drag and drop, and pasted text.
- The selected-story count appears in the results toolbar immediately before the total stories found and hides when nothing is selected.
- Hover over History to open a tall, rounded Recent projects panel beside the compact rail. It mirrors every active homepage project in the same order. Each row has a three-dot menu for Archive and Delete, with Undo. Archiving or deleting the open project saves its edits and returns home. Menus support arrow keys, Escape, and outside-click dismissal. Its list scrolls independently, and selecting a title reopens that project. Hover over the avatar to open the profile panel. Panels stay open while the pointer crosses into them and close shortly after it leaves. Clicking an icon pins its panel open for touch/click access; click again, use the close control, click outside, or press Escape to dismiss it. Keyboard focus also reveals the panels, and ArrowRight/ArrowDown enters their content. Long titles retain their ellipses.
- Recent project titles retain their trailing ellipses. Legacy fictional sample records remain in browser storage but are not added to Recents unless they are also homepage projects.
- New project navigation and a profile popover.
- The sidebar stays compact and uses standard cursors. Its plus is hidden on the homepage, where the New Project tile provides that action. It appears on other pages, shows a New project tooltip on hover, and opens the project starter on the first click. CSA always returns to the homepage. Floating navigation panels overlay the page without shifting it, and fit within narrow viewports.

In the project starter, the two material cards retain the earlier reference label: the left opens file selection, and the right opens text entry. The reference photo is represented by a local illustrated avatar.

## Prototype boundaries

There is no backend or AI integration yet. Search uses sample data and displays a matching-story count. Article previews and URL drafts are explicitly fictional demo content. Create Variant makes a prototype output card with a random sample headline and, after processing, seven sample paragraphs tailored to the headline’s creative theme. Each sample headline has its own distinct seven-paragraph demo story. Switching outputs changes the editor title and story together, while existing edited text and formatting are preserved. These are fixed demo stories rather than AI-generated article text. Editorial direction is saved for the prototype flow; it is not sent to an AI service. A search for Kelly Clarkson reproduces the reference's first four cards; other queries use topic-specific placeholder articles. URLs are not fetched. Original documents are retained locally in IndexedDB, with download controls. Text and Markdown include text previews; PDF, Word and PowerPoint contents are not extracted. Files are not sent to a server. Browser storage can be cleared by the browser and does not sync between devices.

The result portrait uses the user's supplied `Frame 109.png` as a local CSS image sprite. The original screenshot is retained unchanged in `dist/assets/search-reference.png`.

## Files

- `dist/index.html` — page structure and dialogs
- `dist/demo-access.js` — browser-only demo password screen and tab session
- `dist/styles.css` — layout, design tokens, and responsive styles
- `dist/app.js` — browser interactions and project storage
- `dist/documents.js` — browser-local original document storage and downloads
- `dist/recent-projects.js` — homepage-synchronized Recents and project action menus
- `dist/editor.js` — rich text editor, formatting, autosave, metadata, sources, search/replace, and export
- `dist/search.js` — sample search results, selection, sorting, filters, and draft handoff
- `dist/outputs.js` — sample variant cards, selected-option badges, and rendering
- `dist/tool-dropdowns.js` — styled Tools menus, keyboard interaction, and native-value synchronization
- `dist/dashboard.js` — project tiles, badges, archive/Trash collections, and card actions
- `scripts/serve.mjs` — local static preview server
- `.openai/hosting.json` — private Sites deployment configuration

Run `npm run check` for JavaScript syntax checks. Static hosting serves the `dist` folder directly.

## Editor dependency

Quill 2.0.3 is bundled under `dist/vendor/` from the official npm package. The editor works without runtime CDN requests. Quill's BSD license and its bundled dependency notices are retained alongside the assets. The upstream editor documentation is at https://quilljs.com/docs/quickstart.
