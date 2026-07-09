import React from 'react'
import COLORS from '../../../branding/theme'
import { TRANSITION } from '../tokens'

// Switch officiel Velor One (toggle on/off). Ne pas creer d'autre toggle ailleurs.

export function Switch(props) {
  var checked = !!props.checked

return React.createElement('label', {
  style: { display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1, userSelect: 'none' },
}, [
  React.createElement('input', {
    key: 'native',
    type: 'checkbox',
    checked: checked,
    disabled: props.disabled,
    onChange: props.onChange,
    style: { position: 'absolute', opacity: 0, width: 1, height: 1 },
    role: 'switch',
    'aria-checked': checked,
    'aria-label': props['aria-label'] || props.label,
  }),
  React.createElement('span', {
    key: 'track',
    className: 'velor-focus-ring',
    style: {
      width: '40px',
      height: '22px',
      borderRadius: '9999px',
      background: checked ? COLORS.secondaire : '#D1D5DB',
      transition: 'background ' + TRANSITION.fast,
      position: 'relative',
      flexShrink: 0,
    },
  }, React.createElement('span', {
    style: {
      position: 'absolute',
      top: '2px',
      left: checked ? '20px' : '2px',
      width: '18px',
      height: '18px',
      borderRadius: '50%',
      background: '#FFFFFF',
      boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
      transition: 'left ' + TRANSITION.fast,
    },
  })),
  props.label ? React.createElement('span', { key: 'label', style: { fontSize: '14px', color: COLORS.texte } }, props.label) : null,
  ])
}

export default Switch
