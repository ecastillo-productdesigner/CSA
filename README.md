# CSA

A responsive implementation of the supplied CSA designs. Plain HTML, CSS, and JavaScript with a locally bundled Quill editor. The app runs directly from `dist`; design-system styles are generated before publishing.

## Published website

Open [CSA](https://ecastillo-productdesigner.github.io/CSA/). Changes pushed to `Version-2.0` automatically deploy the `dist` folder through GitHub Pages.

The site opens with a demo password screen. Access lasts for the current tab session, including refreshes. Choose **Log Out** in the profile menu to end the demo session and require the password again. This browser-only gate is bypassable and does not protect the public repository, source files, or assets. It is only intended for casual demo sharing. The password digest is configured in `dist/demo-access.js`; no password is sent to a server.

## Run locally

With Node.js 20 or newer installed:

```sh
cd CSA
npm run dev
```

Open http://localhost:4173. Set `PORT` to change the port.

## What's included

- A responsive project dashboard with grid and list views, update dates, content counts, and a New Project action in both layouts. Project grid titles use 16 px Semibold; compact list titles use 14 px. Project menus offer Delete with a confirmation naming the project. The greeting, grid cards, and list rows enter together over 300 ms; reduced motion shows them immediately.
- New Project accepts article URLs and document uploads. The upload flow supports PDF, DOCX, PPTX, TXT, and Markdown, with a 10 MB per-file limit and at most 20 files. Validation and upload progress stay inside the modal.
- The **Project Sources** navigation item opens the project source panel. Its checkboxes follow the active draft’s exact saved source set as editor tabs change, with a live used-in-this-draft count. Editing a checkbox chooses sources for the next draft; the counter then describes that new-draft selection. New drafts capture only checked sources, while existing article text and saved source snapshots remain unchanged. Source-title previews work independently of selection. Source cards have white title/snippet areas and cream Publish Date/URL footers with a thin divider. Source headlines support preview, while original links open separately. Adding a source uses one centered paper, a Teal 50 shimmer, and the fixed label **Adding your Source**.
- A draft’s source-count chip opens an anchored **Sources Used** popover (**Source Used** for one source) showing only its saved source snapshots as full, regular-weight titles, with a folder heading and close button. Selecting a title opens the same source-preview modal used by the sidebar, using captured source text. The separate **Project Sources** sidebar stays closed and its selections remain unchanged.
- The **New Draft** panel contains Format, Audience, Voice, and optional Editorial Direction. Empty triggers show their purpose; **None Selected** clears a value. Choosing any recipe setting enables **Add to List**. Custom dropdowns use regular labels, a teal selected checkmark, neutral rows, visible keyboard focus, and arrow/Home/End navigation.
- The **Content** panel separates pending recipes and drafted content with text tabs. Pending cards use dashed outlines and whole-card selection without separate checkboxes. Multiple pending recipes can be selected and drafted together; completed cards open their saved article in the editor. Content tabs and dashboard view switches share keyboard-selection helpers with the DS examples.
- Drafting cards match the content-card footprint with a shared 90 px minimum height, 8 px corners, and a 1 px Neutral 200 (#E5E5E5) loading outline. Revision overlays preserve the active card’s outer footprint. They keep the fixed label **Drafting Content** while paper phases and selected recipe-category shimmer colors cycle. Format uses Rose 200, Audience Indigo 100, and Voice Orange 200. One category keeps its color; multiple categories cycle in Format/Audience/Voice order, skipping unselected categories. The shimmer sweeps over 2.4 seconds, with 5-second paper phases and 800 ms handoffs. Reduced motion keeps a static paper and label.
- **Request Revision** beside a drafted article opens an instructions dialog with the Material Symbols `edit_document` icon. Requests revise only that draft, retain its source snapshots and settings, and show progress before a completion notice.
- Listicle drafts use an introductory paragraph followed by four numbered Heading 2 sections, each with a topic-specific heading and paragraph.
- A locally bundled Quill editor supports rich text, individual draft titles and content, autosave, source access, and document export. Drafts appear in editor tabs with 14 px titles, Semibold when active. The prototype Send to CMS flow saves the chosen destination and local sent state; feedback controls collect and validate demo responses.
- Cream canvas and footers, white structural panels and inner cards, teal actions/selection/focus, and functional category/status/destructive colors share design tokens. Inter is the interface font; Newsreader supplies the homepage greeting. The DS documents six text sizes: 12, 14, 16, 20, 24, and 30 px.
- Mobile navigation, workspace panels, dialogs, menus, and desktop layouts share responsive component rules. Source selection, project data, draft edits, and processing state persist locally. Toasts use concise messages without a final period and an accessible icon-only Undo action when available.

## Prototype boundaries

There is no application backend or AI generation service. Keyword-search stories and generated article text are fictional demo content. Editorial Direction is saved locally and is not sent to an AI service. Article links can request public headline and description metadata; inaccessible pages fall back to information derived from the URL. This does not import a full article or generate factual reporting. The WordPress flow records a local demo state rather than publishing to a CMS.

Uploaded originals are retained in browser-local IndexedDB with download controls. Text and Markdown include text previews; PDF, Word, and PowerPoint contents are not extracted. Uploaded files are not sent to a server. Browser storage can be cleared and does not sync between devices.

The result portrait uses the user's supplied `Frame 109.png` as a local CSS image sprite. The original screenshot is retained unchanged in `dist/assets/search-reference.png`.

## Files

- `dist/index.html` — page structure and dialogs
- `dist/demo-access.js` — browser-only demo password screen and tab session
- `dist/styles.css` — generated layout and responsive styles; edit the sources in `styles/`
- `dist/app.js` — browser interactions and project storage
- `dist/documents.js` — browser-local original document storage and downloads
- `dist/editor.js` — rich text editor, formatting, autosave, metadata, sources, search/replace, and export
- `dist/search.js` — sample search results, selection, sorting, filters, and draft handoff
- `dist/outputs.js` — content cards, selected-option badges, drafting states, and rendering
- `dist/variant-feedback.js` — per-variant feedback form, validation, and submission
- `dist/content-card-editing.js` — content-card actions and deletion
- `dist/sources.js` — Project Sources panel, selection, and source actions
- `dist/draft-sources-popover.js` — anchored, read-only source snapshots for one draft
- `dist/tool-dropdowns.js` — recipe menus, keyboard interaction, and native-value synchronization
- `dist/selection-controls.js` — shared tab semantics, selection state, and arrow/Home/End navigation
- `dist/drafting-animation.js` — shared drafting and source-adding paper/shimmer animations
- `dist/dashboard.js` — grid/list project views, dates, content counts, and card actions
- `scripts/serve.mjs` — local static preview server
- `.openai/hosting.json` — private Sites deployment configuration

Run `npm run check` for JavaScript syntax checks. Static hosting serves the `dist` folder directly.

## Editor dependency

Quill 2.0.3 is bundled under `dist/vendor/` from the official npm package. The editor works without runtime CDN requests. Quill's BSD license and its bundled dependency notices are retained alongside the assets. The upstream editor documentation is at https://quilljs.com/docs/quickstart.


## Design-system source

Edit shared values in `dist/design-system/tokens.json` and custom styles in `styles/app.css`, `styles/guide.css`, or `styles/export.css`. Run `npm run design-system:build` after editing either source. The generated product stylesheet, reference stylesheet, token exports, and offline document styles stay synchronized.

Use CSS custom properties for component styles, `token(foundation.breakpoint.name)` for source CSS query thresholds, and `dist/design-system/runtime.js` for design values needed by JavaScript positioning or responsive behavior. `npm run check` catches stale generated output; tests reject fixed design dimensions, durations, typography, and colors in editable styles.
