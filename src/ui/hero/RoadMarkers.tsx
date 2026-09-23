import type { CSSProperties } from 'react'
import { useJourneyLayout } from '../../timeline/journey'
import { YEARS } from '../../timeline/timeline.data'
import { HERO_MILESTONES } from './heroAssets'
import { isSupabaseConfigured } from '../../lib/supabase'

function storiesLabel(n: number | undefined) {
  if (n === undefined) return null
  return n === 0 ? 'BE THE FIRST' : `${n} ${n === 1 ? 'STORY' : 'STORIES'}`
}

interface RoadMarkersProps {
  onSelect: (yearIndex: number) => void
}

/** Milestone years placed on the road (percent of the stage). Hover/focus shows a small preview. */
export function RoadMarkers({ onSelect }: RoadMarkersProps) {
  // Story counts come from the shared journey layout (measured once, refreshed when memories are added).
  const layout = useJourneyLayout()
  const counts = isSupabaseConfigured ? layout.counts : null

  return (
    <ul className="road-markers" aria-label="Milestones on the journey">
      {HERO_MILESTONES.map((m) => {
        const index = YEARS.findIndex((y) => y.year === m.year)
        const entry = YEARS[index]
        const label = storiesLabel(counts?.[m.year])
        return (
          <li
            key={m.year}
            className="road-marker"
            style={{ left: `${m.x}%`, top: `${m.y}%`, ['--stem' as string]: `${m.stem}cqh` } as CSSProperties}
          >
            <button
              type="button"
              className="road-marker__button"
              onClick={() => onSelect(index)}
              aria-label={`${m.year}${label ? `, ${label.toLowerCase()}` : ''}. Go to ${m.year}`}
            >
              <span className="road-marker__year">{m.year}</span>
              <span className="road-marker__stem" aria-hidden="true" />
              <span className="road-marker__dot" aria-hidden="true" />
            </button>
            <span className="road-marker__preview" role="tooltip">
              <strong>{m.year}</strong>
              {label && <em>{label}</em>}
              <span>{entry?.quote}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
