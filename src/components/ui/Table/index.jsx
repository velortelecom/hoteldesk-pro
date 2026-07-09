import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../tokens'

// Table officielle Velor One. Ne pas creer un autre style de tableau ailleurs.

export function Table(props) {
  return React.createElement('div', { style: { width: '100%', overflowX: 'auto' } }, React.createElement('table', {
    style: { width: '100%', borderCollapse: 'collapse', fontSize: FONT_SIZE.text },
  }, props.children))
}

export function TableHead(props) {
  return React.createElement('thead', null, props.children)
}

export function TableBody(props) {
  return React.createElement('tbody', null, props.children)
}

export function TableRow(props) {
  return React.createElement('tr', {
    onClick: props.onClick,
    style: { borderBottom: '1px solid #E5E7EB', cursor: props.onClick ? 'pointer' : 'default', background: props.selected ? '#EFF6FF' : 'transparent' },
  }, props.children)
}

export function TableHeaderCell(props) {
  return React.createElement('th', {
    style: { textAlign: props.align || 'left', padding: SPACING.md, fontSize: FONT_SIZE.small, fontWeight: FONT_WEIGHT.semibold, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.03em', whiteSpace: 'nowrap' },
  }, props.children)
}

export function TableCell(props) {
  return React.createElement('td', {
    style: { textAlign: props.align || 'left', padding: SPACING.md, color: COLORS.texte },
  }, props.children)
}

export default Table
