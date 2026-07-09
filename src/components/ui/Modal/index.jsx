import React from 'react'
import COLORS from '../../../branding/theme'
import { RADIUS, SPACING, SHADOW } from '../tokens'
import { XIcon } from '../Icons'

// Modal officiel Velor One. Base pour Dialog. Ne pas recreer d'autre overlay ailleurs.

export function Modal(props) {
  var open = props.open

React.useEffect(function () {
  if (!open) { return }
  function onKeyDown(e) {
    if (e.key === 'Escape' && props.onClose) { props.onClose() }
  }
  document.addEventListener('keydown', onKeyDown)
  return function () { document.removeEventListener('keydown', onKeyDown) }
}, [open, props.onClose])

if (!open) { return null }

return React.createElement('div', {
  style: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(15, 23, 42, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'velor-fade-in 0.18s ease',
    padding: SPACING.md,
  },
  onClick: function (e) { if (e.target === e.currentTarget && props.onClose) { props.onClose() } },
  role: 'presentation',
}, React.createElement('div', {
  style: {
    background: '#FFFFFF',
    borderRadius: RADIUS.lg,
    boxShadow: SHADOW.lg,
    width: props.width || '480px',
    maxWidth: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    animation: 'velor-scale-in 0.18s ease',
  },
  role: 'dialog',
  'aria-modal': 'true',
  'aria-label': props.title,
}, [
  React.createElement('div', {
    key: 'header',
    style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: SPACING.lg, borderBottom: '1px solid #E5E7EB' },
  }, [
    React.createElement('div', { key: 'title', style: { fontWeight: 600, fontSize: '16px', color: COLORS.texte } }, props.title),
    props.onClose ? React.createElement('button', {
      key: 'close',
      onClick: props.onClose,
      'aria-label': 'Fermer',
      className: 'velor-focus-ring',
      style: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#6B7280', display: 'flex', padding: '4px' },
    }, React.createElement(XIcon, { size: 18 })) : null,
    ]),
  React.createElement('div', { key: 'body', style: { padding: SPACING.lg } }, props.children),
  props.footer ? React.createElement('div', { key: 'footer', style: { padding: SPACING.lg, borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: SPACING.sm } }, props.footer) : null,
  ]))
}

export default Modal
