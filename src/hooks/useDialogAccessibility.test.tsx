import { useRef, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useDialogAccessibility } from './useDialogAccessibility'

function DialogHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const dialogRef = useDialogAccessibility({ isOpen, onClose: () => setIsOpen(false) })

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>Open dialog</button>
      {isOpen && (
        <section ref={dialogRef} role="dialog" tabIndex={-1}>
          <button type="button">First action</button>
          <button type="button">Last action</button>
        </section>
      )}
    </>
  )
}

function ReplacedOpenerHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const fallbackRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useDialogAccessibility({
    isOpen,
    onClose: () => setIsOpen(false),
    restoreFocusRef: fallbackRef,
  })

  return (
    <>
      <button ref={fallbackRef} type="button">Search</button>
      {!isOpen && <button type="button" onClick={() => setIsOpen(true)}>Open saved details</button>}
      {isOpen && (
        <section ref={dialogRef} role="dialog" tabIndex={-1}>
          <button type="button">Close target</button>
        </section>
      )}
    </>
  )
}

function LateFallbackHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const [showFallback, setShowFallback] = useState(false)
  const fallbackRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useDialogAccessibility({
    isOpen,
    onClose: () => setIsOpen(false),
    restoreFocusRef: fallbackRef,
  })

  return (
    <>
      {!showFallback && <button type="button" onClick={() => setIsOpen(true)}>Open late fallback dialog</button>}
      {showFallback && <button ref={fallbackRef} type="button">Remounted search</button>}
      {isOpen && (
        <section ref={dialogRef} role="dialog" tabIndex={-1}>
          <button type="button" onClick={() => setShowFallback(true)}>Mount fallback</button>
        </section>
      )}
    </>
  )
}

describe('useDialogAccessibility', () => {
  it('manages focus, keyboard dismissal, and body scroll while open', async () => {
    const user = userEvent.setup()
    render(<DialogHarness />)

    const opener = screen.getByRole('button', { name: 'Open dialog' })
    await user.click(opener)

    const firstAction = screen.getByRole('button', { name: 'First action' })
    const lastAction = screen.getByRole('button', { name: 'Last action' })
    await waitFor(() => expect(document.activeElement).toBe(firstAction))
    expect(document.body.style.overflow).toBe('hidden')

    lastAction.focus()
    await user.tab()
    expect(document.activeElement).toBe(firstAction)

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)
    expect(document.body.style.overflow).toBe('')
  })

  it('restores focus to a fallback when the original opener is removed', async () => {
    const user = userEvent.setup()
    render(<ReplacedOpenerHarness />)

    await user.click(screen.getByRole('button', { name: 'Open saved details' }))
    await user.keyboard('{Escape}')

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Search' }))
  })

  it('resolves a fallback that remounts after the dialog opens', async () => {
    const user = userEvent.setup()
    render(<LateFallbackHarness />)

    await user.click(screen.getByRole('button', { name: 'Open late fallback dialog' }))
    await user.click(screen.getByRole('button', { name: 'Mount fallback' }))
    await user.keyboard('{Escape}')

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remounted search' }))
  })
})
