// Shared app typography, grouped for scanning without changing the token values.
const type = (name, label = 'All screens', extras = {}) => ({ token: `semantic.typography.${name}`, label, ...extras });

export const typographyRoleGroups = [
  {
    id: 'display', title: 'Display',
    description: 'A short editorial welcome sets the tone before the work begins.',
    roles: [
      { name: 'Homepage greeting', usage: 'The short welcome on the homepage.', example: 'Hello,', styles: [type('greeting.desktop', 'Desktop'), type('greeting.mobile', 'Mobile')] },
    ],
  },
  {
    id: 'headings', title: 'Headings',
    description: 'Give pages, panels, and articles a clear hierarchy. Choose the role that matches the content.',
    roles: [
      { name: 'Draft title', usage: 'The title of the article being edited.', example: 'A Local Business Finds a Fresh Way to Connect', styles: [type('editor-heading.desktop', 'Desktop'), type('editor-heading.compact', 'Compact / mobile')] },
      { name: 'Article heading', usage: 'The main heading inside an article or exported document.', example: 'A Local Business Finds a Fresh Way to Connect', styles: [type('article-h1', 'Heading 1')] },
      { name: 'Dialog and section headings', usage: 'Dialog titles and Heading 2 sections in an article.', example: 'A new perspective', styles: [type('dialog-heading', 'Dialog heading'), type('article-h2', 'Article Heading 2')] },
      { name: 'Panel and subsection headings', usage: 'Panel titles, compact New Draft and Content headings, and article subsections.', example: 'A new perspective', styles: [
        type('panel-heading', 'General panels', { example: 'Project Sources' }),
        type('panel-heading', 'New Draft / Content', { example: 'New Draft', overrides: { fontSize: 'component.composer-panel.heading-font-size', lineHeight: 'component.composer-panel.heading-line-height' }, note: 'The composer component uses a compact heading on every screen.' }),
        type('article-h3', 'Article Heading 3'),
      ] },
      { name: 'Project card title', usage: 'Project names on homepage grid cards.', example: 'A creative chapter begins', styles: [type('project-title.desktop', 'Desktop'), type('project-title.mobile', 'Mobile')] },
      { name: 'Project list title', usage: 'Project names in the compact homepage list.', example: 'A creative chapter begins', styles: [type('project-list-title')] },
      { name: 'Article card title', usage: 'Article titles in search results.', example: 'A creative chapter begins', styles: [type('result-title')] },
    ],
  },
  {
    id: 'body', title: 'Body',
    description: 'Use comfortable reading text for stories and compact text for shorter values and summaries.',
    roles: [
      { name: 'Reading text', usage: 'Paragraphs in source previews and draft articles.', example: 'A local business is finding new ways to connect with its community. The people behind the effort describe the small decisions that helped it take shape.', styles: [type('body')] },
      { name: 'Compact content and values', usage: 'Source titles, Content card titles, and selected dropdown values.', example: 'A fresh perspective on the week', styles: [type('source-title', 'Source title'), type('variant-title', 'Content card title'), type('field-value', 'Dropdown value')] },
      { name: 'Input text', usage: 'Editable text fields and the compact Editorial Direction field.', example: 'Focus on the local economy', styles: [
        type('input-value', 'Text inputs'),
        type('input-value', 'Editorial Direction', { overrides: { fontSize: 'foundation.font.size.14', lineHeight: 'foundation.line.height.20' }, note: 'Editorial Direction uses the existing compact field size and line height.' }),
      ] },
    ],
  },
  {
    id: 'labels', title: 'Labels',
    description: 'Keep actions and choices concise. Use a consistent style for controls with the same purpose.',
    roles: [
      { name: 'Fields and navigation', usage: 'Field labels and workspace navigation destinations.', example: 'Project Sources', styles: [
        type('label', 'Field labels', { example: 'Audience' }),
        type('navigation', 'Desktop navigation'),
        type('navigation', 'Mobile navigation', { overrides: { fontWeight: 'foundation.font.weight.600' }, note: 'Mobile navigation uses the existing Semibold weight.' }),
      ] },
      { name: 'Primary action', usage: 'The main action, including Add to List and Draft.', example: 'Add to List', styles: [type('button')] },
      { name: 'Supporting action', usage: 'Secondary buttons and text actions.', example: 'Cancel', styles: [type('secondary-button')] },
      { name: 'Chips and status', usage: 'Format, Audience, and Voice chips, plus Draft and Sent badges.', example: 'General Audience', styles: [type('chip', 'Settings chip'), type('status', 'Status badge')] },
    ],
  },
  {
    id: 'supporting-information', title: 'Supporting Information',
    description: 'Dates, counts, and guidance add context without competing with the main content.',
    roles: [
      { name: 'Project metadata', usage: 'Updated dates and content counts on project cards.', example: 'Updated Today · 2 Pieces of Content', styles: [type('project-meta.desktop', 'Desktop'), type('project-meta.mobile', 'Mobile')] },
      { name: 'Helper text and metadata', usage: 'Brief guidance, document details, and word counts.', example: '235 words', styles: [type('caption', 'Helper text'), type('metadata', 'Document metadata')] },
    ],
  },
];
