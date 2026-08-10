/**
 * Match href against a pattern that may contain `*` wildcards.
 * Exact regex match after escaping, or substring fallback with `*` stripped.
 */
export function urlMatches(pattern, href) {
  if (!pattern) return false
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp('^' + escaped + '$').test(href) || href.includes(pattern.replace(/\*/g, ''))
}
