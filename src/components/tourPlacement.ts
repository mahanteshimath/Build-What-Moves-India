export interface Box {
  top: number
  left: number
  width: number
  height: number
}

/**
 * Below the target, else above it, else pinned to the foot — a target taller than the
 * viewport leaves no room on either side, and an unclamped card lands off screen.
 */
export function placeCard(
  target: Box | null,
  card: { width: number; height: number },
  view: { width: number; height: number },
): { left: number; top: number } {
  const left = target
    ? Math.max(
        16,
        Math.min(target.left + target.width / 2 - card.width / 2, view.width - card.width - 16),
      )
    : Math.max(16, (view.width - card.width) / 2)

  let top = target ? target.top + target.height + 14 : (view.height - card.height) / 2
  if (target && top + card.height > view.height - 12) top = target.top - 14 - card.height
  if (top < 12) top = Math.max(12, view.height - card.height - 12)

  return { left, top }
}
