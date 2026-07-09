import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE, FONT_WEIGHT, TRANSITION } from '../tokens'

// Tabs officiels Velor One. Ne pas creer un autre systeme d'onglets ailleurs.

export function Tabs(props) {
  var tabs = props.tabs || []
    var active = props.value

function onKeyDown(e, index) {
  if (e.key === 'ArrowRight') {
    var next = tabs[(index + 1) % tabs.length]
    props.onChange && next && props.onChange(next.value)
  } else if (e.key === 'ArrowLeft') {
    var prev = tabs[(index - 1 + tabs.length) % tabs.length]
    props.onChange && prev && props.onChange(prev.value)
  }
}

return React.createElement('div', { role: 'tablist', style: { display: 'flex', gap: SPACING.sm, borderBottom: '1px solid #E5E7EB' } }, tabs.map(function (tab, i) {
  var isActive = tab.value === active
  return React.createElement('button', {
    key: tab.value,
    role: 'tab',
    type: 'button',
    'aria-selected': isActive,
    className: 'velor-focus-ring',
    onClick: function () { props.onChange && props.onChange(tab.value) },
    onKeyDown: function (e) { onKeyDown(e, i) },
    style: {
      padding: SPACING.sm + ' ' + SPACING.md,
      fontSize: FONT_SIZE.text,
      fontWeight: isActive ? FONT_WEIGHT.semibold : FONT_WEIGHT.medium,
      color: isActive ? COLORS.secondaire : '#6B7280',
      background: 'transparent',
      border: 'none',
      borderBottom: isActive ? '2px solid ' + COLORS.secondaire : '2px solid transparent',
      cursor: 'pointer',
      transition: 'color ' + TRANSITION.fast + ', border-color ' + TRANSITION.fast,
      marginBottom: '-1px',
    },
  }, tab.label)
}))
        }

export default Tabs
