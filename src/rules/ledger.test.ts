import { describe, expect, it } from 'vitest'
import { profileById } from '../data/profiles'
import { fingerprintSource } from '../domain/tax'
import { ledgerText } from './ledger'

const profile = profileById('deadline-payment')

/** Same Web Crypto path the browser ledger uses, so the test proves the real thing. */
async function sha256Short(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

async function fingerprintsFor(): Promise<Record<string, string>> {
  const entries = await Promise.all(
    profile.documents.map(
      async (document) =>
        [document.id, await sha256Short(fingerprintSource(document))] as const,
    ),
  )
  return Object.fromEntries(entries)
}

const GENERATED_AT = '2026-08-29T01:00:00+05:30'

describe('ledgerText', () => {
  it('names the build as an independent prototype', async () => {
    const text = ledgerText(profile, await fingerprintsFor(), GENERATED_AT)
    expect(text).toContain('Not a Government of India service')
  })

  it('lists every record on the profile', async () => {
    const text = ledgerText(profile, await fingerprintsFor(), GENERATED_AT)
    expect(text).toContain(`Records: ${profile.documents.length}`)
    for (const document of profile.documents) {
      expect(text).toContain(document.label)
    }
  })

  it('publishes the exact text each fingerprint was taken over', async () => {
    const text = ledgerText(profile, await fingerprintsFor(), GENERATED_AT)
    for (const document of profile.documents) {
      expect(text).toContain(fingerprintSource(document))
    }
  })

  it('lets a reader recompute every digest from the ledger alone', async () => {
    // Re-derives each hash the way an outside reader would, from the published
    // "Hashed text" line, and checks it against the printed digest.
    const text = ledgerText(profile, await fingerprintsFor(), GENERATED_AT)
    const rows = text.split('\n')
    const hashedLines = rows.filter((row) => row.includes('Hashed text :'))
    const digestLines = rows.filter((row) => row.includes('SHA-256     :'))

    expect(hashedLines).toHaveLength(profile.documents.length)
    expect(digestLines).toHaveLength(profile.documents.length)

    for (const [index, row] of hashedLines.entries()) {
      const source = row.split('Hashed text : ')[1]
      expect(digestLines[index]).toContain(await sha256Short(source))
    }
  })

  it('marks a record whose digest has not been computed yet', () => {
    const partial = ledgerText(profile, {}, GENERATED_AT)
    expect(partial).toContain('(not computed)')
  })
})
