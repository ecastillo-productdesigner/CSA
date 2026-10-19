# Project design preferences

- Use the filled style for Material Symbols icons (`FILL` set to `1`) throughout this project, including newly added icons.
- Shared design values live in `dist/design-system/tokens.json`. Prefer semantic and component tokens for new interface work. After changing tokens, run `npm run design-system:build`; do not edit generated token exports directly.
- Keep `npm run design-system:check` passing and review desktop and mobile when changing shared styles. The visual reference and handoff notes live in `dist/design-system/`.
