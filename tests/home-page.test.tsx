import './testEnvironment'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import HomePage from '../src/pages/HomePage'
import { mediaItems } from './fixtures'

describe('HomePage showcase', () => {
  it('lets the user choose a featured title', async () => {
    render(<HomePage items={mediaItems} onRemove={vi.fn()} onStatusChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Feature Second Feature' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second Feature', level: 1 })).toBeTruthy()
    })
  })

  it('exposes an explicit autoplay pause control', () => {
    render(<HomePage items={mediaItems} onRemove={vi.fn()} onStatusChange={vi.fn()} />)

    const pauseButton = screen.getByRole('button', { name: 'Pause showcase' })
    fireEvent.click(pauseButton)

    expect(screen.getByRole('button', { name: 'Resume showcase' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('shows a useful empty-library introduction', () => {
    render(<HomePage items={[]} onRemove={vi.fn()} onStatusChange={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Build a list worth coming back to.', level: 1 })).toBeTruthy()
    expect(screen.queryByText('Everything you saved')).toBeNull()
  })
})
