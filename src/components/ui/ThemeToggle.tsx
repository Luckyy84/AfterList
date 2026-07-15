import { useState } from 'react'

type Theme = 'dark' | 'light'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  const nextTheme = theme === 'dark' ? 'light' : 'dark'

  const toggle = () => {
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'light' ? '#eee9df' : '#050608')
    try { localStorage.setItem('afterlist-theme', nextTheme) } catch { /* Theme still works for this visit. */ }
    setTheme(nextTheme)
  }

  return <button className="theme-toggle" type="button" aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`} onClick={toggle}><span aria-hidden="true">{nextTheme === 'light' ? '☀' : '☾'}</span></button>
}
