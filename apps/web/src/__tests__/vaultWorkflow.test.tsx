import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { VaultProvider } from '../vault/VaultContext'

const SYNTHETIC_MASTER_PASSWORD = 'synthetic-master-password-for-tests'
const WORKFLOW_TIMEOUT_MS = 30_000 // Argon2id (desktop_moderate) runs for real here, not mocked

function renderApp() {
  return render(
    <VaultProvider>
      <App />
    </VaultProvider>,
  )
}

beforeEach(() => {
  // Each test gets its own vault (random vaultId), but the "which vault is
  // active" pointer is shared browser-wide state and must not leak between
  // tests.
  window.localStorage.clear()
})

describe('Complete local vault workflow', () => {
  it(
    'creates a vault, adds/views/edits/deletes a login, locks, rejects a wrong password, and unlocks to find data intact',
    async () => {
      const user = userEvent.setup()
      renderApp()

      // --- Create vault ---
      expect(await screen.findByRole('heading', { name: /welcome to keynest ai/i })).toBeInTheDocument()
      await user.type(screen.getByLabelText(/^master password$/i), SYNTHETIC_MASTER_PASSWORD)
      await user.type(screen.getByLabelText(/confirm master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /create vault/i }))

      // --- Dashboard, empty state ---
      expect(await screen.findByRole('heading', { name: /your vault/i })).toBeInTheDocument()
      expect(await screen.findByText(/no items yet/i)).toBeInTheDocument()

      // --- Add a login ---
      await user.click(screen.getByRole('button', { name: /add login/i }))
      const addDialog = await screen.findByRole('dialog', { name: /add login/i })
      await user.type(within(addDialog).getByLabelText(/^title/i), 'Synthetic Example Bank')
      await user.type(within(addDialog).getByLabelText(/^username/i), 'synthetic-user')
      await user.type(within(addDialog).getByLabelText(/^password/i), 'synthetic-password-1')
      await user.click(within(addDialog).getByRole('button', { name: /^save$/i }))

      // --- Appears in the list ---
      expect(await screen.findByText('Synthetic Example Bank')).toBeInTheDocument()
      expect(screen.queryByText(/no items yet/i)).not.toBeInTheDocument()

      // --- View detail, reveal password ---
      await user.click(screen.getByText('Synthetic Example Bank'))
      const detailDialog = await screen.findByRole('dialog', { name: /synthetic example bank/i })
      const revealButton = within(detailDialog).getByRole('button', { name: /^reveal$/i })
      await user.click(revealButton)
      expect(within(detailDialog).getByLabelText(/^password$/i)).toHaveValue('synthetic-password-1')
      await user.click(within(detailDialog).getByRole('button', { name: /^close$/i }))

      // --- Edit: change the password ---
      await user.click(screen.getByRole('button', { name: /^edit$/i }))
      const editDialog = await screen.findByRole('dialog', { name: /edit login/i })
      const editPasswordField = within(editDialog).getByLabelText(/^password/i)
      await user.clear(editPasswordField)
      await user.type(editPasswordField, 'synthetic-password-2')
      await user.click(within(editDialog).getByRole('button', { name: /^save$/i }))

      await user.click(await screen.findByText('Synthetic Example Bank'))
      const detailDialogAfterEdit = await screen.findByRole('dialog', { name: /synthetic example bank/i })
      await user.click(within(detailDialogAfterEdit).getByRole('button', { name: /^reveal$/i }))
      expect(within(detailDialogAfterEdit).getByLabelText(/^password$/i)).toHaveValue('synthetic-password-2')
      await user.click(within(detailDialogAfterEdit).getByRole('button', { name: /^close$/i }))

      // --- Lock, then unlock with the WRONG password: must be rejected ---
      await user.click(screen.getByRole('button', { name: /^lock$/i }))
      expect(await screen.findByRole('heading', { name: /unlock your vault/i })).toBeInTheDocument()
      await user.type(screen.getByLabelText(/master password/i), 'definitely-the-wrong-password')
      await user.click(screen.getByRole('button', { name: /^unlock$/i }))
      expect(await screen.findByRole('alert')).toHaveTextContent(/incorrect master password/i)

      // --- Unlock with the correct password: the record is still there ---
      await user.type(screen.getByLabelText(/master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /^unlock$/i }))
      expect(await screen.findByRole('heading', { name: /your vault/i })).toBeInTheDocument()
      expect(await screen.findByText('Synthetic Example Bank')).toBeInTheDocument()

      // --- Delete it, with confirmation ---
      await user.click(screen.getByRole('button', { name: /^delete$/i }))
      const confirmDialog = await screen.findByRole('dialog', { name: /delete this login/i })
      await user.click(within(confirmDialog).getByRole('button', { name: /^delete$/i }))
      expect(await screen.findByText(/no items yet/i)).toBeInTheDocument()
      expect(screen.queryByText('Synthetic Example Bank')).not.toBeInTheDocument()
    },
    WORKFLOW_TIMEOUT_MS,
  )

  it(
    'searches records by title, username, and category',
    async () => {
      const user = userEvent.setup()
      renderApp()

      await screen.findByRole('heading', { name: /welcome to keynest ai/i })
      await user.type(screen.getByLabelText(/^master password$/i), SYNTHETIC_MASTER_PASSWORD)
      await user.type(screen.getByLabelText(/confirm master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /create vault/i }))
      await screen.findByRole('heading', { name: /your vault/i })

      async function addLogin(title: string, username: string, category: string) {
        await user.click(screen.getByRole('button', { name: /add login/i }))
        const dialog = await screen.findByRole('dialog', { name: /add login/i })
        await user.type(within(dialog).getByLabelText(/^title/i), title)
        await user.type(within(dialog).getByLabelText(/^username/i), username)
        await user.type(within(dialog).getByLabelText(/^password/i), 'synthetic-pw')
        await user.type(within(dialog).getByLabelText(/^category/i), category)
        await user.click(within(dialog).getByRole('button', { name: /^save$/i }))
        await screen.findByText(title)
      }

      await addLogin('Synthetic Shop', 'shopper@example.test', 'retail')
      await addLogin('Synthetic Bank', 'banker@example.test', 'finance')

      const search = screen.getByLabelText(/search your vault/i)
      await user.type(search, 'retail')
      expect(await screen.findByText('Synthetic Shop')).toBeInTheDocument()
      expect(screen.queryByText('Synthetic Bank')).not.toBeInTheDocument()

      await user.clear(search)
      await user.type(search, 'banker@example.test')
      expect(await screen.findByText('Synthetic Bank')).toBeInTheDocument()
      expect(screen.queryByText('Synthetic Shop')).not.toBeInTheDocument()
    },
    WORKFLOW_TIMEOUT_MS,
  )
})
