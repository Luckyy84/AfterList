import { useEffect, useMemo, useRef, useState } from 'react'

type DateFieldProps = {
  label: string
  value?: string | null
  min?: string
  max?: string
  onChange: (value: string | null) => void
}

const weekdays = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const displayDateFormatter = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
const monthFormatter = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' })
const longDateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: 'long' })

function parseDate(value?: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return Number.isNaN(date.getTime()) ? null : date
}

function toDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function displayDate(value?: string | null) {
  const date = parseDate(value)
  return date ? displayDateFormatter.format(date) : 'Choose a date'
}

export default function DateField({ label, value, min, max, onChange }: DateFieldProps) {
  const selectedDate = parseDate(value)
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => selectedDate ?? new Date())
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return undefined
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsideClick)
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick)
  }, [isOpen])

  const calendarDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => new Date(year, month, index - firstWeekday + 1))
  }, [viewDate])

  const chooseDate = (date: Date) => {
    onChange(toDateValue(date))
    setIsOpen(false)
  }
  const today = new Date()
  const todayValue = toDateValue(today)
  const todayDisabled = Boolean((min && todayValue < min) || (max && todayValue > max))

  return (
    <div className="date-field" ref={rootRef} onKeyDown={(event) => { if (event.key === 'Escape') setIsOpen(false) }}>
      <span className="details-section-label">{label}</span>
      <button className="date-field-trigger" type="button" aria-label={`${label} date`} aria-haspopup="dialog" aria-expanded={isOpen} onClick={() => {
        if (!isOpen) setViewDate(parseDate(value) ?? new Date())
        setIsOpen((open) => !open)
      }}>
        <span className={value ? '' : 'is-placeholder'}>{displayDate(value)}</span>
        <span className="date-field-icon" aria-hidden="true">▣</span>
      </button>
      {isOpen && (
        <div className="date-calendar" role="dialog" aria-label={`Choose ${label.toLowerCase()} date`}>
          <div className="date-calendar-head">
            <strong>{monthFormatter.format(viewDate)}</strong>
            <div>
              <button type="button" aria-label="Previous month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}>←</button>
              <button type="button" aria-label="Next month" onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}>→</button>
            </div>
          </div>
          <div className="date-calendar-weekdays" aria-hidden="true">{weekdays.map((day) => <span key={day}>{day}</span>)}</div>
          <div className="date-calendar-grid" role="grid">
            {calendarDays.map((date) => {
              const dateValue = toDateValue(date)
              const disabled = Boolean((min && dateValue < min) || (max && dateValue > max))
              const outsideMonth = date.getMonth() !== viewDate.getMonth()
              return (
                <button type="button" role="gridcell" key={dateValue} className={`${outsideMonth ? 'is-outside ' : ''}${dateValue === value ? 'is-selected ' : ''}${dateValue === todayValue ? 'is-today' : ''}`} aria-label={longDateFormatter.format(date)} aria-selected={dateValue === value} disabled={disabled} onClick={() => chooseDate(date)}>{date.getDate()}</button>
              )
            })}
          </div>
          <div className="date-calendar-actions">
            <button type="button" disabled={!value} onClick={() => { onChange(null); setIsOpen(false) }}>Clear</button>
            <button type="button" disabled={todayDisabled} onClick={() => chooseDate(today)}>Today</button>
          </div>
        </div>
      )}
    </div>
  )
}
