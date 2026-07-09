import React from 'react'
import { RADIUS, FONT_SIZE, TRANSITION } from '../tokens'

// Tooltip officiel Velor One. Ne pas creer un autre tooltip ailleurs.

export function Tooltip(props) {
  var state = React.useState(false)
  var visible = state[0]
  var setVisible = state[1]

return React.createElement('span', {
  style: { position: 'relative', display: 'inline-flex' },
  onMouseEnter: function () { setVisible(true) },
  onMouseLeave: function () { setVisible(false) },
  onFocus: function () { setVisible(true) },
  onBlur: function () { setVisible(false) },
}, [
  props.children,
  visible && props.label ? React.createElement('span', {
    key: 'tooltip',
    role: 'tooltip',
    style: {
      position: 'absolute',
      bottom: 'calc(100% + 6px)',
      left: '50%',
      transform: 'translateX(-50%)',
      background: '#111827',
      color: '#FFFFFF',
      fontSize: FONT_SIZE.caption,
      padding: '4px 8px',
      borderRadius: RADIUS.sm,
      whiteSpace: 'nowrap',
      animation: 'velor-fade-in ' + TRANSITION.fast,
      zIndex: 1500,
      pointerEvents: 'none',
    },
  }, props.label) : null,
  ])
}

export default Tooltip
