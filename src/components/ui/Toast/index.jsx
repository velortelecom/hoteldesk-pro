import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, RADIUS, SHADOW, FONT_SIZE } from '../tokens'
import { CheckIcon, AlertTriangleIcon, InfoIcon, XIcon } from '../Icons'

// Toast officiel Velor One. Ne pas creer un autre systeme de notification ailleurs.

var ToastContext = React.createContext(null)

var VARIANTS = {
  success: { icon: CheckIcon, color: COLORS.succes },
  error: { icon: AlertTriangleIcon, color: COLORS.erreur },
  info: { icon: InfoIcon, color: COLORS.secondaire },
}

export function ToastProvider(props) {
  var state = React.useState([])
  var toasts = state[0]
  var setToasts = state[1]

function remove(id) {
  setToasts(function (list) { return list.filter(function (t) { return t.id !== id }) })
}

function show(options) {
  var id = Date.now() + '-' + Math.random()
  var toast = { id: id, type: options.type || 'info', message: options.message, title: options.title }
  setToasts(function (list) { return list.concat([toast]) })
  setTimeout(function () { remove(id) }, options.duration || 4000)
  return id
}

return React.createElement(ToastContext.Provider, { value: { show: show, remove: remove } }, [
  props.children,
  React.createElement('div', {
    key: 'container',
    style: { position: 'fixed', bottom: SPACING.lg, right: SPACING.lg, display: 'flex', flexDirection: 'column', gap: SPACING.sm, zIndex: 2000 },
    'aria-live': 'polite',
  }, toasts.map(function (t) {
    var variant = VARIANTS[t.type] || VARIANTS.info
    return React.createElement('div', {
      key: t.id,
      role: 'status',
      style: { display: 'flex', alignItems: 'flex-start', gap: SPACING.sm, background: '#FFFFFF', borderRadius: RADIUS.md, boxShadow: SHADOW.lg, padding: SPACING.md, minWidth: '280px', maxWidth: '360px', animation: 'velor-slide-up 0.2s ease', borderLeft: '4px solid ' + variant.color },
    }, [
      React.createElement(variant.icon, { key: 'icon', size: 18, color: variant.color }),
      React.createElement('div', { key: 'body', style: { flex: 1 } }, [
        t.title ? React.createElement('div', { key: 'title', style: { fontWeight: 600, fontSize: FONT_SIZE.text, color: COLORS.texte } }, t.title) : null,
        React.createElement('div', { key: 'msg', style: { fontSize: FONT_SIZE.small, color: '#6B7280' } }, t.message),
        ]),
      React.createElement('button', {
        key: 'close',
        type: 'button',
        'aria-label': 'Fermer la notification',
        onClick: function () { remove(t.id) },
        style: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#9CA3AF', display: 'flex', padding: 0 },
      }, React.createElement(XIcon, { size: 14 })),
      ])
  })),
  ])
}

export function useToast() {
  return React.useContext(ToastContext)
}

export default ToastProvider
