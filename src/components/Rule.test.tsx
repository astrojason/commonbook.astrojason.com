import { render } from '@testing-library/react'
import { Rule } from './Rule'

describe('Rule', () => {
  it('renders a solid 1px line by default', () => {
    const { container } = render(<Rule />)
    expect(container.firstChild).toHaveClass('h-px')
    expect(container.firstChild).not.toHaveClass('dashed-rule')
  })

  it('renders with dashed-rule class when dashed=true', () => {
    const { container } = render(<Rule dashed />)
    expect(container.firstChild).toHaveClass('dashed-rule')
    expect(container.firstChild).not.toHaveClass('h-px')
  })
})
