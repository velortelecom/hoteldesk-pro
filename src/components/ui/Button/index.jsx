import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, RADIUS, FONT_SIZE, FONT_WEIGHT, TRANSITION } from '../tokens'

// Bibliotheque unique de boutons Velor One. Ne jamais creer un autre style de bouton ailleurs.

var VARIANTS = {
  primary: { bg: COLORS.secondaire, color: '#FFFFFF', border: 'transparent' },
  secondary: { bg: COLORS.primaire, color: '#FFFFFF', border: 'transparent' },
  success: { bg: COLORS.succes, color: '#FFFFFF', border: 'transparent' },
  danger: { bg: COLORS.erreur, color: '#FFFFFF', border: 'transparent' },
  ghost: { bg: 'transparent', color: COLORS.primaire, border: 'transparent' },
  outline: { bg: 'transparent', color: COLORS.secondaire, border: COLORS.secondaire },
}

var SIZES = {
  sm: { height: '32px', padding: '0 ' + SPACING.md, fontSize: FONT_SIZE.small },
  md: { height: '40px', padding: '0 ' + SPACING.lg, fontSize: FONT_SIZE.text },
  lg: { height: '48px', padding: '0 ' + SPACING.xl, fontSize: FONT_SIZE.section },
}

export function Button(props) {
  var variant = VARIANTS[props.variant || 'primary'] || VARIANTS.primary
  var size = SIZES[props.size || 'md'] || SIZES.md
  var disabled = props.disabled || props.loading
  var state = React.useState(false)
  var hover = state[0]
  var setHover = state[1]
  var isActive = hover && !disabled

var style = Object.assign({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.sm,
  height: size.height,
  padding: size.padding,
  fontSize: size.fontSize,
  fontWeight: FONT_WEIGHT.semibold,
  fontFamily: 'inherit',
  borderRadius: RADIUS.md,
  border: '1px solid ' + variant.border,
  background: variant.bg,
  color: variant.color,
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.6 : (hover ? 0.9 : 1),
  transition: 'opacity ' + TRANSITION.fast + ', transform ' + TRANSITION.fast,
  transform: isActive ? 'translateY(-1px)' : 'translateY(0)',
  outline: 'none',
  width: props.fullWidth ? '100%' : 'auto',
}, props.style || {})

return React.createElement('button', {
  type: props.type || 'button',
  onClick: props.onClick,
  disabled: disabled,
  style: style,
  onMouseEnter: function () { setHover(true) },
  onMouseLeave: function () { setHover(false) },
  onFocus: function () { setHover(true) },
  onBlur: function () { setHover(false) },
  'aria-label': props['aria-label'],
  'aria-busy': props.loading ? 'true' : undefined,
}, [
  props.loading ? React.createElement('span', { key: 'spinner', style: { width: '14px', height: '14px', borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', animation: 'velor-spin 0.7s linear infinite', display: 'inline-block' } }) : null,
  props.icon ? React.createElement('span', { key: 'icon', style: { display: 'inline-flex' } }, props.icon) : null,
  React.createElement('span', { key: 'label' }, props.children),
  ])
}

export default Button
