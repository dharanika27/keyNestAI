import { useState, type FormEvent } from 'react'
import { estimatePasswordStrength } from '../lib/passwordStrength'
import { toUserMessage } from '../lib/errorMessages'

interface CreateVaultScreenProps {
  onCreate: (password: string) => Promise<void>
}

const MIN_MASTER_PASSWORD_LENGTH = 8

export function CreateVaultScreen({ onCreate }: CreateVaultScreenProps) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = estimatePasswordStrength(password)
  const mismatch = confirm.length > 0 && confirm !== password

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < MIN_MASTER_PASSWORD_LENGTH) {
      setError(`Master password must be at least ${MIN_MASTER_PASSWORD_LENGTH} characters.`)
      return
    }
    setBusy(true)
    try {
      await onCreate(password)
    } catch (err) {
      setError(toUserMessage(err))
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Welcome to KeyNest AI</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Create a master password to set up your encrypted vault on this device. Your vault works fully
          offline, and your master password is never stored or sent anywhere — if you lose it, this vault
          cannot be recovered.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="new-password" className="text-sm font-medium">
            Master password
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
          <p className="text-xs text-slate-500" aria-live="polite">
            Strength: {strength.replace('-', ' ')}
          </p>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-password" className="text-sm font-medium">
            Confirm master password
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            className="rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
          />
          {mismatch && <p className="text-xs text-red-600 dark:text-red-400">Passwords do not match yet.</p>}
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
          {busy ? 'Creating vault…' : 'Create vault'}
        </button>
      </form>
    </main>
  )
}
