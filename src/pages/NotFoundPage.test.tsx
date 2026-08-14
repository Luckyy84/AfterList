import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import NotFoundPage from './NotFoundPage'

vi.mock('motion/react', async () => import('../test/motionMock'))

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
})

describe('NotFoundPage', () => {
  it('offers useful recovery actions and marks the route noindex', async () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'This story isn’t on the list.' })).not.toBeNull()
    expect(screen.getByRole('link', { name: 'Go home' }).getAttribute('href')).toBe('/')
    expect(screen.getByRole('link', { name: 'Discover titles' }).getAttribute('href')).toBe('/discover')
    await waitFor(() => expect(document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.content).toBe('noindex, nofollow'))
  })
})
