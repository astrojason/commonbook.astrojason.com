import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { RequireAuth } from './components/RequireAuth'
import { RequireAdmin } from './components/RequireAdmin'
import { Shell } from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Capture from './pages/Capture'
import NoteDetail from './pages/NoteDetail'
import Session from './pages/Session'
import Library from './pages/Library'
import Admin from './pages/Admin'
import Settings from './pages/Settings'
import Discover from './pages/Discover'

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<Shell />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/capture" element={<Capture />} />
              <Route path="/note/:id" element={<NoteDetail />} />
              <Route path="/session/:sessionId" element={<Session />} />
              <Route path="/library" element={<Library />} />
              <Route path="/discover" element={<Discover />} />
              <Route path="/settings" element={<Settings />} />
              <Route element={<RequireAdmin />}>
                <Route path="/admin" element={<Admin />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  )
}
