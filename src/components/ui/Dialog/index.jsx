import React from 'react'
import Modal from '../Modal'
import Button from '../Button'

// Dialog officiel Velor One (confirmation / alerte). Construit sur Modal, ne pas dupliquer.

export function Dialog(props) {
  var footer = [
    props.cancelLabel !== false ? React.createElement(Button, { key: 'cancel', variant: 'ghost', onClick: props.onCancel || props.onClose }, props.cancelLabel || 'Annuler') : null,
    React.createElement(Button, { key: 'confirm', variant: props.danger ? 'danger' : 'primary', onClick: props.onConfirm, loading: props.loading }, props.confirmLabel || 'Confirmer'),
    ]

return React.createElement(Modal, {
  open: props.open,
  onClose: props.onClose,
  title: props.title,
  width: props.width || '400px',
  footer: footer,
}, React.createElement('div', { style: { color: '#374151', fontSize: '14px', lineHeight: '1.5' } }, props.message || props.children))
}

export default Dialog
