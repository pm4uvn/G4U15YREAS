import { create } from 'zustand'

interface ExperienceState {
  /** Prepared for Phase 2's ambient/year audio — no autoplay, user-controlled. */
  soundOn: boolean
  toggleSound: () => void

  webglSupported: boolean
  setWebglSupported: (supported: boolean) => void

  assetsReady: boolean
  setAssetsReady: (ready: boolean) => void

  /** Memory currently open in the fullscreen viewer. */
  memoryView: { year: number; memoryId: string } | null
  openMemory: (year: number, memoryId: string) => void
  closeMemory: () => void

  /** Year the "add a memory" form is open for. */
  addMemoryYear: number | null
  openAddMemory: (year: number) => void
  closeAddMemory: () => void
}

export const useExperienceStore = create<ExperienceState>((set) => ({
  soundOn: true,
  toggleSound: () => set((s) => ({ soundOn: !s.soundOn })),

  webglSupported: true,
  setWebglSupported: (webglSupported) => set({ webglSupported }),

  assetsReady: false,
  setAssetsReady: (assetsReady) => set({ assetsReady }),

  memoryView: null,
  openMemory: (year, memoryId) => set({ memoryView: { year, memoryId } }),
  closeMemory: () => set({ memoryView: null }),

  addMemoryYear: null,
  openAddMemory: (year) => set({ addMemoryYear: year }),
  closeAddMemory: () => set({ addMemoryYear: null }),
}))
