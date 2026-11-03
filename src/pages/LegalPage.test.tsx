import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import LegalPage from './LegalPage'
afterEach(() => { cleanup(); vi.unstubAllEnvs() })
it('does not ship optional analytics even in production', () => {
 expect(readFileSync('src/App.tsx', 'utf8')).not.toMatch(/Analytics|@vercel\/analytics/)
})
it('provides an honest unset controller state and privacy rights', () => {
 render(<MemoryRouter><LegalPage type="privacy" /></MemoryRouter>)
 expect(screen.getByText(/Controller information is not configured/)).toBeTruthy()
 expect(screen.getByText(/supervisory authority/)).toBeTruthy()
 expect(screen.queryByRole('link', { name: /GitHub/ })).toBeNull()
})
it('renders only explicitly configured public operator details', () => {
 vi.stubEnv('VITE_LEGAL_OPERATOR_NAME', 'Example Test Operator')
 vi.stubEnv('VITE_LEGAL_CONTACT_EMAIL', 'privacy@example.test')
 render(<MemoryRouter><LegalPage type="privacy" /></MemoryRouter>)
 expect(screen.getByText('Example Test Operator')).toBeTruthy()
 expect(screen.getByRole('link', { name: 'privacy@example.test' }).getAttribute('href')).toBe('mailto:privacy@example.test')
})
