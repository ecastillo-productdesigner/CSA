# CSA

A responsive implementation of the supplied CSA homepage. Plain HTML, CSS, and JavaScript, with no dependencies or build step.

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

- Project dashboard matching the updated homepage reference, including a New Project tile and a sample Kelly Clarkson project with a Draft badge, Today, three sources, and Open/archive/delete controls. New material projects and drafts appear on the dashboard; existing prototype records remain available in Recents.
- Archive and Trash collections support restoring projects. Delete moves a project to Trash, and both archive and delete offer Undo. No permanent deletion is performed.
- Search entry opens a results page matching the supplied design, with four article cards, Newest/Oldest sorting, source/date filters, and Load more. URL entry starts a material workspace.
- Article selection and a Draft action that creates an editable starter from selected stories, or from the visible results when nothing is selected. Draft edits and article selections persist in the current browser.
- The New Project tile and sidebar plus open the blank workspace from the latest reference, with Tools and Outputs panels on the right. Content Formats, Target Audiences, and Publication Voice each start at None Selected. Create Variant and its settings button remain disabled while no content is selected.
- Both plus controls also open the reference-matched project modal over that workspace, with search/URL entry and a single Start from your own material action. Closing the modal leaves the blank workspace visible. Material selection provides file and paste tabs; Cancel returns to the project modal.
- The profile menu provides Home and Search & materials navigation, preserving the search/upload/paste starter alongside the new blank workspace.
- File selection, drag and drop, and pasted text.
- Recent projects saved in the current browser and shown as a list that expands downward under Recents in the sidebar. Click Recents again or press Escape to collapse the list. Long titles are truncated with an ellipsis; selecting a title reopens that project.
- Four fictional celebrity sample stories appear in Recents alongside saved projects. Every title ends in `...`, including short titles. Opening a sample identifies its content as fictional.
- New project navigation and a profile popover.
- Click the CSA logo to expand the sidebar with New Project and Recents labels; use the corner control, the logo, or Escape to collapse it. On narrow screens the panel overlays the page and closes when you start a project.

In the project starter, the two material cards retain the earlier reference label: the left opens file selection, and the right opens text entry. The reference photo is represented by a local illustrated avatar.

## Prototype boundaries

There is no backend or AI integration yet. Search results are explicitly labeled sample data, and drafts assemble sample excerpts without generating new text. A search for Kelly Clarkson reproduces the reference's first four cards; other queries use topic-specific placeholder articles. URLs are not fetched. PDF, Word, and PowerPoint selections retain file metadata only; text and Markdown files retain their text. Original file bytes are not uploaded or persisted. Browser storage can be cleared by the browser and does not sync between devices.

The result portrait uses the user's supplied `Frame 109.png` as a local CSS image sprite. The original screenshot is retained unchanged in `dist/assets/search-reference.png`.

## Files

- `dist/index.html` — page structure and dialogs
- `dist/demo-access.js` — browser-only demo password screen and tab session
- `dist/styles.css` — layout, design tokens, and responsive styles
- `dist/app.js` — browser interactions and project storage
- `dist/search.js` — sample search results, selection, sorting, filters, and draft handoff
- `dist/dashboard.js` — project tiles, badges, archive/Trash collections, and card actions
- `scripts/serve.mjs` — local static preview server
- `.openai/hosting.json` — private Sites deployment configuration

Run `npm run check` for JavaScript syntax checks. Static hosting serves the `dist` folder directly.
