import { centredLinesFor } from './centredLines'

it('drops the letter spacing on Android, where it cuts the last line', () => {
  expect(centredLinesFor('android')).toEqual({ textAlign: 'center', letterSpacing: 0 })
})

it('keeps the type scale spacing on iOS and the web', () => {
  expect(centredLinesFor('ios')).toEqual({ textAlign: 'center' })
  expect(centredLinesFor('web')).toEqual({ textAlign: 'center' })
})
