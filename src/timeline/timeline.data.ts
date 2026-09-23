import type { YearEntry } from './timeline.types'

/**
 * Placeholder content for every year of the journey.
 * Replace title/subtitle/quote/media with real G4U content in a later phase —
 * the shape stays stable so Phase 2+ (Memory Viewer, Sonic Core sky) can consume it as-is.
 */
export const YEARS: YearEntry[] = [
  { year: 2011, title: 'The First Chord', subtitle: 'Where G4U began.', quote: 'A small room, a few guitars, one idea.', media: [] },
  { year: 2012, title: 'Finding Our Sound', subtitle: 'The early community takes shape.', quote: 'Every student became a story.', media: [] },
  { year: 2013, title: 'New Faces', subtitle: 'The circle widens.', quote: 'More hands on the fretboard.', media: [] },
  { year: 2014, title: 'First Stage', subtitle: 'From practice room to spotlight.', quote: 'The nerves before the first note.', media: [] },
  { year: 2015, title: 'Building Rhythm', subtitle: 'Momentum finds its groove.', quote: 'Consistency became our anthem.', media: [] },
  { year: 2016, title: 'A Growing Family', subtitle: 'More rooms, more music.', quote: 'Home got a little bigger.', media: [] },
  { year: 2017, title: 'On The Road', subtitle: 'Taking G4U beyond the walls.', quote: 'Music travels further than we thought.', media: [] },
  { year: 2018, title: 'A Year To Remember', subtitle: 'The year everything clicked.', quote: 'We finally sounded like us.', media: [] },
  { year: 2019, title: 'Louder Together', subtitle: 'Community becomes the instrument.', quote: 'One guitar, then a hundred.', media: [] },
  { year: 2020, title: 'Quiet Strings', subtitle: 'A pause, not a stop.', quote: 'We kept tuning, even from afar.', media: [] },
  { year: 2021, title: 'Back In Tune', subtitle: 'Finding each other again.', quote: 'The room finally felt full again.', media: [] },
  { year: 2022, title: 'New Chapters', subtitle: 'Fresh faces, familiar chords.', quote: 'Every ending is someone else’s first day.', media: [] },
  { year: 2023, title: 'Bigger Stages', subtitle: 'G4U steps into the spotlight.', quote: 'The applause got louder every year.', media: [] },
  { year: 2024, title: 'Passing It On', subtitle: 'Students become mentors.', quote: 'The next generation picked up the pick.', media: [] },
  { year: 2025, title: 'The Encore', subtitle: 'Fifteen years, almost here.', quote: 'One more song before the milestone.', media: [] },
  { year: 2026, title: 'One G4U', subtitle: 'Fifteen years of music, together.', quote: 'Every year has a song. Every memory has a story.', media: [] },
]

export const YEAR_COUNT = YEARS.length
export const FIRST_YEAR = YEARS[0].year
export const LAST_YEAR = YEARS[YEARS.length - 1].year
