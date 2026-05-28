import { render, screen } from '@testing-library/react'
import App from './App'

vi.mock('./firebase', () => ({
  auth: {},
  googleProvider: {},
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_, cb) => {
    if (typeof cb === 'function') cb(null)
    return () => {}
  }),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}))

describe('App', () => {
  it('shows sign-in page for unauthenticated users', async () => {
    render(<App />)
    expect(await screen.findByText(/sign in with google/i)).toBeInTheDocument()
  })
})
