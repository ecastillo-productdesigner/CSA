# Project design preferences

- For Material Symbols in selection controls, use outlined icons (`FILL` set to `0`) when unselected and filled icons (`FILL` set to `1`) when selected. This includes view switches, favorites, source folders, and formatting toggles. Actions without a selected state use filled icons. Keep the DS icon gallery and state guidance aligned with the app.
- Custom interface design values must use tokens, including dimensions, colors, typography, motion, and breakpoints. Edit CSS in `styles/`; `dist/styles.css`, `dist/design-system/guide.css`, and document export styles are generated. Use `token(foundation.breakpoint.name)` in source query conditions and the shared runtime helper in JavaScript.
- Shared design values live in `dist/design-system/tokens.json`. Prefer semantic and component tokens for new interface work. After changing tokens, run `npm run design-system:build`; do not edit generated token exports directly.
- Keep `npm run design-system:check` passing and review desktop and mobile when changing shared styles. The visual reference and handoff notes live in `dist/design-system/`.
- Toast messages must not end with a period. Apply the same copy style in the app and design system.

- For user-facing copy and user communication, follow the CSA 2.0 UX Writing Style Guide in `dist/design-system/UX-WRITING.txt` and the design system’s Content & Microcopy section. Preserve explicit approved examples such as Add to List and SEO Title; the guide’s general capitalization wording is flagged there for clarification. Engineering identifiers may differ.
