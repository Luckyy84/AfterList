import type { MouseEventHandler, ReactNode } from 'react'
import { NavLink } from 'react-router-dom'

type NavActionProps = {
  children: ReactNode
  label: string
  to?: string
  expanded?: boolean
  menu?: boolean
  onClick?: MouseEventHandler<HTMLButtonElement>
}

export default function NavAction({ children, expanded, label, menu, onClick, to }: NavActionProps) {
  if (to) {
    return <NavLink className="nav-action" to={to} aria-label={label} title={label}>{children}</NavLink>
  }

  return (
    <button className="nav-action" type="button" aria-label={label} aria-expanded={expanded} aria-haspopup={menu ? 'menu' : undefined} title={label} onClick={onClick}>
      {children}
    </button>
  )
}
