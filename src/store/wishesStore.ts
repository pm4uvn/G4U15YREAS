import { create } from 'zustand'
import { addWish as addWishApi, fetchWishes as fetchWishesApi, type BirthdayWish } from '../lib/wishes'

interface WishesState {
  wishes: BirthdayWish[]
  loaded: boolean
  load: () => Promise<void>
  submit: (authorName: string, message: string) => Promise<void>
}

/** Shared across the cover: the ticker reads this list, the form appends to it on submit. */
export const useWishesStore = create<WishesState>((set, get) => ({
  wishes: [],
  loaded: false,
  load: async () => {
    if (get().loaded) return
    try {
      const wishes = await fetchWishesApi()
      set({ wishes, loaded: true })
    } catch (err) {
      console.warn('[g4u] could not load birthday wishes', err)
    }
  },
  submit: async (authorName, message) => {
    const wish = await addWishApi(authorName, message)
    set((s) => ({ wishes: [wish, ...s.wishes] }))
  },
}))
