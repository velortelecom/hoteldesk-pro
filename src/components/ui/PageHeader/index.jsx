import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../tokens'
import Breadcrumb from '../Breadcrumb'

// PageHeader officiel Velor One. Ne pas recreer un autre en-tete de page ailleurs.

export function PageHeader(props) {
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginBottom: SPACING.lg } }, [
    props.breadcrumb ? React.createElement(Breadcrumb, { key: 'crumb', items: props.breadcrumb }) : null,
    React.createElement('div', { key: 'row', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACING.md } }, [
      React.createElement('div', { key: 'titles' }, [
        React.createElement('h1', { key: 'title', style: { fontSize: FONT_SIZE.h1, fontWeight: FONT_WEIGHT.bold, color: COLORS.texte, margin: 0 } }, props.title),
        props.subtitle ? React.createElement('p', { key: 'subtitle', style: { fontSize: FONT_SIZE.text, color: '#6B7280', margin: '4px 0 0 0' } }, props.subtitle) : null,
        ]),
      props.actions ? React.createElement('div', { key: 'actions', style: { display: 'flex', gap: SPACING.sm, alignItems: 'center' } }, props.actions) : null,
      ]),
    ])
}

export default PageHeader
