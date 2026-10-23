import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { VaultProvider } from '../vault/VaultContext'
import { IndexedDbVaultRepository } from '../storage/indexedDbRepository'
import { setActiveVaultId } from '../storage/activeVaultPointer'
import { VaultSession } from '@keynest/shared'

const SYNTHETIC_MASTER_PASSWORD = 'synthetic-master-password-for-tests'
const WORKFLOW_TIMEOUT_MS = 30_000

function renderApp() {
  return render(
    <VaultProvider>
      <App />
    </VaultProvider>,
  )
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('App restart (close and reopen) — cold start against an existing vault', () => {
  it(
    'shows the unlock screen (not the dashboard, not stuck loading) on a fresh mount against a vault already in IndexedDB, and the data survives the round trip',
    async () => {
      const user = userEvent.setup()

      // First "session": create a vault and add a record, then unmount —
      // simulating closing the tab/browser. The repository instance and
      // localStorage pointer are real (not mocked), so this is a genuine
      // persistence round trip, not a re-render of the same in-memory state.
      const first = renderApp()
      await screen.findByRole('heading', { name: /welcome to keynest ai/i })
      await user.type(screen.getByLabelText(/^master password$/i), SYNTHETIC_MASTER_PASSWORD)
      await user.type(screen.getByLabelText(/confirm master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /create vault/i }))
      await screen.findByRole('heading', { name: /your vault/i })

      await user.click(screen.getByRole('button', { name: /add login/i }))
      const addDialog = await screen.findByRole('dialog', { name: /add login/i })
      await user.type(within(addDialog).getByLabelText(/^title/i), 'Synthetic Restart Target')
      await user.type(within(addDialog).getByLabelText(/^password/i), 'synthetic-pw')
      await user.click(within(addDialog).getByRole('button', { name: /^save$/i }))
      await screen.findByText('Synthetic Restart Target')

      first.unmount()

      // "Reopen": a brand-new component tree, same persisted localStorage
      // pointer and same underlying IndexedDB database.
      renderApp()

      expect(await screen.findByRole('heading', { name: /unlock your vault/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /^your vault$/i })).not.toBeInTheDocument()

      await user.type(screen.getByLabelText(/master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /^unlock$/i }))

      expect(await screen.findByRole('heading', { name: /^your vault$/i })).toBeInTheDocument()
      expect(await screen.findByText('Synthetic Restart Target')).toBeInTheDocument()
    },
    WORKFLOW_TIMEOUT_MS,
  )

  it(
    'shows an error screen with a retry option if reading vault metadata fails on startup, and recovers once retried',
    async () => {
      const user = userEvent.setup()

      // Seed a valid, real vault + pointer so init() actually reaches the
      // getVaultMetadata() call this test intercepts.
      const repo = new IndexedDbVaultRepository()
      const created = await VaultSession.create(SYNTHETIC_MASTER_PASSWORD, { repository: repo })
      setActiveVaultId(created.vaultId)

      const getMetadataSpy = vi
        .spyOn(IndexedDbVaultRepository.prototype, 'getVaultMetadata')
        .mockRejectedValueOnce(new Error('synthetic storage failure'))

      renderApp()

      expect(await screen.findByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
      expect(await screen.findByRole('alert')).toHaveTextContent(/synthetic storage failure/i)

      // The mocked rejection only applied to the first (intercepted) call;
      // retrying hits the real implementation and should succeed.
      getMetadataSpy.mockRestore()
      await user.click(screen.getByRole('button', { name: /try again/i }))

      expect(await screen.findByRole('heading', { name: /unlock your vault/i })).toBeInTheDocument()
    },
    WORKFLOW_TIMEOUT_MS,
  )
})
