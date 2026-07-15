import type { MediaStatus } from '../types/media'

const DEFAULT_STATUS_KEY = 'afterlist-default-status'
const REDUCED_MOTION_KEY = 'afterlist-reduced-motion'
const STICKY_HEADER_KEY = 'afterlist-sticky-header'
const statuses: MediaStatus[] = ['Planned', 'Watching', 'Watched', 'Dropped']

export function loadDefaultStatus(): MediaStatus {
  const value = localStorage.getItem(DEFAULT_STATUS_KEY)
  return statuses.includes(value as MediaStatus) ? value as MediaStatus : 'Planned'
}

export function saveDefaultStatus(status: MediaStatus) {
  localStorage.setItem(DEFAULT_STATUS_KEY, status)
}

export function loadReducedMotion() {
  return localStorage.getItem(REDUCED_MOTION_KEY) === 'true'
}

export function saveReducedMotion(reduced: boolean) {
  localStorage.setItem(REDUCED_MOTION_KEY, String(reduced))
}

export function loadStickyHeader() {
  return localStorage.getItem(STICKY_HEADER_KEY) !== 'false'
}

export function saveStickyHeader(sticky: boolean) {
  localStorage.setItem(STICKY_HEADER_KEY, String(sticky))
}
