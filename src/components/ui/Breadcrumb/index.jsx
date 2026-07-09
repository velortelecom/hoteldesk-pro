import React from 'react'
import COLORS from '../../../branding/theme'
import { FONT_SIZE } from '../tokens'
import { ChevronRightIcon } from '../Icons'

// Breadcrumb officiel Velor One. Ne pas creer un autre fil d'ariane ailleurs.

export function Breadcrumb(props) {
  var items = props.items || []

    return React.createElement('nav', { 'aria-label': 'Fil d ariane' }, React.createElement('ol', {
      style: { display: 'flex', alignItems: 'center', gap: '6px', listStyle: 'none', padding: 0, margin: 0, fontSize: FONT_SIZE.small, flexWrap: 'wrap' },
    }, items.map(function (item, i) {
      var isLast = i === items.length - 1
      return React.createElement('li', { key: i, style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
        item.href && !isLast ? React.createElement('a', { key: 'link', href: item.href, onClick: item.onClick, style: { color: '#6B7280', textDecoration: 'none' } }, item.label) : React.createElement('span', { key: 'text', style: { color: isLast ? COLORS.texte : '#6B7280', fontWeight: isLast ? 600 : 400 }, 'aria-current': isLast ? 'page' : undefined }, item.label),
        !isLast ? React.createElement(ChevronRightIcon, { key: 'sep', size: 14, color: '#D1D5DB' }) : null,
        ])
    })))
}

export default Breadcrumb
