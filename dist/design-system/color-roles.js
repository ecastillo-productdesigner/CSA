/**
 * Visible color-role inventory for the design-system guide.
 * Values resolve from tokens.json; one swatch represents each distinct color.
 * `opacity` is the source alpha (0–1), not an opacity to apply to the swatch again.
 */
export const colorRoleGroups = [
  {
    id: 'canvas-surfaces',
    title: 'Canvas & surfaces',
    description: 'The page canvas, its source tint, and shared interface surfaces.',
    colors: [
      { name: 'Page canvas — Orange 50 at 50%', token: 'semantic.color.background.canvas', description: 'Orange 50 (#FFF7ED) at 50% over white, flattened to opaque #FFFBF6 so overlapping surfaces do not compound the tint.' },
      { name: 'Orange 50 base', token: 'foundation.color.orange.50', description: 'The full-strength source tint for the canvas recipe; this is a reference color, not the page background.' },
      { name: 'White surface', token: 'semantic.color.surface.default', description: 'Cards, panels, dialogs, fields, and inverse labels share white.' },
      { name: 'Quiet / hover surface', token: 'semantic.color.surface.hover', description: 'Subtle surfaces, navigation selection, icon hover, and destination-option hover use the same light gray.' },
    ],
  },
  {
    id: 'text-borders',
    title: 'Text & borders',
    description: 'Neutral roles distinguish readable content, supporting text, inactive labels, and separators.',
    colors: [
      { name: 'Primary text', token: 'semantic.color.text.primary', description: 'Default body text, headings, and interface icons.' },
      { name: 'Secondary text', token: 'semantic.color.text.secondary', description: 'Supporting information such as dashboard dates and content counts.' },
      { name: 'Muted / inactive text', token: 'semantic.color.text.muted', description: 'Placeholders, quiet labels, and disabled-action labels.' },
      { name: 'Border / Draft', token: 'semantic.color.border.default', description: 'Shared control borders and separators; also the Draft status background.' },
    ],
  },
  {
    id: 'actions-feedback',
    title: 'Actions & feedback',
    description: 'Action, selection, disabled, sent, and destructive colors include their distinct states.',
    colors: [
      { name: 'Feedback tint reference', token: 'component.toast.icon-background', description: 'Pale-blue token for toast icon backgrounds and action hover; retained as a feedback reference.' },
      { name: 'Disabled action', token: 'component.button.primary.disabled-background', description: 'Disabled primary fill and disabled secondary or tertiary labels and borders.' },
      { name: 'Selection / focus', token: 'semantic.color.border.selected', description: 'Selected content-card borders and the shared keyboard-focus ring.' },
      { name: 'Primary action', token: 'semantic.color.action.primary', description: 'Filled primary actions and primary-blue labels, borders, and links.' },
      { name: 'Primary hover / press', token: 'semantic.color.action.primary-hover', description: 'Primary hover or pressed fill, secondary and tertiary hover labels and borders, and project-list hover.' },
      { name: 'Sent status', token: 'foundation.color.green.200', description: 'Sent badges on projects and editor tabs.' },
      { name: 'Destructive action', token: 'semantic.color.danger.default', description: 'Delete labels and icons, and destructive confirmation fill.' },
      { name: 'Destructive hover / press', token: 'semantic.color.danger.hover', description: 'Destructive confirmation fill on hover or press.' },
    ],
  },
  {
    id: 'content-labels',
    title: 'Content labels',
    description: 'Format, Audience, and Voice retain their distinct chip backgrounds.',
    colors: [
      { name: 'Format', token: 'component.chip.format.background', description: 'Rose background for the selected content format.' },
      { name: 'Audience', token: 'component.chip.audience.background', description: 'Indigo background for the selected audience.' },
      { name: 'Voice', token: 'component.chip.voice.background', description: 'Orange 100 background for the selected publication voice.' },
    ],
  },
  {
    id: 'overlays-shadows',
    title: 'Overlays & shadows',
    description: 'Translucent colors are shown over a transparency grid; their alpha is part of the token.',
    colors: [
      { name: 'Loading overlay', token: 'semantic.color.overlay.loading', description: 'White at 90% opacity over content while adding or adapting.', opacity: 0.9 },
      { name: 'Canvas fade', token: 'semantic.color.overlay.canvas-fade', description: 'The #FFFBF6 canvas color at 90.2% opacity within page and navigation fades.', opacity: 230 / 255 },
      { name: 'Modal backdrop', token: 'semantic.color.overlay.scrim', description: '#253550 at 16% opacity behind dialogs and mobile workspace panels.', opacity: 0.16 },
      { name: 'Dropdown shadow — desktop', token: 'foundation.color.shadow.dropdown', description: '#404040 at 8% opacity for dropdown and popover elevation.', opacity: 0.08 },
      { name: 'Dropdown shadow — mobile', token: 'foundation.color.shadow.dropdown-mobile', description: '#404040 at 16% opacity for dropdown and popover elevation on small screens.', opacity: 0.16 },
    ],
  },
  {
    id: 'legacy-editor-default',
    title: 'Legacy editor default',
    description: 'A browser color-input default is tracked separately from visible article text.',
    colors: [
      { name: 'Editor color-input default', token: 'component.editor.color-input-default', description: 'Legacy #26344A initializes the hidden browser color picker; it does not set the visible article text color.' },
    ],
  },
];
