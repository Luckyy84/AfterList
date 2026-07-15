import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import ThemeToggle from './ThemeToggle'

afterEach(() => { cleanup(); localStorage.clear(); delete document.documentElement.dataset.theme })

describe('ThemeToggle', () => {
  it('switches and remembers the theme', async () => {
    document.documentElement.dataset.theme = 'dark'
    render(<ThemeToggle />)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('afterlist-theme')).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark mode' })).not.toBeNull()
  })
})
