import React from 'react'
import COLORS from '../../../branding/theme'
import { RADIUS, FONT_SIZE, TRANSITION } from '../tokens'
import { CheckIcon } from '../Icons'

// Checkbox officiel Velor One. Ne pas creer d'autre case a cocher ailleurs.

export function Checkbox(props) {
  var checked = !!props.checked

return React.createElement('label', {
  style: { display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: props.disabled ? 'not-allowed' : 'pointer', opacity: props.disabled ? 0.6 : 1, fontSize: FONT_SIZE.text, color: COLORS.texte, userSelect: 'none' },
}, [
  React.createElement('input', {
    key: 'native',
    type: 'checkbox',
    checked: checked,
    disabled: props.disabled,
    onChange: props.onChange,
    style: { position: 'absolute', opacity: 0, width: 1, height: 1 },
    'aria-label': props['aria-label'],
  }),
  React.createElement('span', {
    key: 'box',
    className: 'velor-focus-ring',
    style: {
      width: '18px',
      height: '18px',
      borderRadius: RADIUS.sm,
      border: '1.5px solid ' + (checked ? COLORS.secondaire : '#D1D5DB'),
      background: checked ? COLORS.secondaire : '#FFFFFF',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
      transition: 'background ' + TRANSITION.fast + ', border-color ' + TRANSITION.fast,
      flexShrink: 0,
    },
  }, checked ? React.createElement(CheckIcon, { size: 12, strokeWidth: 3 }) : null),
  props.label ? React.createElement('span', { key: 'label' }, props.label) : null,
  ])
}

export default Checkbox
