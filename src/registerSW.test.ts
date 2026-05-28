import { setupServiceWorker } from './registerSW'

const mockRegister = vi.fn().mockResolvedValue({})

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(navigator, 'serviceWorker', {
    value: { register: mockRegister },
    configurable: true,
  })
})

afterEach(() => {
  // Remove any pending load listeners added by setupServiceWorker
  window.removeEventListener('load', () => {})
})

describe('setupServiceWorker', () => {
  it('registers /sw.js when document is already complete', () => {
    // jsdom sets readyState to 'complete' after initial setup
    Object.defineProperty(document, 'readyState', {
      value: 'complete',
      configurable: true,
    })

    setupServiceWorker()

    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' })
  })

  it('defers registration until the load event when document is not yet complete', () => {
    Object.defineProperty(document, 'readyState', {
      value: 'loading',
      configurable: true,
    })

    setupServiceWorker()
    expect(mockRegister).not.toHaveBeenCalled()

    window.dispatchEvent(new Event('load'))
    expect(mockRegister).toHaveBeenCalledWith('/sw.js', { scope: '/' })

    // Restore
    Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true })
  })

  it('does nothing when serviceWorker is not supported', () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: undefined,
      configurable: true,
    })

    expect(() => setupServiceWorker()).not.toThrow()
    expect(mockRegister).not.toHaveBeenCalled()
  })
})
