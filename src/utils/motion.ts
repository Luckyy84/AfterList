export const motionEase = [0.22, 1, 0.36, 1] as const

export const controlSpring = {
  type: 'spring',
  stiffness: 520,
  damping: 30,
  mass: 0.62,
} as const

export const cardSpring = {
  type: 'spring',
  stiffness: 360,
  damping: 26,
  mass: 0.78,
} as const

export const panelSpring = {
  type: 'spring',
  stiffness: 250,
  damping: 28,
  mass: 0.92,
} as const

export const reducedTransition = { duration: 0.01 } as const
