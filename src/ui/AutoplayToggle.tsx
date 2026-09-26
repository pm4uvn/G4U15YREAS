import { useExperienceStore } from '../store/experienceStore'

/** Starts/stops the guided tour — scrolling through every memory on its own. */
export function AutoplayToggle() {
  const autoplayOn = useExperienceStore((s) => s.autoplayOn)
  const setAutoplay = useExperienceStore((s) => s.setAutoplay)

  return (
    <button type="button" className="autoplay-toggle" onClick={() => setAutoplay(!autoplayOn)} aria-pressed={autoplayOn}>
      <span className={`autoplay-toggle__dot ${autoplayOn ? 'is-on' : ''}`} aria-hidden="true" />
      {autoplayOn ? 'Dừng tự động' : 'Tự động xem'}
    </button>
  )
}
