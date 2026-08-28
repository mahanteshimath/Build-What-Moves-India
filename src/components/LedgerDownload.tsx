import { DownloadCloud } from 'lucide-react'
import type { TaxProfile } from '../domain/tax'
import { ledgerText } from '../rules/ledger'
import { saveBlob } from '../rules/saveBlob'

/** Saves the ledger as text so a third party can re-hash and check it. */
export function LedgerDownload({
  profile,
  fingerprints,
}: {
  profile: TaxProfile
  fingerprints: Record<string, string>
}) {
  const download = () => {
    const text = ledgerText(profile, fingerprints, new Date().toISOString())
    saveBlob(new Blob([text], { type: 'text/plain' }), `sakshya-ledger-${profile.id}.txt`)
  }

  if (profile.documents.length === 0) return null

  return (
    <button type="button" className="button button--quiet button--sm no-print" onClick={download}>
      <DownloadCloud aria-hidden size={14} />
      <span>Download the ledger as text</span>
    </button>
  )
}
