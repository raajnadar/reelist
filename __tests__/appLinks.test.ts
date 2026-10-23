import app from '../app.json'
import { SITE_URL } from '../lib/site'
import assetLinks from '../public/.well-known/assetlinks.json'

// Android checks the App Link when the app is installed. A wrong value fails
// that check with no error, and each shared link then opens in the browser.
const [link] = assetLinks
const [filter] = app.expo.android.intentFilters

it('names the Android package in assetlinks.json', () => {
  expect(link.target.package_name).toBe(app.expo.android.package)
})

it('holds only SHA-256 fingerprints in assetlinks.json', () => {
  for (const fingerprint of link.target.sha256_cert_fingerprints) {
    expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/)
  }
})

it('opens the host of the shared links in the app', () => {
  expect(filter.autoVerify).toBe(true)
  expect(filter.data.map((d) => `${d.scheme}://${d.host}`)).toEqual([SITE_URL])
})
