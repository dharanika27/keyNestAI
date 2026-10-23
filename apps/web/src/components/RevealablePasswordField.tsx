import { useEffect, useId, useRef, useState } from 'react'

interface RevealablePasswordFieldProps {
  label: string
  value: string
}

const CLIPBOARD_CLEAR_DELAY_MS = 20_000

/**
 * Hidden by default; revealing and copying are both explicit user actions
 * (CLAUDE.md §5.6). Clipboard clearing is best-effort only — it is not
 * guaranteed to succeed on every browser/platform, and is skipped if the
 * clipboard no longer contains the value this component copied. Closing
 * or navigating away from this field before the delay elapses (e.g.
 * closing the record-detail dialog) does not cancel the clear — it
 * triggers it immediately instead, so a copied secret never ends up
 * parked in the clipboard indefinitely just because the component
 * unmounted first.
 */
export function RevealablePasswordField({ label, value }: RevealablePasswordFieldProps) {
  const [revealed, setRevealed] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'unsupported'>('idle')
  const clearTimerRef = useRef<number | null>(null)
  // Tracks exactly what this component last copied, independent of the
  // current `value` prop — the clipboard should only ever be cleared
  // because of what *this component put there*, never compared against a
  // possibly-changed prop.
  const copiedValueRef = useRef<string | null>(null)
  const inputId = useId()

  async function clearClipboardIfStillCopied() {
    const copiedValue = copiedValueRef.current
    if (copiedValue === null) return
    copiedValueRef.current = null
    try {
      const current = await navigator.clipboard.readText()
      if (current === copiedValue) {
        await navigator.clipboard.writeText('')
      }
    } catch {
      // Reading the clipboard back can fail (permissions, lost focus) —
      // this was always best-effort, never guaranteed.
    }
  }

  useEffect(() => {
    return () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current)
        clearTimerRef.current = null
        void clearClipboardIfStillCopied()
      }
    }
    // Intentionally mount/unmount-only: clearClipboardIfStillCopied only
    // ever reads refs, never a prop/state value that could go stale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCopy() {
    try {
      if (!navigator.clipboard) {
        setCopyStatus('unsupported')
        return
      }
      await navigator.clipboard.writeText(value)
      copiedValueRef.current = value
      setCopyStatus('copied')
      if (clearTimerRef.current !== null) window.clearTimeout(clearTimerRef.current)
      clearTimerRef.current = window.setTimeout(() => {
        clearTimerRef.current = null
        void clearClipboardIfStillCopied()
      }, CLIPBOARD_CLEAR_DELAY_MS)
    } catch {
      setCopyStatus('unsupported')
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={inputId}
          type={revealed ? 'text' : 'password'}
          value={value}
          readOnly
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800"
        />
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          aria-pressed={revealed}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          {revealed ? 'Hide' : 'Reveal'}
        </button>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          Copy
        </button>
      </div>
      <p className="min-h-4 text-xs text-slate-500" role="status" aria-live="polite">
        {copyStatus === 'copied' && 'Copied — the clipboard will be cleared automatically where supported.'}
        {copyStatus === 'unsupported' && 'Clipboard access is not available in this browser.'}
      </p>
    </div>
  )
}
