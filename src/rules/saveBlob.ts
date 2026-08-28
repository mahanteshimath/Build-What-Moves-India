/**
 * Saves a blob as a file download.
 *
 * The anchor must be in the document for Chromium to honour the click, and the
 * object URL must outlive it, or the download is silently dropped.
 */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
