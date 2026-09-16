import AsyncStorage from '@react-native-async-storage/async-storage'
import { useSyncExternalStore } from 'react'
import type { Movie } from './types'

/**
 * The films the reader saved, held in memory and written to the device.
 *
 * A module-level store rather than a context, for the reason lib/useResource.ts
 * uses one: the app has no provider tree to hang it on, and every screen that
 * reads it wants the same list. `useSyncExternalStore` is what keeps React in
 * step with it.
 *
 * The whole `Movie` is stored, not the id. A saved film must draw in the grid
 * with no request behind it, and a list of ids would need one request per card
 * before the screen could show anything.
 */

/**
 * Versioned, so a later change to the stored shape can be ignored rather than
 * parsed. `parseStored` below drops anything it does not recognise, and a new
 * key would leave the old one on the device forever.
 */
export const STORAGE_KEY = 'reelist.watchlist.v1'

let movies: Movie[] = []
const listeners = new Set<() => void>()

/**
 * Whether the device copy was read, and whether anything was saved since the
 * app started.
 *
 * `loaded` is what the watchlist screen waits for: without it an empty list and
 * an unread list look the same, and the screen would show "Nothing saved yet"
 * for a moment on every launch.
 *
 * `touched` closes the race between that read and a fast reader. A film saved
 * before the read finishes must not be replaced by the copy the read returns.
 */
let loaded = false
let touched = false

const emit = () => {
  for (const listener of listeners) listener()
}

/**
 * Turns a stored string back into a list of films.
 *
 * The device copy is not trusted input. It can be a half-written string from a
 * process the system killed, or a value from an older shape of this app. A film
 * without an id would reach FlatList as a child with no key, so the check is
 * what the grid depends on rather than a formality.
 */
export function parseStored(raw: string | null): Movie[] {
  if (!raw) return []

  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is Movie =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Movie).id === 'number',
    )
  } catch {
    // A string that is not JSON. There is nothing to recover and nothing to
    // report: the reader sees an empty watchlist, and the next save rewrites it.
    return []
  }
}

const persist = () => {
  // The device write is not awaited and its failure is not reported. The list
  // the reader sees is the one in memory, which is already correct; a full disk
  // or a browser with storage blocked costs them the list on the next launch,
  // and there is no action a message could offer for that.
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(movies)).catch(() => {})
}

/**
 * Reads the device copy, once.
 *
 * Started by the first subscriber rather than at import time, so a test or a
 * screen that never touches the watchlist never reads the device.
 */
const hydrate = async () => {
  let raw: string | null = null
  try {
    raw = await AsyncStorage.getItem(STORAGE_KEY)
  } catch {
    // Unreadable storage is an empty watchlist. The app stays usable, and the
    // first save overwrites whatever is there.
  }

  loaded = true

  // A film saved while this read was in flight outranks the stored copy: it is
  // newer, and `persist` already wrote it.
  if (!touched) movies = parseStored(raw)

  emit()
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  if (!loaded && listeners.size === 1) void hydrate()
  return () => {
    listeners.delete(listener)
  }
}

const getMovies = () => movies
const getLoaded = () => loaded

/**
 * The `Movie` fields, and nothing else.
 *
 * The detail screen saves a `MovieDetail`, which carries the billed cast, the
 * videos, and twenty recommended films beside the seven fields a card draws.
 * Storing that would put a film's whole detail response on the device for every
 * save, so the narrowing happens here rather than at the call site, where a
 * later caller could forget it.
 */
const toSaved = (movie: Movie): Movie => ({
  id: movie.id,
  title: movie.title,
  poster_path: movie.poster_path,
  backdrop_path: movie.backdrop_path,
  vote_average: movie.vote_average,
  release_date: movie.release_date,
  overview: movie.overview,
})

/** Whether `id` is in `saved`. */
export const isSaved = (saved: Movie[], id: number): boolean =>
  saved.some((m) => m.id === id)

/**
 * Adds the film, or removes it when it is already saved.
 *
 * The newest save goes to the front. A watchlist is read from the top, and the
 * film the reader just chose is the one they are most likely to want next.
 */
export function toggleSaved(movie: Movie): void {
  touched = true
  movies = isSaved(movies, movie.id)
    ? movies.filter((m) => m.id !== movie.id)
    : [toSaved(movie), ...movies]
  persist()
  emit()
}

/** Empties the list, on the device as well. */
export function clearWatchlist(): void {
  touched = true
  movies = []
  persist()
  emit()
}

/**
 * The saved films, and whether the device copy was read yet.
 *
 * `useSyncExternalStore` is called twice rather than returning one object,
 * because it compares snapshots by identity: a fresh `{ movies, loaded }` on
 * every render would never be equal to the last one and would loop.
 */
export function useWatchlist(): { movies: Movie[]; loaded: boolean } {
  return {
    movies: useSyncExternalStore(subscribe, getMovies, getMovies),
    loaded: useSyncExternalStore(subscribe, getLoaded, getLoaded),
  }
}

/**
 * Puts the store back to its start state, for a test.
 *
 * The store lives as long as the process, and a Jest module registry is shared
 * by every test in a file. jest.setup.js calls this before each one.
 */
export function resetWatchlist(): void {
  movies = []
  loaded = false
  touched = false
  listeners.clear()
}
