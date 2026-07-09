import React from 'react'
import COLORS from '../../../branding/theme'
import { RADIUS, FONT_WEIGHT } from '../tokens'

// Badges officiels Velor One (roles + statuts). Ne pas creer d'autres styles de badges ailleurs.

var ROLE_PRESETS = {
  super_admin: { label: 'Super Admin', bg: '#111827', color: '#FFFFFF' },
  admin: { label: 'Admin', bg: COLORS.secondaire, color: '#FFFFFF' },
  responsable: { label: 'Responsable', bg: COLORS.accent, color: '#0F172A' },
  employe: { label: 'Employe', bg: '#E5E7EB', color: COLORS.texte },
}

var STATUS_PRESETS = {
  actif: { label: 'Actif', bg: '#DCFCE7', color: '#166534' },
  inactif: { label: 'Inactif', bg: '#F3F4F6', color: '#6B7280' },
  en_retard: { label: 'En retard', bg: '#FEE2E2', color: '#991B1B' },
  urgent: { label: 'Urgent', bg: '#FEE2E2', color: '#991B1B' },
  termine: { label: 'Termine', bg: '#DCFCE7', color: '#166534' },
  en_attente: { label: 'En attente', bg: '#FEF9C3', color: '#854D0E' },
  valide: { label: 'Valide', bg: '#DCFCE7', color: '#166534' },
  refuse: { label: 'Refuse', bg: '#FEE2E2', color: '#991B1B' },
}

export function Badge(props) {
  var preset = props.role ? ROLE_PRESETS[props.role] : (props.status ? STATUS_PRESETS[props.status] : null)
  var bg = (preset && preset.bg) || props.bg || '#E5E7EB'
  var color = (preset && preset.color) || props.color || COLORS.texte
  var label = (preset && preset.label) || props.children

return React.createElement('span', {
  style: Object.assign({
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: RADIUS.full,
    fontSize: '12px',
    fontWeight: FONT_WEIGHT.semibold,
    background: bg,
    color: color,
    lineHeight: '20px',
    whiteSpace: 'nowrap',
  }, props.style || {}),
  'aria-label': props['aria-label'] || (typeof label === 'string' ? label : undefined),
}, label)
}

export function RoleBadge(props) {
  return React.createElement(Badge, { role: props.role })
}

export function StatusBadge(props) {
  return React.createElement(Badge, { status: props.status })
}

export default Badge
