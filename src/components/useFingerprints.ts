import { useEffect, useState } from 'react'
import type { TaxDocument } from '../domain/tax'
import { fingerprintSource } from '../domain/tax'

/** Hashes each record in the browser so the ledger shows a real fingerprint. */
export function useFingerprints(documents: TaxDocument[]): Record<string, string> {
  const [prints, setPrints] = useState<Record<string, string>>({})

  useEffect(() => {
    let cancelled = false
    const encoder = new TextEncoder()

    Promise.all(
      documents.map(async (document) => {
        const digest = await crypto.subtle.digest(
          'SHA-256',
          encoder.encode(fingerprintSource(document)),
        )
        const hex = [...new Uint8Array(digest)]
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
        return [document.id, hex.slice(0, 16)] as const
      }),
    ).then((entries) => {
      if (!cancelled) setPrints(Object.fromEntries(entries))
    })

    return () => {
      cancelled = true
    }
  }, [documents])

  return prints
}
