import { useCallback, useEffect, useId, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import type { VaultRecord, VaultRecordInput, VaultSession } from '@keynest/shared'
import { RecordForm } from '../components/RecordForm'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RevealablePasswordField } from '../components/RevealablePasswordField'
import { toUserMessage } from '../lib/errorMessages'

interface DashboardScreenProps {
  session: VaultSession
  onLock: () => void
}

type EditingTarget = VaultRecord | 'new' | null

export function DashboardScreen({ session, onLock }: DashboardScreenProps) {
  const [records, setRecords] = useState<VaultRecord[] | null>(null)
  const [query, setQuery] = useState('')
  const [loadError, setLoadError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditingTarget>(null)
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<VaultRecord | null>(null)
  const [viewing, setViewing] = useState<VaultRecord | null>(null)

  const refresh = useCallback(async () => {
    setLoadError(null)
    try {
      const result = query.trim() ? await session.searchRecords(query) : await session.listRecords()
      setRecords(result)
    } catch (err) {
      setLoadError(toUserMessage(err))
    }
  }, [session, query])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleSave(input: VaultRecordInput) {
    setFormBusy(true)
    setFormError(null)
    try {
      if (editing && editing !== 'new') {
        await session.updateRecord(editing.id, input)
      } else {
        await session.addRecord(input)
      }
      setEditing(null)
      await refresh()
    } catch (err) {
      setFormError(toUserMessage(err))
    } finally {
      setFormBusy(false)
    }
  }

  async function handleDelete() {
    const target = pendingDelete
    if (!target) return
    setPendingDelete(null)
    try {
      await session.deleteRecord(target.id)
    } catch (err) {
      setLoadError(toUserMessage(err))
    } finally {
      await refresh()
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Your vault</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            Add login
          </button>
          <button
            type="button"
            onClick={onLock}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Lock
          </button>
        </div>
      </header>

      <p className="mt-2 text-xs text-slate-500">
        Stored only on this device — no backup or cross-device sync is enabled yet.
      </p>

      <div className="mt-4">
        <label htmlFor="vault-search" className="sr-only">
          Search your vault
        </label>
        <input
          id="vault-search"
          type="search"
          placeholder="Search by title, username, URL, or category"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900"
        />
      </div>

      {loadError && (
        <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400">
          {loadError}
        </p>
      )}

      <ul className="mt-4 flex flex-col gap-2">
        {records === null && !loadError && (
          <li className="text-sm text-slate-500" aria-live="polite">
            Loading…
          </li>
        )}
        {records !== null && records.length === 0 && (
          <li className="text-sm text-slate-500">
            {query ? 'No matching items.' : 'No items yet — add your first login.'}
          </li>
        )}
        {records?.map((record) => (
          <li
            key={record.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 dark:border-slate-700"
          >
            <button type="button" onClick={() => setViewing(record)} className="min-w-0 flex-1 text-left">
              <p className="truncate font-medium">{record.title}</p>
              {record.username && <p className="truncate text-sm text-slate-500">{record.username}</p>}
            </button>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setEditing(record)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete(record)}
                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:border-slate-600 dark:text-red-400 dark:hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>

      <RecordDetail record={viewing} onClose={() => setViewing(null)} />

      <RecordForm
        open={editing !== null}
        initial={editing && editing !== 'new' ? editing : undefined}
        busy={formBusy}
        error={formError}
        onSubmit={(input) => void handleSave(input)}
        onClose={() => {
          setEditing(null)
          setFormError(null)
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this login?"
        description={`This will permanently delete "${pendingDelete?.title ?? ''}" from this vault. This cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => void handleDelete()}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
  )
}

function RecordDetail({ record, onClose }: { record: VaultRecord | null; onClose: () => void }) {
  const titleId = useId()
  return (
    <Dialog.Root
      open={record !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800"
          aria-labelledby={titleId}
        >
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title id={titleId} className="text-lg font-semibold">
              {record?.title}
            </Dialog.Title>
            <Dialog.Close className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700">
              Close
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">
            Details for the saved login {record?.title}.
          </Dialog.Description>

          {record && (
            <div className="mt-4 flex flex-col gap-3">
              {record.username && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Username</p>
                  <p className="text-sm">{record.username}</p>
                </div>
              )}
              <RevealablePasswordField label="Password" value={record.password} />
              {record.url && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Website URL</p>
                  <p className="truncate text-sm">{record.url}</p>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{record.notes}</p>
                </div>
              )}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
