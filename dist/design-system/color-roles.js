/**
 * Visible color-role inventory for the design-system guide.
 * Values resolve from tokens.json; one swatch represents each distinct color.
 * `opacity` is the source alpha (0–1), not an opacity to apply to the swatch again.
 */
export const colorRoleGroups = [
  {
    id: 'canvas-surfaces',
    title: 'Canvas & surfaces',
    description: 'Use roughly 60% cream canvas, 30% white panels and content surfaces, and 10% teal actions, selection, and focus accents.',
    colors: [
      { name: 'Page canvas', token: 'semantic.color.background.canvas', description: 'The page canvas, editor footer, and source-card Publish Date/URL footer use Amber 50 (#FFFBEB) at 50% over white, flattened to opaque #FFFDF5. The source-card footer has a thin top divider. The swatch shows the resolved opaque color.' },
      { name: 'White surface', token: 'semantic.color.surface.default', description: 'Structural navigation/sidebar, New Draft, Content, editor, and source panels, selected joined editor tabs, inner card bodies, fields, menus, dialogs, and inverse labels share white. Source-card metadata footers use the cream canvas surface.' },
      { name: 'Quiet / hover surface', token: 'semantic.color.surface.hover', description: 'Neutral 100 supports quiet sections and neutral icon or source-title hover surfaces.' },
      { name: 'Soft selected surface', token: 'semantic.color.surface.selected', description: 'Teal 50 (#F0FDFA) is the subtle tint for selected navigation and supporting selection controls. Teal 700 labels and icons provide 5.14:1 contrast.' },
    ],
  },
  {
    id: 'text-borders',
    title: 'Text & borders',
    description: 'Readable text, essential icons, selected states, and decorative boundaries have distinct roles.',
    colors: [
      { name: 'Body text', token: 'semantic.color.text.primary', description: 'Neutral 700 (#404040) is default body and blockquote text. The canvas-secondary role aliases this same color for supporting text directly on the resolved canvas, providing 10.18:1 contrast.' },
      { name: 'Heading text', token: 'semantic.color.text.heading', description: 'Neutral 950 (#060606) keeps strong headings readable without competing with teal interaction accents. Contrast is 19.90:1 on the resolved #FFFDF5 canvas.' },
      { name: 'Secondary text / essential icons', token: 'semantic.color.text.secondary', description: 'Neutral 500 (#737373) is for supporting labels, project dates and counts, placeholders, and enabled project-menu ellipsis icons on white; also text-field and unchecked-checkbox outlines. Contrast is 4.74:1 on white. Its 4.66:1 on the resolved canvas meets normal-text and essential-icon minimums; canvas supporting text retains canvas-secondary (#404040) for stronger contrast.' },
      { name: 'Muted / inactive text', token: 'semantic.color.text.muted', description: 'Neutral 400 is limited to inactive controls and decorative content. Readable labels and placeholders use Secondary text on white or canvas-secondary on the resolved #FFFDF5 canvas; enabled icons use an appropriate readable role.' },
      { name: 'Border / Draft / disabled fill', token: 'semantic.color.border.default', description: 'Neutral 200 is for decorative card, panel, and divider borders, dropdown outlines identified by dark labels and chevrons, Draft badges, disabled primary fills, and tertiary hover or pressed fills. Disabled labels use Secondary text.' },
    ],
  },
  {
    id: 'actions-feedback',
    title: 'Actions & feedback',
    description: 'Deep teal identifies primary actions, links, selected controls, and keyboard focus. Functional chip, status, and destructive colors remain distinct.',
    colors: [
      { name: 'Primary action / selection / focus', token: 'semantic.color.action.primary', description: 'Teal 700 (#00786F) is the primary button fill, links and plus icons, selected labels and indicators, selected borders and checkbox fills, and keyboard-focus outlines. White labels provide 5.36:1 contrast; teal text is 5.27:1 on the cream canvas.' },
      { name: 'Primary hover / press', token: 'semantic.color.action.primary-hover', description: 'Teal 800 (#005F5A) is the hover or pressed primary fill and outlined or text-action label. White labels provide 7.54:1 contrast, and teal text is 7.41:1 on the cream canvas.' },
      { name: 'Revision notification', token: 'semantic.color.status.revision-unread', description: 'Blue 500 (#3B82F6) marks a completed revision that has not been acknowledged. The 8 px dot appears before the draft title and stays until its tab is opened, or clears after 10 seconds while its draft stays selected.' },
      { name: 'Sent status', token: 'foundation.color.green.200', description: 'Green identifies Sent badges with a readable label and icon.' },
      { name: 'Destructive action', token: 'semantic.color.danger.default', description: 'Red 700 identifies Delete labels and icons, and destructive confirmation fills.' },
      { name: 'Destructive hover / press', token: 'semantic.color.danger.hover', description: 'Red 800 is the destructive confirmation fill on hover or press.' },
    ],
  },
  {
    id: 'content-labels',
    title: 'Content labels & emphasis',
    description: 'Rose 200, Indigo 100, and Orange 200 identify Format, Audience, and Voice; editor highlight keeps its separate Orange 100 background.',
    colors: [
      { name: 'Format — Rose 200', token: 'component.chip.format.background', description: 'Rose 200 background for the selected content format and its matching pink drafting shimmer.' },
      { name: 'Audience — Indigo 100', token: 'component.chip.audience.background', description: 'Indigo 100 background for the selected audience and its matching lavender drafting shimmer.' },
      { name: 'Voice — Orange 200', token: 'component.chip.voice.background', description: 'Orange 200 background for the selected publication voice and its matching peach drafting shimmer.' },
      { name: 'Editor highlight — Orange 100', token: 'foundation.color.orange.100', description: 'Orange 100 remains the editor text-highlight background, separate from the stronger Voice chip color.' },
    ],
  },
  {
    id: 'overlays-shadows',
    title: 'Overlays & shadows',
    description: 'Translucent colors are shown over a transparency grid; their alpha is part of the token.',
    colors: [
      { name: 'Loading overlay', token: 'semantic.color.overlay.loading', description: 'White at 90% opacity over content while adding or adapting.', opacity: 0.9 },
      { name: 'Canvas fade', token: 'semantic.color.overlay.canvas-fade', description: 'The resolved #FFFDF5 canvas color at 90.2% opacity within page and navigation fades (#FFFDF5E6).', opacity: 230 / 255 },
      { name: 'Modal backdrop', token: 'semantic.color.overlay.scrim', description: '#253550 at 16% opacity behind dialogs and mobile workspace panels.', opacity: 0.16 },
      { name: 'Dropdown shadow — desktop', token: 'foundation.color.shadow.dropdown', description: '#404040 at 8% opacity for dropdown and popover elevation.', opacity: 0.08 },
      { name: 'Dropdown shadow — mobile', token: 'foundation.color.shadow.dropdown-mobile', description: '#404040 at 16% opacity for dropdown and popover elevation on small screens.', opacity: 0.16 },
    ],
  },
];
