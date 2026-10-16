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

- Project dashboard with three cards per row on wide screens, two at intermediate widths, and one on narrow screens. It includes a New Project tile and a sample Kelly Clarkson project with a Draft badge, Today, three sources, and Open/archive/delete controls. New material projects and drafts appear on the dashboard; existing prototype records remain available in Recents.
- Archive and Trash collections support restoring projects. Delete moves a project to Trash, and both archive and delete offer Undo. No permanent deletion is performed.
- Search entry opens a results page matching the supplied design, with four article cards initially, a total matching-story count, Newest/Oldest sorting, source/date filters, and Load more. The count updates with filters, including singular and zero-result states. URL entry starts a material workspace.
- Article selection and a Draft action that collects selected stories, or visible results when nothing is selected. Search drafts open the Tools and Outputs workspace with a centered document icon and “Content will appear here when you select an output” empty state. Sources, tool choices, and the empty workspace persist across reopening and refresh. Material projects continue to open in the rich text editor.
- The New Project tile and sidebar plus open the blank workspace from the latest reference, with Tools and Outputs panels on the right. The compact Format, Audience, and Voice controls start with their field name and show the chosen value after selection. The fields have 14px vertical gaps. Their custom dropdowns use rounded white panels, subtle borders/shadows, and a selected checkmark. Menus support arrow keys, Home/End, Enter/Space, Escape, and outside-click dismissal; saved tool choices restore when reopening a project. Create Variant and Editorial Direction start disabled and both enable when any Format, Audience, or Voice choice is selected. Clearing every choice disables both again. The same state restores with saved choices; a selection in an empty workspace starts a browser-local draft so editorial direction can be saved.
- Create Variant adds a dashed, rounded card under Outputs with a random sample headline and badges for exactly the selected options. Format is peach, Audience is pink, and Voice is blue. Each card keeps its creation-time labels and editorial direction; multiple cards persist with the project. Tools and Outputs headings share the same typography. Opening a card shows its own editable title and document; selecting it again returns to the original workspace. Variant edits are saved independently from the original material. The card’s top-right icon opens a Delete menu with keyboard/outside-click dismissal; deletion offers Undo and leaves other cards and original material intact.
- Main action buttons share Continue’s 48px height, including dashboard actions, Draft, Create Variant, editorial direction, and dialog actions. Dropdown sizing remains unchanged.
- The sliders icon beside Draft opens an optional Editorial Direction modal. Save direction keeps the text with the search project and carries it into the new draft; Cancel, Escape, and the close control discard unsaved changes. The workspace settings icon reopens the same direction. Source/date filters remain available through Filters above the results.
- Both plus controls open the chosen Quick Start modal, headed **Start your next story**, with search/URL entry, Continue, and a single **Start from your own material** action. It has no upload option, NEW PROJECT label, or introductory tagline. Closing the modal leaves the workspace visible.
- **Start from your own material** closes the overlay and opens a full rich text editor in the underlying workspace alongside Tools and Outputs. Drafts include an editable title; headings, fonts, sizes, bold, italic, underline, strikethrough, text color, highlighting, links, lists, alignment, indentation, and clear formatting; undo/redo; browser spellcheck; word/character counts and reading time; Find and Replace; source links and author/tags metadata; HTML/text downloads, copy, and print/Save as PDF.
- Rich text and title/metadata changes automatically save to the current browser. Leaving the editor flushes pending edits, saved projects reopen from the dashboard, and refresh restores the open draft in the current tab. Existing plain text drafts migrate into the editor when opened. Save failures are shown in the editor, and downloads provide a local copy.
- The profile menu provides Home and Search & materials navigation, preserving the search/upload/paste starter alongside the new blank workspace.
- File selection, drag and drop, and pasted text.
- Recent projects saved in the current browser and shown as a list that expands downward under Recents in the sidebar. Click Recents again or press Escape to collapse the list. Long titles are truncated with an ellipsis; selecting a title reopens that project.
- Four fictional celebrity sample stories appear in Recents alongside saved projects. Every title ends in `...`, including short titles. Opening a sample identifies its content as fictional.
- New project navigation and a profile popover.
- Hover over the collapsed sidebar to see a compact 20-pixel right-arrow cursor; click the rail to expand it with New Project and Recents labels. The CSA logo uses a pointer cursor and always returns to the homepage, from either sidebar state. Use the corner control or Escape to collapse the panel. The expanded navigation buttons perform their usual actions; keyboard activation of the collapsed buttons also remains available. On narrow screens the panel overlays the page and closes when you start a project.

In the project starter, the two material cards retain the earlier reference label: the left opens file selection, and the right opens text entry. The reference photo is represented by a local illustrated avatar.

## Prototype boundaries

There is no backend or AI integration yet. Search uses sample data and displays a matching-story count. Draft collects sample source excerpts. Create Variant makes a prototype output card with a random sample headline and an empty editable body; it does not generate article text. Editorial direction is saved for the prototype flow; it is not sent to an AI service. A search for Kelly Clarkson reproduces the reference's first four cards; other queries use topic-specific placeholder articles. URLs are not fetched. PDF, Word, and PowerPoint selections retain file metadata only; text and Markdown files retain their text. Original file bytes are not uploaded or persisted. Browser storage can be cleared by the browser and does not sync between devices.

The result portrait uses the user's supplied `Frame 109.png` as a local CSS image sprite. The original screenshot is retained unchanged in `dist/assets/search-reference.png`.

## Files

- `dist/index.html` — page structure and dialogs
- `dist/demo-access.js` — browser-only demo password screen and tab session
- `dist/styles.css` — layout, design tokens, and responsive styles
- `dist/app.js` — browser interactions and project storage
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
