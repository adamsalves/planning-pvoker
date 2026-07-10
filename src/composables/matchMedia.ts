// Feature-detection: jsdom (testes) e ambientes SSR não têm matchMedia/window.
export function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
}

export function prefersReducedMotion(): boolean {
  return canMatchMedia() && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
