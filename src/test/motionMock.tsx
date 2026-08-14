/* eslint-disable react-refresh/only-export-components */
import { createElement, type PropsWithChildren, type ReactNode } from 'react'

const motionOnlyProps = new Set(['animate', 'exit', 'initial', 'layout', 'layoutId', 'transition', 'whileHover', 'whileTap'])
type MockProps = PropsWithChildren<Record<string, unknown>>

function motionElement(tag: string) {
  return function MockMotionElement({ children, ...props }: MockProps) {
    const domProps = Object.fromEntries(Object.entries(props).filter(([key]) => !motionOnlyProps.has(key)))
    return createElement(tag, domProps, children as ReactNode)
  }
}

export const motion = new Proxy({} as Record<string, ReturnType<typeof motionElement>>, {
  get: (target, tag: string) => target[tag] ??= motionElement(tag),
})

export function AnimatePresence({ children }: PropsWithChildren) { return children }
export function LayoutGroup({ children }: PropsWithChildren) { return children }
export function MotionConfig({ children }: PropsWithChildren) { return children }
export function useReducedMotion() { return true }
