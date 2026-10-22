// Google Material Symbols only. Aliases keep action names independent of glyph names.
export const iconAliases = {
  "plus": "add_circle",
  "arrow": "arrow_forward",
  "close": "close",
  "sent": "send",
  "more": "more_horiz",
  "delete-project": "delete",
  "open": "open_in_new",
  "thumb-up": "thumb_up",
  "eye": "visibility",
  "undo": "undo",
  "redo": "redo",
  "upload": "upload",
  "history": "history",
  "file": "description",
  "document": "description",
  "link": "link",
  "search": "search",
  "filters": "tune",
  "edit-output": "edit",
  "archive": "archive",
  "trash": "delete",
  "restore": "restore_from_trash",
  "tools": "build",
  "variants": "article",
  "outputs": "auto_awesome"
};

export function createIcon(name, className = '') {
  const icon = document.createElement('span');
  icon.className = `material-symbols-outlined${className ? ` ${className}` : ''}`;
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = iconAliases[name] || name;
  return icon;
}
