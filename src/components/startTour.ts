export const TOUR_EVENT = 'sakshya:start-tour'

/** Any surface can open the walkthrough without threading a callback through the routes. */
export function startTour() {
  window.dispatchEvent(new Event(TOUR_EVENT))
}
