import { typographyRoleGroups } from './typography-roles.js?v=20261103-type-reference';

const textProperties = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing'];
const propertySuffix = property => property.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
const weightName = weight => ({ 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold' }[weight] || 'Variable');
const number = value => Number.parseFloat(typeof value === 'object' ? value.value : value);
const rounded = value => +value.toFixed(2);
const unit = value => typeof value === 'object' ? `${value.value}${value.unit}` : String(value);

function resolveStyle(style, byName) {
  const token = byName.get(style.token);
  if (token?.type !== 'typography') throw new Error(`Unknown typography token: ${style.token}`);
  const properties = { ...token.properties };
  const css = Object.fromEntries(textProperties.map(property => [property, `var(${token.cssVariable}-${propertySuffix(property)})`]));
  for (const [property, name] of Object.entries(style.overrides || {})) {
    const override = byName.get(name);
    if (!override) throw new Error(`Unknown typography override: ${name}`);
    css[property] = `var(${override.cssVariable})`;
    properties[property] = override.value;
  }
  const size = number(properties.fontSize);
  const lineHeight = style.overrides?.lineHeight ? number(properties.lineHeight) : rounded(size * properties.lineHeight);
  const family = Array.isArray(properties.fontFamily) ? properties.fontFamily[0] : String(properties.fontFamily).split(',')[0].replaceAll('"', '');
  const details = { family, weight: number(properties.fontWeight), size, lineHeight, tracking: unit(properties.letterSpacing) };
  return { ...style, details, css, signature: JSON.stringify(details) };
}

// Equivalent aliases share one specimen, while distinct responsive values stay together.
export function buildTypographyReference(tokens) {
  const byName = new Map(tokens.map(token => [token.name, token]));
  const groups = typographyRoleGroups.map(group => ({ ...group, roles: group.roles.map(role => {
    const unique = new Map();
    for (const style of role.styles.map(style => resolveStyle(style, byName))) {
      if (!unique.has(style.signature)) unique.set(style.signature, { ...style, labels: [], references: [], notes: [] });
      const specimen = unique.get(style.signature);
      if (!specimen.labels.includes(style.label)) specimen.labels.push(style.label);
      specimen.references.push({ token: style.token, label: style.label, overrides: style.overrides || {} });
      if (style.note && !specimen.notes.includes(style.note)) specimen.notes.push(style.note);
    }
    return { ...role, specimens: [...unique.values()] };
  }) }));
  const families = [
    { name: 'Inter', token: 'foundation.font.family.interface', description: 'The primary typeface for navigation, controls, titles, and reading text.', sample: 'A story worth sharing', role: 'semantic.typography.editor-heading.desktop' },
    { name: 'Newsreader', token: 'foundation.font.family.editorial', description: 'An editorial voice for the homepage greeting and the optional serif article format.', sample: 'Hello,', role: 'semantic.typography.greeting.desktop', serifArticleRoles: ['body', 'article-h1', 'article-h2', 'article-h3'] },
  ].map(family => ({ ...family, css: resolveStyle({ token: family.role }, byName).css, weights: [...new Set([...groups.flatMap(group => group.roles.flatMap(role => role.specimens)).filter(style => style.details.family === family.name).map(style => style.details.weight), ...(family.serifArticleRoles || []).map(role => resolveStyle({ token: `semantic.typography.${role}` }, byName).details.weight)])].sort((a, b) => a - b) }));
  const scaleRoles = [
    [12, 'metadata', 'Helper text, metadata, chips, and status'],
    [14, 'field-value', 'Compact values, labels, and navigation'],
    [16, 'input-value', 'Reading text, inputs, cards, and actions'],
    [20, 'article-h3', 'Panel and subsection headings'],
    [24, 'dialog-heading', 'Dialogs, sections, and compact titles'],
    [30, 'article-h1', 'Main titles and desktop greeting'],
  ];
  const scale = scaleRoles.map(([size, role, usage]) => {
    const style = resolveStyle({ token: `semantic.typography.${role}` }, byName);
    return { size, usage, css: { ...style.css, fontWeight: `var(${byName.get('foundation.font.weight.400').cssVariable})`, letterSpacing: `var(${byName.get('semantic.typography.body').cssVariable}-letter-spacing)` } };
  });
  return { groups, families, scale, byName };
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function applyType(node, css) {
  for (const [property, value] of Object.entries(css)) node.style[property] = value;
}
function specs(properties) {
  const labels = { family: 'Typeface', weight: 'Weight', size: 'Size', lineHeight: 'Line height', tracking: 'Tracking' };
  const list = element('dl', 'ds-type-properties');
  for (const [key, value] of Object.entries(properties)) {
    let label = value;
    if (key === 'weight') label = `${weightName(value)} (${value})`;
    if (key === 'size' || key === 'lineHeight') label = `${value} px`;
    const pair = element('div');
    pair.append(element('dt', '', labels[key]), element('dd', '', label));
    list.append(pair);
  }
  return list;
}
function tokenDetails(specimen) {
  const details = element('details', 'ds-type-details');
  details.append(element('summary', '', 'Tokens and usage'));
  for (const reference of specimen.references) {
    details.append(element('p', '', reference.label), element('code', '', reference.token));
    for (const [property, name] of Object.entries(reference.overrides)) details.append(element('p', '', `${propertySuffix(property)}: ${name}`));
  }
  for (const note of specimen.notes) details.append(element('p', '', note));
  return details;
}

export function mountTypographyReference(tokens) {
  const model = buildTypographyReference(tokens);
  const families = document.querySelector('#ds-type-families');
  const scale = document.querySelector('#ds-type-scale');
  const specimens = document.querySelector('#ds-type-specimens');
  if (!families || !scale || !specimens) return;
  families.replaceChildren(...model.families.map(family => {
    const card = element('article', 'ds-type-family');
    const sample = element('p', 'ds-type-family-sample', family.sample);
    applyType(sample, family.css);
    const weights = element('div', 'ds-type-weights');
    for (const weight of family.weights) {
      const item = element('span', '', `${weightName(weight)} ${weight}`);
      item.style.fontFamily = `var(${model.byName.get(family.token).cssVariable})`;
      item.style.fontWeight = `var(${model.byName.get(`foundation.font.weight.${weight}`).cssVariable})`;
      weights.append(item);
    }
    card.append(element('h4', '', family.name), sample, element('p', '', family.description), weights, element('code', '', family.token));
    return card;
  }));
  scale.replaceChildren(...model.scale.map(style => {
    const row = element('div', 'ds-type-scale-row');
    const sample = element('p', 'ds-type-scale-sample', 'A story worth sharing');
    applyType(sample, style.css);
    row.append(element('span', 'ds-type-scale-size', `${style.size} px`), sample, element('p', 'ds-type-scale-use', style.usage));
    return row;
  }));
  specimens.replaceChildren(...model.groups.map(group => {
    const section = element('section', 'ds-type-group');
    section.id = `type-${group.id}`;
    const heading = element('h3', 'ds-foundation-group-title', group.title);
    heading.id = `${section.id}-title`;
    section.setAttribute('aria-labelledby', heading.id);
    section.append(heading, element('p', 'ds-foundation-group-description', group.description));
    for (const role of group.roles) {
      const row = element('article', 'ds-type-role');
      const purpose = element('div', 'ds-type-purpose');
      const shared = Object.fromEntries(Object.entries(role.specimens[0].details).filter(([key, value]) => role.specimens.every(style => style.details[key] === value)));
      purpose.append(element('h4', '', role.name), element('p', '', `Use for: ${role.usage}`), specs(shared));
      const examples = element('div', 'ds-type-examples');
      for (const specimen of role.specimens) {
        const item = element('div', 'ds-type-example');
        item.dataset.typographyToken = specimen.token;
        const sample = element('p', 'ds-type-sample', specimen.example || role.example);
        applyType(sample, specimen.css);
        item.append(element('p', 'ds-type-variant-label', specimen.labels.join(' / ')), sample);
        const differences = Object.fromEntries(Object.entries(specimen.details).filter(([key]) => !(key in shared)));
        if (Object.keys(differences).length) item.append(specs(differences));
        item.append(tokenDetails(specimen));
        examples.append(item);
      }
      row.append(purpose, examples);
      section.append(row);
    }
    return section;
  }));
}
