import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Une erreur inattendue est survenue.' }
  }

  componentDidCatch(error) {
    console.error('ErrorBoundary:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, maxWidth: 720, margin: '40px auto', background: '#FEF2F2', color: '#991B1B', borderRadius: 12, border: '1px solid #FECACA' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Erreur d affichage</div>
          <div style={{ fontSize: 14 }}>{this.state.message}</div>
        </div>
      )
    }

    return this.props.children
  }
}
