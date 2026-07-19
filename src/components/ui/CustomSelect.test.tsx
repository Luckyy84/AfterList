import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import CustomSelect from './CustomSelect'

afterEach(cleanup)

describe('CustomSelect', () => {
  it('supports pointer and keyboard selection', async () => {
    const onChange = vi.fn()
    const options = ['All genres', 'Action', 'Animation'].map((label, value) => ({ value: String(value), label }))
    render(<CustomSelect ariaLabel="Genre" value="0" options={options} onChange={onChange} />)

    const trigger = screen.getByRole('button', { name: 'Genre' })
    await userEvent.click(trigger)
    await userEvent.click(screen.getByRole('option', { name: 'Animation' }))
    expect(onChange).toHaveBeenCalledWith('2')

    trigger.focus()
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('1')
  })
})
