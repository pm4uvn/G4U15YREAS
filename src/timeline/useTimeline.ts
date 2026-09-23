import { useTimelineStore, scrollToYearIndex } from './TimelineController'
import { YEARS, YEAR_COUNT } from './timeline.data'

/**
 * Reactive convenience hook for HTML/UI components. Only re-renders when
 * activeYearIndex or hasEntered actually change — never on every scroll frame.
 */
export function useTimeline() {
  const activeYearIndex = useTimelineStore((s) => s.activeYearIndex)
  const hasEntered = useTimelineStore((s) => s.hasEntered)

  return {
    activeYearIndex,
    activeYear: YEARS[activeYearIndex],
    years: YEARS,
    yearCount: YEAR_COUNT,
    hasEntered,
    goToYearIndex: scrollToYearIndex,
  }
}
