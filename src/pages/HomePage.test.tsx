import '@testing-library/jest-dom/vitest'
import { test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HomePage from './HomePage'

test('opens and closes a details popup when a media card is clicked', async () => {
  const user = userEvent.setup()

  render(<HomePage />)

  await user.click(screen.getByRole('button', { name: /open details for jujutsu kaisen/i }))

  expect(screen.getByRole('dialog', { name: /jujutsu kaisen/i })).toBeInTheDocument()
  expect(screen.getByText(/supernatural action anime/i)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /close details/i }))

  expect(screen.queryByRole('dialog', { name: /jujutsu kaisen/i })).not.toBeInTheDocument()
})
