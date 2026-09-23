import { create } from 'zustand'

interface ExperienceState {
  /** Prepared for Phase 2's ambient/year audio — no autoplay, user-controlled. */
  soundOn: boolean
  toggleSound: () => void

  webglSupported: boolean
  setWebglSupported: (supported: boolean) => void

  assetsReady: boolean
  setAssetsReady: (ready: boolean) => void
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  soundOn: false,
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  webglSupported: true,
  setWebglSupported: (webglSupported) => set({ webglSupported }),

  assetsReady: false,
  setAssetsReady: (assetsReady) => set({ assetsReady }),
}))
