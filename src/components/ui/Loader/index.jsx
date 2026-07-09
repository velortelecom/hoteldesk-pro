import React from 'react'
import { BrandMark } from '../../../branding/Brand'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE } from '../tokens'

// Loader officiel Velor One. Utilise le logo officiel. Ne jamais creer un autre loader ailleurs.

export function Loader(props) {
  var size = props.size || 48

return React.createElement('div', {
  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: SPACING.md, padding: props.fullScreen ? SPACING.xxl : SPACING.md },
  role: 'status',
  'aria-live': 'polite',
  'aria-label': props.label || 'Chargement en cours',
}, [
  React.createElement('div', {
    key: 'logo',
    style: { animation: 'velor-pulse 1.2s ease-in-out infinite', display: 'inline-flex' },
  }, React.createElement(BrandMark, { size: size, radius: Math.round(size * 0.28) })),
  props.label !== false ? React.createElement('div', { key: 'label', style: { fontSize: FONT_SIZE.small, color: COLORS.texte, fontWeight: 500 } }, props.label || 'Chargement...') : null,
  ])
}

export default Loader
