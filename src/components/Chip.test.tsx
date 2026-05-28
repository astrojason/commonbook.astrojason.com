import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'

describe('Chip', () => {
  it('applies accent background and ink text when active', () => {
    render(<Chip active>test</Chip>)
    const chip = screen.getByText('test')
    expect(chip).toHaveClass('bg-accent')
    expect(chip).toHaveClass('text-ink')
    expect(chip).toHaveClass('border-accent')
  })

  it('applies muted text and rule border when inactive', () => {
    render(<Chip>test</Chip>)
    const chip = screen.getByText('test')
    expect(chip).toHaveClass('text-muted')
    expect(chip).toHaveClass('border-rule')
    expect(chip).not.toHaveClass('bg-accent')
  })
})
