import React from 'react'
import COLORS from '../../../branding/theme'
import Card from '../Card'
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../tokens'

// StatCard officiel Velor One pour afficher une statistique (dashboard, rapports).

export function StatCard(props) {
  var trendColor = props.trendPositive ? COLORS.succes : COLORS.erreur

return React.createElement(Card, { style: Object.assign({ textAlign: 'left', minWidth: '160px' }, props.style || {}) }, [
  React.createElement('div', { key: 'label', style: { fontSize: FONT_SIZE.small, color: '#6B7280', marginBottom: SPACING.xs } }, props.label),
  React.createElement('div', { key: 'value', style: { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold, color: COLORS.texte, display: 'flex', alignItems: 'center', gap: SPACING.sm } }, [
    props.icon ? React.createElement('span', { key: 'icon', style: { display: 'inline-flex', color: COLORS.secondaire } }, props.icon) : null,
    React.createElement('span', { key: 'v' }, props.value),
    ]),
  props.trend ? React.createElement('div', { key: 'trend', style: { fontSize: FONT_SIZE.caption, color: trendColor, marginTop: SPACING.xs, fontWeight: FONT_WEIGHT.medium } }, props.trend) : null,
  ])
}

export default StatCard
