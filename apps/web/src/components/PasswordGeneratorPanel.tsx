import { useId, useState } from 'react'
import { generatePassword, PasswordGeneratorError } from '@keynest/shared'

interface PasswordGeneratorPanelProps {
  onUse: (password: string) => void
}

export function PasswordGeneratorPanel({ onUse }: PasswordGeneratorPanelProps) {
  const [length, setLength] = useState(20)
  const [includeUppercase, setIncludeUppercase] = useState(true)
  const [includeLowercase, setIncludeLowercase] = useState(true)
  const [includeDigits, setIncludeDigits] = useState(true)
  const [includeSymbols, setIncludeSymbols] = useState(true)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)
  const [generated, setGenerated] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const lengthId = useId()

  async function handleGenerate() {
    setError(null)
    setBusy(true)
    try {
      const password = await generatePassword({
        length,
        includeUppercase,
        includeLowercase,
        includeDigits,
        includeSymbols,
        excludeAmbiguous,
      })
      setGenerated(password)
    } catch (err) {
      setError(err instanceof PasswordGeneratorError ? err.message : 'Could not generate a password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex items-center justify-between gap-4">
        <label htmlFor={lengthId} className="text-sm font-medium">
          Length: {length}
        </label>
        <input
          id={lengthId}
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="flex-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <CheckboxOption label="Uppercase (A-Z)" checked={includeUppercase} onChange={setIncludeUppercase} />
        <CheckboxOption label="Lowercase (a-z)" checked={includeLowercase} onChange={setIncludeLowercase} />
        <CheckboxOption label="Digits (0-9)" checked={includeDigits} onChange={setIncludeDigits} />
        <CheckboxOption label="Symbols (!@#...)" checked={includeSymbols} onChange={setIncludeSymbols} />
        <CheckboxOption
          label="Exclude ambiguous characters (0/O, 1/l/I)"
          checked={excludeAmbiguous}
          onChange={setExcludeAmbiguous}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleGenerate()}
        disabled={busy}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
      >
        {busy ? 'Generating…' : 'Generate password'}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {generated && (
        <div className="flex items-center gap-2">
          <output className="min-w-0 flex-1 truncate rounded-md border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-900">
            {generated}
          </output>
          <button
            type="button"
            onClick={() => onUse(generated)}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Use this
          </button>
        </div>
      )}
    </div>
  )
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
