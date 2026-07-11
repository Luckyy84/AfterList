export const softSpring = { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 } as const
export const snappySpring = { type: 'spring', stiffness: 460, damping: 30, mass: 0.65 } as const

export const pageMotion = {
  initial: { opacity: 0, y: 14, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1 },
} as const
