import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateField from './DateField'

afterEach(cleanup)

describe('DateField', () => {
  it('opens the themed calendar and selects a date', async () => {
    const onChange = vi.fn()
    render(<DateField label="Started" value="2026-08-08" onChange={onChange} />)

    await userEvent.click(screen.getByRole('button', { name: 'Started date' }))
    expect(screen.getByRole('dialog', { name: 'Choose started date' })).not.toBeNull()
    await userEvent.click(screen.getByRole('gridcell', { name: /(?:12 August 2026|August 12, 2026)/ }))
    expect(onChange).toHaveBeenCalledWith('2026-08-12')
  })

  it('clears an optional date', async () => {
    const onChange = vi.fn()
    render(<DateField label="Completed" value="2026-08-08" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Completed date' }))
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
