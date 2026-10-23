import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { VaultProvider } from '../vault/VaultContext'

const SYNTHETIC_MASTER_PASSWORD = 'synthetic-master-password-for-tests'

// VaultSession's default inactivity timeout (packages/shared/src/vault/vaultSession.ts
// DEFAULT_INACTIVITY_TIMEOUT_MS). VaultContext does not currently expose a
// way to configure a shorter timeout for the app, so this test exercises
// the real default via fake timers rather than an artificially shortened
// one, which is more faithful to production behavior.
const DEFAULT_INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000
const INACTIVITY_POLL_INTERVAL_MS = 5_000

beforeEach(() => {
  window.localStorage.clear()
  // Fake timers must be active *before* VaultContext's effect runs and
  // calls window.setInterval() for the first time — a real interval
  // created before fake timers are installed stays tied to the real
  // timer system and is never advanced by vi.advanceTimersByTimeAsync().
  vi.useFakeTimers({ shouldAdvanceTime: true })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Inactivity lock — UI wiring', () => {
  it(
    'locks the UI (shows UnlockScreen) when the periodic inactivity poll fires with no activity',
    async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <VaultProvider>
          <App />
        </VaultProvider>,
      )

      await screen.findByRole('heading', { name: /welcome to keynest ai/i })
      await user.type(screen.getByLabelText(/^master password$/i), SYNTHETIC_MASTER_PASSWORD)
      await user.type(screen.getByLabelText(/confirm master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /create vault/i }))
      await screen.findByRole('heading', { name: /your vault/i })

      // Past the real default inactivity timeout, with at least one more
      // poll tick so VaultContext's setInterval has a chance to run
      // checkInactivity() and sync React state to 'locked'.
      await vi.advanceTimersByTimeAsync(DEFAULT_INACTIVITY_TIMEOUT_MS + INACTIVITY_POLL_INTERVAL_MS)

      expect(await screen.findByRole('heading', { name: /unlock your vault/i })).toBeInTheDocument()
      // The dashboard must actually be gone, not merely obscured — a stale
      // session reference must not still be rendering alongside the lock
      // screen. (Matched exactly, since "Unlock your vault" itself
      // contains the substring "your vault".)
      expect(screen.queryByRole('heading', { name: /^your vault$/i })).not.toBeInTheDocument()
    },
    30_000,
  )

  it(
    'does not lock while activity events keep arriving, even past the default timeout',
    async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      render(
        <VaultProvider>
          <App />
        </VaultProvider>,
      )

      await screen.findByRole('heading', { name: /welcome to keynest ai/i })
      await user.type(screen.getByLabelText(/^master password$/i), SYNTHETIC_MASTER_PASSWORD)
      await user.type(screen.getByLabelText(/confirm master password/i), SYNTHETIC_MASTER_PASSWORD)
      await user.click(screen.getByRole('button', { name: /create vault/i }))
      await screen.findByRole('heading', { name: /your vault/i })

      // Advance in steps shorter than the timeout, firing a real DOM
      // activity event (mousemove) between each — touch() should keep
      // extending the session the whole way past where the first test's
      // single uninterrupted gap would have locked it.
      const step = INACTIVITY_POLL_INTERVAL_MS * 2
      let elapsed = 0
      while (elapsed < DEFAULT_INACTIVITY_TIMEOUT_MS + INACTIVITY_POLL_INTERVAL_MS * 2) {
        window.dispatchEvent(new MouseEvent('mousemove'))
        await vi.advanceTimersByTimeAsync(step)
        elapsed += step
      }

      expect(screen.getByRole('heading', { name: /^your vault$/i })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: /unlock your vault/i })).not.toBeInTheDocument()
    },
    30_000,
  )
})
