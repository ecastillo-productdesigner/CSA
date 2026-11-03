import { parseSourceLinks } from './source-links.js?v=20261026-drafting-card-size';

function looksLikeLink(input) {
  // A topic can contain a colon; only URL syntax and recognized schemes make
  // it a malformed link. This keeps phrases such as “Fashion: spring trends”.
  if (/\b[a-z][a-z\d+.-]*\s*:\s*\/\//i.test(input)
      || /\b(?:https?|ftps?|sftp|mailto|javascript|data|file|tel|sms|about|urn|blob)\s*:/i.test(input)
      || /\b(?:https?|ftps?)\/{1,2}/i.test(input)
      || /\bwww\s*\./i.test(input)) return true;

  return input.split(/[\s,;]+/).some(part => {
    const candidate = part.replace(/^[([{<"'.]+/, '').replace(/[)\]}>"',;!?.]+$/, '');
    // Initials and common abbreviations are ordinary search text, not domains.
    if (/^(?:[a-z]\.)+[a-z]$/i.test(candidate) || /^(?:ph\.d|ed\.d|d\.phil|[bm]\.sc)$/i.test(candidate)) return false;
    return /^(?:[^@\s]+@)?(?:[a-z\d_-]+\.+)+[a-z]+(?::[^/?#]*)?(?:[/?#].*)?$/i.test(candidate)
      || /^\d{1,3}(?:\.\d{1,3}){3}(?::\d*)?(?:[/?#].*)?$/.test(candidate);
  });
}

export function classifyProjectSearchInput(input) {
  if (typeof input !== 'string') return { kind: 'invalid' };
  const trimmed = input.trim();
  if (!trimmed) return { kind: 'empty' };

  // Use the existing parser unchanged, including its adjacent-link handling.
  const urls = parseSourceLinks(trimmed);
  if (urls) return { kind: 'links', urls };
  if (looksLikeLink(trimmed)) return { kind: 'invalid' };
  return { kind: 'search', query: trimmed.replace(/\s+/g, ' ') };
}
