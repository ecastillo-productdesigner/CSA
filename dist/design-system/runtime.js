// Read the same generated custom properties used by the component styles.
export function tokenValue(path, element = document.documentElement) {
  const name = `--csa-${path.replaceAll('.', '-')}`;
  const value = getComputedStyle(element).getPropertyValue(name).trim();
  if (!value) throw new Error(`Missing design token: ${path}`);
  return value;
}
export function tokenNumber(path, element) {
  const value = Number.parseFloat(tokenValue(path, element));
  if (!Number.isFinite(value)) throw new Error(`Design token is not numeric: ${path}`);
  return value;
}
export function breakpointQuery(name = 'mobile', condition = 'max-width') {
  return `(${condition}: ${tokenValue(`foundation.breakpoint.${name}`)})`;
}
