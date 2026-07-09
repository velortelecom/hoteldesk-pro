// Design tokens Velor One - source unique pour espacements, typographie, rayons, ombres et animations
// Ne jamais coder ces valeurs en dur ailleurs. Toujours importer depuis ce fichier.

export const SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
}

export const RADIUS = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  full: '9999px',
}

export const FONT_SIZE = {
  h1: '28px',
  h2: '22px',
  h3: '18px',
  section: '15px',
  text: '14px',
  small: '12px',
  caption: '11px',
}

export const FONT_WEIGHT = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

export const SHADOW = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.06)',
  md: '0 4px 12px rgba(15, 23, 42, 0.10)',
  lg: '0 12px 32px rgba(15, 23, 42, 0.18)',
}

export const TRANSITION = {
  fast: '120ms ease',
  base: '180ms ease',
  slow: '280ms ease',
}

export const BREAKPOINT = {
  mobile: '480px',
  tablet: '768px',
  desktop: '1200px',
}

const TOKENS = { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOW, TRANSITION, BREAKPOINT }

export default TOKENS
