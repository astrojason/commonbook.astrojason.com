import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { SpeedReader } from './SpeedReader'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

const word = () => screen.getByTestId('rsvp-word').textContent

describe('SpeedReader', () => {
  it('shows the first word, paused, with 0% progress and default 300 WPM', () => {
    render(<SpeedReader text="alpha beta gamma delta" onClose={() => {}} />)
    expect(word()).toBe('alpha')
    expect(screen.getByText(/300 WPM/)).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })

  it('advances one word per 60000/wpm ms once playing', () => {
    render(<SpeedReader text="alpha beta gamma delta" onClose={() => {}} />)
    fireEvent.keyDown(window, { key: ' ' })
    act(() => { vi.advanceTimersByTime(200) })
    expect(word()).toBe('beta')
    act(() => { vi.advanceTimersByTime(200) })
    expect(word()).toBe('gamma')
    expect(screen.getByText('67%')).toBeInTheDocument()
  })

  it('pauses on Space and restarts on R', () => {
    render(<SpeedReader text="alpha beta gamma delta" onClose={() => {}} />)
    fireEvent.keyDown(window, { key: ' ' })
    act(() => { vi.advanceTimersByTime(200) })
    fireEvent.keyDown(window, { key: ' ' })
    act(() => { vi.advanceTimersByTime(1000) })
    expect(word()).toBe('beta')
    fireEvent.keyDown(window, { key: 'r' })
    expect(word()).toBe('alpha')
  })

  it('stops on the last word at 100%', () => {
    render(<SpeedReader text="alpha beta" onClose={() => {}} />)
    fireEvent.keyDown(window, { key: ' ' })
    act(() => { vi.advanceTimersByTime(2000) })
    expect(word()).toBe('beta')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })

  it('changes speed with the WPM buttons', () => {
    render(<SpeedReader text="alpha beta" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'faster' }))
    expect(screen.getByText(/325 WPM/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'slower' }))
    fireEvent.click(screen.getByRole('button', { name: 'slower' }))
    expect(screen.getByText(/275 WPM/)).toBeInTheDocument()
  })

  it('closes on Escape and the close button', () => {
    const onClose = vi.fn()
    render(<SpeedReader text="alpha" onClose={onClose} />)
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'close' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
