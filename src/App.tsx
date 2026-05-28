import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { RequireAuth } from './components/RequireAuth'
import { Shell } from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Capture from './pages/Capture'
import NoteDetail from './pages/NoteDetail'
import Session from './pages/Session'
import Library from './pages/Library'

export default function App() {
  return (
    <BrowserRouter>
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
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
