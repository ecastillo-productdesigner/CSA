// Google Material Symbols only. Aliases keep action names independent of glyph names.
export const iconAliases = {
  "plus": "add_circle",
  "arrow": "arrow_forward",
  "close": "close",
  "sent": "send",
  "more": "more_horiz",
  "delete-project": "delete",
  "open": "open_in_new",
  "eye": "visibility",
  "undo": "undo",
  "redo": "redo",
  "upload": "upload",
  "file": "description",
  "document": "description",
  "link": "link",
  "search": "search",
  "trash": "delete",
  "variants": "article"
};

export function createIcon(name, className = '') {
  const icon = document.createElement('span');
  icon.className = `material-symbols-outlined${className ? ` ${className}` : ''}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconAliases[name] || name;
  return icon;
}
