import { useState, type FormEvent } from 'react'
import { toUserMessage } from '../lib/errorMessages'

interface UnlockScreenProps {
  onUnlock: (password: string) => Promise<void>
  onForget: () => void
}

export function UnlockScreen({ onUnlock, onForget }: UnlockScreenProps) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onUnlock(password)
    } catch (err) {
      setError(toUserMessage(err))
    } finally {
      setBusy(false)
      setPassword('')
    }
  }

  function handleForget() {
    const confirmed = window.confirm(
      "This removes this vault from this device's list. The encrypted data itself is not deleted. Continue?",
    )
    if (confirmed) onForget()
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Unlock your vault</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Enter your master password to continue. KeyNest AI never stores or transmits this password.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="unlock-password" className="text-sm font-medium">
            Master password
          </label>
          <input
            id="unlock-password"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {busy ? 'Unlocking…' : 'Unlock'}
        </button>
      </form>

      <button type="button" onClick={handleForget} className="self-center text-xs text-slate-500 underline">
        This isn't my vault / start over on this device
      </button>
    </main>
  )
}
