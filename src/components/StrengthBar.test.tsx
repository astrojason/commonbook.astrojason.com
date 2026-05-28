import { render, screen } from '@testing-library/react'
import { StrengthBar } from './StrengthBar'

describe('StrengthBar', () => {
  it('always renders 5 segments', () => {
    render(<StrengthBar value={3} />)
    expect(screen.getAllByTestId('segment')).toHaveLength(5)
  })

  it('fills the correct number of segments for each value', () => {
    const cases = [1, 2, 3, 4, 5]
    for (const value of cases) {
      const { unmount } = render(<StrengthBar value={value} showLabel={false} />)
      const segments = screen.getAllByTestId('segment')
      const filled = segments.filter(s => s.dataset.filled === 'true')
      expect(filled).toHaveLength(value)
      unmount()
    }
  })

  it('shows the correct strength label', () => {
    const labels = ['cold', 'cool', 'warm', 'hot', 'solid']
    labels.forEach((label, i) => {
      const { unmount } = render(<StrengthBar value={i + 1} />)
      expect(screen.getByText(label)).toBeInTheDocument()
      unmount()
    })
  })

  it('hides the label when showLabel=false', () => {
    render(<StrengthBar value={3} showLabel={false} />)
    expect(screen.queryByText('warm')).not.toBeInTheDocument()
  })
})
