import { HashRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import AppShell from './app/layouts/AppShell'

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <AppShell />
      </HashRouter>
    </AuthProvider>
  )
}
