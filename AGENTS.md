# Project design preferences

- Use the filled style for Material Symbols icons (`FILL` set to `1`) throughout this project, including newly added icons. Explicit exceptions use outlined (`FILL` set to `0`) symbols for the unselected homepage grid icon and unsaved/inactive favorite hearts, and unselected source folders. Saved/active hearts and selected source folders are filled.
- Custom interface design values must use tokens, including dimensions, colors, typography, motion, and breakpoints. Edit CSS in `styles/`; `dist/styles.css`, `dist/design-system/guide.css`, and document export styles are generated. Use `token(foundation.breakpoint.name)` in source query conditions and the shared runtime helper in JavaScript.
- Shared design values live in `dist/design-system/tokens.json`. Prefer semantic and component tokens for new interface work. After changing tokens, run `npm run design-system:build`; do not edit generated token exports directly.
- Keep `npm run design-system:check` passing and review desktop and mobile when changing shared styles. The visual reference and handoff notes live in `dist/design-system/`.
