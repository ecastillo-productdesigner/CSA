// Keep compact setting chips consistent across cards, the editor, and comparisons.
export function truncateChipLabel(label, maxLength = 20) {
  const characters = Array.from(label);
  return maxLength && characters.length > maxLength
    ? `${characters.slice(0, maxLength - 1).join('').trimEnd()}…`
    : label;
}

/** Keep labels compact and expose the full name through the native tooltip. */
export function setCompactChipLabel(element, label, { maxLength = 20, ariaLabel = label } = {}) {
  element.textContent = truncateChipLabel(label, maxLength);
  element.setAttribute('title', label);
  element.setAttribute('aria-label', ariaLabel);
  return element;
}
