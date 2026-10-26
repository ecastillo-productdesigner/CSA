// Purpose-led roles follow Material 3's applying-type guidance and Carbon's
// typography style strategies. Six text sizes serve the app and documentation.
export const typographyRoleGroups = [
  {
    id: 'page-hierarchy',
    title: 'Page hierarchy',
    description: 'Help people understand where they are and what matters first. Use a brief greeting for the homepage, a clear title for the draft, and smaller headings for panels and dialogs.',
    roles: [
      {
        name: 'Homepage greeting',
        usage: 'Welcome the user at the start of the homepage. Use Newsreader for the short greeting.',
        example: 'Hello,',
        styles: [
          { token: 'semantic.typography.greeting.desktop', label: 'Desktop' },
          { token: 'semantic.typography.greeting.mobile', label: 'Mobile' },
        ],
      },
      {
        name: 'Draft title',
        usage: 'Identify the article being edited. This is the strongest heading inside the editor; use the compact version when space is limited.',
        example: 'A Local Business Finds a Fresh Way to Connect',
        styles: [
          { token: 'semantic.typography.editor-heading.desktop', label: 'Desktop' },
          { token: 'semantic.typography.editor-heading.compact', label: 'Compact / mobile' },
        ],
      },
      {
        name: 'Panel heading',
        usage: 'Name a panel so its purpose is clear before the controls below it. New Draft and Content use a compact 16 px heading on every screen; other panels keep the 20 px role.',
        example: 'New Draft',
        styles: [
          {
            token: 'semantic.typography.panel-heading',
            label: 'New Draft / Content',
            overrides: { fontSize: 'foundation.font.size.16', lineHeight: 'foundation.line.height.24' },
            note: 'Composer panel component tokens set 16 px / 24 px while retaining Bold (700).',
          },
          { token: 'semantic.typography.panel-heading', label: 'Other panels' },
        ],
      },
      {
        name: 'Dialog heading',
        usage: 'State the task in a popup, such as creating a project or choosing where to send a draft. Keep the heading direct.',
        example: 'New Project',
        styles: [{ token: 'semantic.typography.dialog-heading', label: 'All screens' }],
      },
    ],
  },
  {
    id: 'content-reading',
    title: 'Content reading',
    description: 'Make stories easy to find, scan, and read. Titles identify a piece of content, article headings organize its sections, and body text carries the longer passages.',
    roles: [
      {
        name: 'Project card title',
        usage: 'Identify a project in the homepage grid. The semibold title comes before its date and content count.',
        example: 'A creative chapter begins',
        styles: [
          { token: 'semantic.typography.project-title.desktop', label: 'Desktop' },
          { token: 'semantic.typography.project-title.mobile', label: 'Mobile' },
        ],
      },
      {
        name: 'Project list title',
        usage: 'Identify a project in the homepage list with compact semibold text for easy scanning.',
        example: 'A creative chapter begins',
        styles: [{ token: 'semantic.typography.project-list-title', label: 'All screens' }],
      },
      {
        name: 'Source title',
        usage: 'Name an article in the Sources panel. Keep it distinct from the source details below it.',
        example: 'A Local Business Finds a Fresh Way to Connect',
        styles: [{ token: 'semantic.typography.source-title', label: 'All screens' }],
      },
      {
        name: 'Content card title',
        usage: 'Identify a draft in the Content panel, below its format, audience, and voice chips.',
        example: 'A fresh perspective on the week',
        styles: [{ token: 'semantic.typography.variant-title', label: 'All screens' }],
      },
      {
        name: 'Article card title',
        usage: 'Identify an article in a source result card. Use the bold title to lead into its short preview.',
        example: 'A creative project brings neighbors together',
        styles: [{ token: 'semantic.typography.result-title', label: 'All screens' }],
      },
      {
        name: 'Article heading',
        usage: 'Name the article at its highest heading level in the editor or exported document. Use one main heading before its sections.',
        example: 'A local idea brings the community together',
        styles: [{ token: 'semantic.typography.article-h1', label: 'Heading 1' }],
      },
      {
        name: 'Article section heading',
        usage: 'Divide a draft into its main sections. Use the editor’s Heading 2 style below the article title.',
        example: 'A new perspective',
        styles: [{ token: 'semantic.typography.article-h2', label: 'Heading 2' }],
      },
      {
        name: 'Article subsection heading',
        usage: 'Introduce a smaller section within a Heading 2 section. Keep this level visually quieter than the section heading.',
        example: 'The details that matter',
        styles: [{ token: 'semantic.typography.article-h3', label: 'Heading 3' }],
      },
      {
        name: 'Body text',
        usage: 'Use for the longer paragraphs in source previews and draft articles. Keep the regular weight and generous line spacing for sustained reading.',
        example: 'A local business is finding new ways to connect with its community. The people behind the effort describe the small decisions that helped it take shape.',
        styles: [{ token: 'semantic.typography.body', label: 'All screens' }],
      },
    ],
  },
  {
    id: 'interface-controls',
    title: 'Interface controls',
    description: 'Make actions and choices easy to recognize. Keep labels concise and use the same style for controls that do the same kind of work.',
    roles: [
      {
        name: 'Field label',
        usage: 'Explain what a form field or setting controls. Place the label close to its value.',
        example: 'Audience',
        styles: [{ token: 'semantic.typography.label', label: 'All screens' }],
      },
      {
        name: 'Dropdown value',
        usage: 'Show the selected value inside a dropdown. Use regular weight so the value answers the field label.',
        example: 'General Audience',
        styles: [{ token: 'semantic.typography.field-value', label: 'All screens' }],
      },
      {
        name: 'Text input value',
        usage: 'Use regular text for editable input and textarea values. Editorial Direction uses its compact component style: 14 px Regular with a 20 px line height.',
        example: 'Focus on the local economy',
        styles: [{ token: 'semantic.typography.input-value', label: 'All screens' }],
      },
      {
        name: 'Primary button label',
        usage: 'Name the main action, such as Add to List or Draft. Use a short verb or verb phrase.',
        example: 'Add to List',
        styles: [{ token: 'semantic.typography.button', label: 'All screens' }],
      },
      {
        name: 'Secondary and text action label',
        usage: 'Name a supporting action, such as Cancel, with less weight than the primary action.',
        example: 'Cancel',
        styles: [{ token: 'semantic.typography.secondary-button', label: 'All screens' }],
      },
      {
        name: 'Navigation label',
        usage: 'Name a destination in the workspace navigation. Use the same wording wherever that destination appears.',
        example: 'Sources',
        styles: [{ token: 'semantic.typography.navigation', label: 'All screens' }],
      },
      {
        name: 'Settings chip',
        usage: 'Summarize a draft setting in a compact chip, such as its format, audience, or voice.',
        example: 'General Audience',
        styles: [{ token: 'semantic.typography.chip', label: 'All screens' }],
      },
    ],
  },
  {
    id: 'supporting-information',
    title: 'Supporting information',
    description: 'Add context without competing with the story or the main action. Keep dates, counts, status, and helper text separate from titles.',
    roles: [
      {
        name: 'Project metadata',
        usage: 'Show the project’s update date and number of pieces of content below its homepage card title.',
        example: 'Updated Today · 2 Pieces of Content',
        styles: [
          { token: 'semantic.typography.project-meta.desktop', label: 'Desktop' },
          { token: 'semantic.typography.project-meta.mobile', label: 'Mobile' },
        ],
      },
      {
        name: 'Status badge',
        usage: 'Show a short state, such as Draft or Sent, alongside the content it describes. Match the settings-chip typography.',
        example: 'Draft',
        styles: [{ token: 'semantic.typography.status', label: 'All screens' }],
      },
      {
        name: 'Helper text',
        usage: 'Give a brief explanation that supports the current task, such as the sign-in guidance.',
        example: 'Use the demo password to continue.',
        styles: [{ token: 'semantic.typography.caption', label: 'All screens' }],
      },
      {
        name: 'Document metadata',
        usage: 'Show small details in the editor footer, such as the draft’s word count. Keep essential instructions in the larger body or label styles.',
        example: '235 words',
        styles: [{ token: 'semantic.typography.metadata', label: 'All screens' }],
      },
    ],
  },
];
