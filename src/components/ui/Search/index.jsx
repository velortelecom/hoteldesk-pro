import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, RADIUS, FONT_SIZE, TRANSITION } from '../tokens'
import { SearchIcon, XIcon } from '../Icons'

// Barre de recherche officielle Velor One. Ne pas creer une autre barre de recherche ailleurs.

export function Search(props) {
  var state = React.useState(false)
  var focused = state[0]
  var setFocused = state[1]

return React.createElement('div', {
  style: {
    display: 'flex',
    alignItems: 'center',
    gap: SPACING.sm,
    height: '40px',
    padding: '0 ' + SPACING.md,
    borderRadius: RADIUS.md,
    border: '1px solid ' + (focused ? COLORS.secondaire : '#D1D5DB'),
    boxShadow: focused ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
    background: '#FFFFFF',
    transition: 'border-color ' + TRANSITION.fast + ', box-shadow ' + TRANSITION.fast,
    width: props.fullWidth === false ? 'auto' : '100%',
    boxSizing: 'border-box',
  },
}, [
  React.createElement(SearchIcon, { key: 'icon', size: 16, color: '#9CA3AF' }),
  React.createElement('input', {
    key: 'input',
    type: 'text',
    value: props.value,
    placeholder: props.placeholder || 'Rechercher...',
    onChange: props.onChange,
    onFocus: function () { setFocused(true) },
    onBlur: function () { setFocused(false) },
    'aria-label': props['aria-label'] || 'Rechercher',
    style: { border: 'none', outline: 'none', fontSize: FONT_SIZE.text, flex: 1, fontFamily: 'inherit', color: COLORS.texte, background: 'transparent' },
  }),
  props.value ? React.createElement('button', {
    key: 'clear',
    type: 'button',
    'aria-label': 'Effacer la recherche',
    onClick: props.onClear,
    style: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: '#9CA3AF', padding: 0 },
  }, React.createElement(XIcon, { size: 14 })) : null,
  ])
}

export default Search
