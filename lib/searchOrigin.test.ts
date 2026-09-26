import type { View } from 'react-native'
import {
  clearSearchOrigin,
  measureWindowRect,
  readSearchOrigin,
  setSearchOrigin,
} from './searchOrigin'

const RECT = { x: 320, y: 52, width: 40, height: 40 }

// jest.setup.js clears the store before each test, the way it does the others.

it('holds nothing until a button stores its box', () => {
  expect(readSearchOrigin()).toBeNull()
})

it('returns the stored box on every read until it is cleared', () => {
  setSearchOrigin(RECT)

  // Two reads, on purpose: the search sheet reads in a state initialiser,
  // which React Strict Mode runs twice for one mount. A read that cleared
  // would hand the second run nothing.
  expect(readSearchOrigin()).toEqual(RECT)
  expect(readSearchOrigin()).toEqual(RECT)

  clearSearchOrigin()
  expect(readSearchOrigin()).toBeNull()
})

it('keeps only the last box', () => {
  setSearchOrigin(RECT)
  setSearchOrigin({ ...RECT, x: 12 })

  expect(readSearchOrigin()).toEqual({ ...RECT, x: 12 })
})

describe('measureWindowRect', () => {
  it('turns the callback answer into a box', async () => {
    const node = {
      measureInWindow: (callback: (x: number, y: number, w: number, h: number) => void) =>
        callback(RECT.x, RECT.y, RECT.width, RECT.height),
    } as unknown as View

    await expect(measureWindowRect(node)).resolves.toEqual(RECT)
  })

  // A ref that was never attached — the button is not on screen — must not
  // hang the press. The caller pushes the route with no box instead.
  it('resolves to null when there is no node', async () => {
    await expect(measureWindowRect(null)).resolves.toBeNull()
  })
})
