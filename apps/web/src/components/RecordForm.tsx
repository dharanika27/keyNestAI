import { useId, useState, type FormEvent } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { VaultRecord, VaultRecordInput } from '@keynest/shared'
import { PasswordGeneratorPanel } from './PasswordGeneratorPanel'

interface RecordFormProps {
  open: boolean
  /** Present when editing an existing record; absent when adding one. */
  initial?: VaultRecord
  busy: boolean
  error: string | null
  onSubmit: (input: VaultRecordInput) => void
  onClose: () => void
}

export function RecordForm({ open, initial, busy, error, onSubmit, onClose }: RecordFormProps) {
  const titleId = useId()

  const [title, setTitle] = useState(initial?.title ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState(initial?.password ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [showGenerator, setShowGenerator] = useState(false)

  // Radix keeps this component mounted between opens, so local form state
  // must be re-seeded every time the dialog transitions from closed to
  // open — not only when the *identified target* changes. Two consecutive
  // "add a new record" operations both have no `initial`, so keying the
  // reset off "which record" alone would miss the second one and leave
  // the first record's typed text in the fields. This is React's
  // documented pattern for resetting state during render, keyed on the
  // open/closed transition instead, which avoids an effect-based reset
  // that would flash stale values for a frame.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTitle(initial?.title ?? '')
      setUsername(initial?.username ?? '')
      setPassword(initial?.password ?? '')
      setUrl(initial?.url ?? '')
      setNotes(initial?.notes ?? '')
      setCategory(initial?.category ?? '')
      setShowGenerator(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      title,
      username: username || undefined,
      password,
      url: url || undefined,
      notes: notes || undefined,
      category: category || undefined,
    })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 max-h-[90vh] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
          aria-labelledby={titleId}
        >
          <Dialog.Title id={titleId} className="text-lg font-semibold">
            {initial ? 'Edit login' : 'Add login'}
          </Dialog.Title>

          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <Field label="Title" required value={title} onChange={setTitle} />
            <Field label="Username" value={username} onChange={setUsername} />
            <Field label="Password" value={password} onChange={setPassword} type="password" required />

            <button
              type="button"
              onClick={() => setShowGenerator((v) => !v)}
              className="self-start text-sm text-slate-600 underline dark:text-slate-300"
            >
              {showGenerator ? 'Hide password generator' : 'Generate a password'}
            </button>
            {showGenerator && <PasswordGeneratorPanel onUse={(p) => setPassword(p)} />}

            <Field label="Website URL" value={url} onChange={setUrl} />
            <Field label="Category" value={category} onChange={setCategory} />
            <TextAreaField label="Notes" value={notes} onChange={setNotes} />

            {error && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
    </div>
  )
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      />
    </div>
  )
}
