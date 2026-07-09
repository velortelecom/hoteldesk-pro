import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, RADIUS, FONT_SIZE, TRANSITION } from '../tokens'
import { ChevronDownIcon } from '../Icons'

// Select officiel Velor One. Meme hauteur, couleurs et focus que Input.

export function Select(props) {
  var state = React.useState(false)
  var focused = state[0]
  var setFocused = state[1]
  var hasError = !!props.error
  var borderColor = hasError ? COLORS.erreur : (focused ? COLORS.secondaire : '#D1D5DB')
  var options = props.options || []

    return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', width: props.fullWidth === false ? 'auto' : '100%' } }, [
      props.label ? React.createElement('label', { key: 'label', htmlFor: props.id, style: { fontSize: FONT_SIZE.small, fontWeight: 600, color: COLORS.texte } }, props.label) : null,
      React.createElement('div', { key: 'wrap', style: { position: 'relative' } }, [
        React.createElement('select', {
          key: 'select',
          id: props.id,
          value: props.value,
          defaultValue: props.defaultValue,
          disabled: props.disabled,
          required: props.required,
          name: props.name,
          onChange: props.onChange,
          onFocus: function (e) { setFocused(true); props.onFocus && props.onFocus(e) },
          onBlur: function (e) { setFocused(false); props.onBlur && props.onBlur(e) },
          'aria-invalid': hasError ? 'true' : undefined,
          style: {
            height: '40px',
            padding: '0 ' + SPACING.xl + ' 0 ' + SPACING.md,
            fontSize: FONT_SIZE.text,
            borderRadius: RADIUS.md,
            border: '1px solid ' + borderColor,
            boxShadow: focused ? '0 0 0 3px rgba(37, 99, 235, 0.15)' : 'none',
            outline: 'none',
            color: COLORS.texte,
            background: props.disabled ? '#F3F4F6' : '#FFFFFF',
            transition: 'border-color ' + TRANSITION.fast + ', box-shadow ' + TRANSITION.fast,
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'inherit',
            appearance: 'none',
          },
        }, [
          props.placeholder ? React.createElement('option', { key: 'ph', value: '', disabled: true }, props.placeholder) : null,
          ].concat(options.map(function (opt, i) {
            return React.createElement('option', { key: i, value: opt.value }, opt.label)
          }))),
        React.createElement('span', { key: 'chevron', style: { position: 'absolute', right: SPACING.md, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#6B7280' } }, React.createElement(ChevronDownIcon, { size: 16 })),
        ]),
      hasError ? React.createElement('div', { key: 'error', style: { fontSize: FONT_SIZE.caption, color: COLORS.erreur }, role: 'alert' }, props.error) : null,
      ])
}

export default Select
