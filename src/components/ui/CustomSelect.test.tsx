import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomSelect from './CustomSelect'

afterEach(cleanup)

describe('CustomSelect', () => {
  it('supports pointer and keyboard selection', async () => {
    const onChange = vi.fn()
    const options = ['Planned', 'Watching', 'Watched'].map((value) => ({ value, label: value }))
    render(<CustomSelect ariaLabel="Status" value="Planned" options={options} onChange={onChange} />)

    const trigger = screen.getByRole('button', { name: 'Status' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('option', { name: 'Watched' }))
    expect(onChange).toHaveBeenCalledWith('Watched')

    trigger.focus()
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{ArrowDown}')
    await userEvent.keyboard('{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('Watching')
  })
})
