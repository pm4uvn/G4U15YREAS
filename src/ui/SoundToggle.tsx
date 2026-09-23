import { useExperienceStore } from '../store/experienceStore'
import { startAmbient, stopAmbient } from '../audio/ambientEngine'

export function SoundToggle() {
  const soundOn = useExperienceStore((s) => s.soundOn)
  const toggleSound = useExperienceStore((s) => s.toggleSound)

  // Starting/resuming the AudioContext must happen synchronously inside a
  // user-gesture handler for browser autoplay policies to allow it — so this
  // calls the audio engine directly here rather than reacting to state via
  // an effect a tick later.
  const handleClick = () => {
    const next = !soundOn
    toggleSound()
    if (next) startAmbient()
    else stopAmbient()
  }

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={handleClick}
      aria-pressed={soundOn}
    >
      <span className={`sound-toggle__dot ${soundOn ? 'is-on' : ''}`} aria-hidden="true" />
      Sound {soundOn ? 'On' : 'Off'}
    </button>
  )
}
