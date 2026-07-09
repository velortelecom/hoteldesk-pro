import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../tokens'
import { LoaderIcon, AlertTriangleIcon, SearchIcon, InfoIcon } from '../Icons'
import Button from '../Button'

// EmptyState officiel Velor One (chargement, erreur, liste vide, aucune donnee, aucun resultat).

var PRESETS = {
  loading: { icon: LoaderIcon, title: 'Chargement...', spin: true, color: COLORS.secondaire },
  error: { icon: AlertTriangleIcon, title: 'Une erreur est survenue', color: COLORS.erreur },
  empty: { icon: InfoIcon, title: 'Aucune donnee pour le moment', color: '#9CA3AF' },
  noData: { icon: InfoIcon, title: 'Aucune donnee disponible', color: '#9CA3AF' },
  noResults: { icon: SearchIcon, title: 'Aucun resultat trouve', color: '#9CA3AF' },
}

export function EmptyState(props) {
  var preset = PRESETS[props.type] || {}
    var Icon = props.icon || preset.icon || InfoIcon
  var title = props.title || preset.title || ''
  var color = props.color || preset.color || '#9CA3AF'

return React.createElement('div', {
  style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: SPACING.xxl, color: color, gap: SPACING.sm },
  role: props.type === 'error' ? 'alert' : undefined,
}, [
  React.createElement('div', { key: 'icon', style: { animation: preset.spin ? 'velor-spin 0.9s linear infinite' : 'none', display: 'inline-flex' } }, React.createElement(Icon, { size: 36 })),
  React.createElement('div', { key: 'title', style: { fontSize: FONT_SIZE.section, fontWeight: FONT_WEIGHT.semibold, color: COLORS.texte, marginTop: SPACING.sm } }, title),
  props.description ? React.createElement('div', { key: 'desc', style: { fontSize: FONT_SIZE.small, color: '#6B7280', maxWidth: '360px' } }, props.description) : null,
  props.actionLabel ? React.createElement('div', { key: 'action', style: { marginTop: SPACING.md } }, React.createElement(Button, { onClick: props.onAction, size: 'sm' }, props.actionLabel)) : null,
  ])
}

export default EmptyState
