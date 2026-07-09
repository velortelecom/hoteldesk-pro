import React from 'react'
import COLORS from '../../../branding/theme'
import { RADIUS, FONT_WEIGHT } from '../tokens'

// Avatar officiel Velor One. Affiche une photo si disponible, sinon les initiales.

var BG_FROM_STRING = ['#2563EB', '#38BDF8', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6']

function colorFor(text) {
  var sum = 0
  for (var i = 0; i < (text || '').length; i++) { sum += text.charCodeAt(i) }
  return BG_FROM_STRING[sum % BG_FROM_STRING.length]
}

export function Avatar(props) {
  var size = props.size || 36
  var initials = (props.initials || '').slice(0, 2).toUpperCase()

var style = {
  width: size + 'px',
  height: size + 'px',
  borderRadius: RADIUS.full,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: Math.round(size * 0.4) + 'px',
  fontWeight: FONT_WEIGHT.semibold,
  color: '#FFFFFF',
  background: colorFor(initials || props.name),
  flexShrink: 0,
  overflow: 'hidden',
}

if (props.src) {
  return React.createElement('img', {
    src: props.src,
    alt: props.name || 'Avatar',
    style: Object.assign(style, { objectFit: 'cover', background: COLORS.fond }),
  })
}

return React.createElement('div', {
  style: style,
  'aria-label': props.name || initials,
  role: 'img',
}, initials)
}

export default Avatar
