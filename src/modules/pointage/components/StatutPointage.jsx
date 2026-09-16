import React from 'react'

export default function StatutPointage({ label = 'Statut', tone = 'neutral' }) {
  const toneStyles = {
    success: { background: '#dcfce7', color: '#166534' },
    warning: { background: '#fef3c7', color: '#92400e' },
    danger: { background: '#fee2e2', color: '#991b1b' },
    neutral: { background: '#e5e7eb', color: '#374151' },
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '999px',
        padding: '0.25rem 0.65rem',
        fontSize: '0.75rem',
        fontWeight: 700,
        ...toneStyles[tone] || toneStyles.neutral,
      }}
    >
      {label}
    </span>
  )
}
