import React from 'react'
import COLORS from '../../../branding/theme'
import { SPACING, FONT_SIZE, FONT_WEIGHT } from '../tokens'

// Section officielle Velor One. Regroupe du contenu avec un titre. Ne pas dupliquer ailleurs.

export function Section(props) {
  return React.createElement('section', { style: Object.assign({ marginBottom: SPACING.xl }, props.style || {}) }, [
    (props.title || props.actions) ? React.createElement('div', { key: 'header', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md } }, [
      props.title ? React.createElement('h2', { key: 'title', style: { fontSize: FONT_SIZE.h3, fontWeight: FONT_WEIGHT.semibold, color: COLORS.texte, margin: 0 } }, props.title) : null,
      props.actions ? React.createElement('div', { key: 'actions', style: { display: 'flex', gap: SPACING.sm } }, props.actions) : null,
      ]) : null,
    props.description ? React.createElement('p', { key: 'desc', style: { fontSize: FONT_SIZE.small, color: '#6B7280', marginTop: '-8px', marginBottom: SPACING.md } }, props.description) : null,
    React.createElement('div', { key: 'content' }, props.children),
    ])
}

export default Section
