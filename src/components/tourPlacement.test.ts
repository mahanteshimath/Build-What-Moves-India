import { describe, expect, it } from 'vitest'
import { placeCard } from './tourPlacement'

const view = { width: 1000, height: 800 }
const card = { width: 400, height: 280 }

function fits(placed: { left: number; top: number }) {
  return (
    placed.top >= 0 &&
    placed.top + card.height <= view.height &&
    placed.left >= 0 &&
    placed.left + card.width <= view.width
  )
}

describe('placeCard', () => {
  it('sits below a short target and centres on it', () => {
    const placed = placeCard({ top: 100, left: 400, width: 200, height: 60 }, card, view)
    expect(placed.top).toBe(174)
    expect(placed.left).toBe(300)
    expect(fits(placed)).toBe(true)
  })

  it('flips above a target near the foot of the viewport', () => {
    const placed = placeCard({ top: 640, left: 100, width: 200, height: 100 }, card, view)
    expect(placed.top).toBe(346)
    expect(fits(placed)).toBe(true)
  })

  it('stays on screen for a target taller than the viewport', () => {
    const placed = placeCard({ top: -200, left: 20, width: 960, height: 1200 }, card, view)
    expect(fits(placed)).toBe(true)
  })

  it('keeps a card clear of the left and right edges', () => {
    expect(placeCard({ top: 10, left: -300, width: 100, height: 40 }, card, view).left).toBe(16)
    expect(placeCard({ top: 10, left: 980, width: 100, height: 40 }, card, view).left).toBe(584)
  })

  it('centres when no target was found', () => {
    const placed = placeCard(null, card, view)
    expect(placed).toEqual({ left: 300, top: 260 })
    expect(fits(placed)).toBe(true)
  })
})
