import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { softSpring } from '../../motion'

export type SelectOption = { value: string; label: string }

type CustomSelectProps = {
  ariaLabel: string
  value: string
  options: readonly SelectOption[]
  onChange: (value: string) => void
}

export default function CustomSelect({ ariaLabel, value, options, onChange }: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const choose = (index: number) => {
    onChange(options[index].value)
    setOpen(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setActiveIndex(selectedIndex)
      setOpen(true)
      return
    }
    if (!open) return

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index) => (index + direction + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(activeIndex)
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <div className="custom-select" ref={rootRef}>
      <button type="button" className="custom-select-trigger" aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined} onClick={() => { setActiveIndex(selectedIndex); setOpen((current) => !current) }} onKeyDown={handleKeyDown}>
        <span>{options[selectedIndex]?.label}</span>
        <span className={`custom-select-chevron${open ? ' is-open' : ''}`} aria-hidden="true">⌄</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul id={listId} className="custom-select-menu" role="listbox" aria-label={ariaLabel} initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={softSpring}>
            {options.map((option, index) => (
              <li id={`${listId}-${index}`} key={option.value} role="option" aria-selected={option.value === value} className={`${index === activeIndex ? 'is-active' : ''}${option.value === value ? ' is-selected' : ''}`} onMouseEnter={() => setActiveIndex(index)} onClick={() => choose(index)}>
                <span>{option.label}</span><span aria-hidden="true">{option.value === value ? '✓' : ''}</span>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}
