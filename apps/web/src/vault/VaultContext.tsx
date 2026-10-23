import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { VaultSession } from '@keynest/shared'
import { IndexedDbVaultRepository } from '../storage/indexedDbRepository'
import { clearActiveVaultId, getActiveVaultId, setActiveVaultId } from '../storage/activeVaultPointer'

export type VaultAppState =
  | { status: 'loading' }
  | { status: 'no-vault' }
  | { status: 'locked'; vaultId: string }
  | { status: 'unlocked'; session: VaultSession }

export interface VaultContextValue {
  state: VaultAppState
  createVault: (password: string) => Promise<void>
  unlock: (password: string) => Promise<void>
  lock: () => void
  /** Clears this device's pointer to the vault without deleting any
   * encrypted data from IndexedDB — see UnlockScreen for the user-facing
   * explanation of what this does and doesn't do. */
  forgetVault: () => void
}

const VaultContext = createContext<VaultContextValue | null>(null)

// One repository instance for the app's lifetime; IndexedDB connections are
// cheap to hold open and the repository itself holds no secret state.
const repository = new IndexedDbVaultRepository()

const INACTIVITY_POLL_INTERVAL_MS = 5_000
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'] as const

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<VaultAppState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function init() {
      const pointer = getActiveVaultId()
      if (!pointer) {
        if (!cancelled) setState({ status: 'no-vault' })
        return
      }
      const metadata = await repository.getVaultMetadata(pointer)
      if (cancelled) return
      if (!metadata) {
        // Pointer references a vault that no longer exists in this
        // browser's storage (e.g. IndexedDB was cleared independently of
        // localStorage) — fail closed to vault creation rather than
        // getting stuck on an unlock screen that can never succeed.
        clearActiveVaultId()
        setState({ status: 'no-vault' })
        return
      }
      setState({ status: 'locked', vaultId: pointer })
    }
    void init()
    return () => {
      cancelled = true
    }
  }, [])

  // Clock-driven inactivity lock: periodic poll (covers "no interaction at
  // all") plus activity listeners that call touch() (covers "actively
  // reading a record without triggering a new vault operation"). Neither
  // path invents a second timeout mechanism — both ultimately rely on
  // VaultSession's own clock-driven checkInactivity()/touch().
  useEffect(() => {
    if (state.status !== 'unlocked') return
    const session = state.session

    function syncIfLocked() {
      if (session.isLocked()) {
        setState({ status: 'locked', vaultId: session.vaultId })
      }
    }

    const interval = window.setInterval(() => {
      session.checkInactivity()
      syncIfLocked()
    }, INACTIVITY_POLL_INTERVAL_MS)

    function onActivity() {
      session.touch()
      syncIfLocked()
    }
    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true })
    }

    return () => {
      window.clearInterval(interval)
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity)
      }
    }
  }, [state])

  const value = useMemo<VaultContextValue>(
    () => ({
      state,
      async createVault(password: string) {
        const session = await VaultSession.create(password, { repository })
        setActiveVaultId(session.vaultId)
        setState({ status: 'unlocked', session })
      },
      async unlock(password: string) {
        if (state.status !== 'locked') {
          throw new Error('unlock() called without a vault pending unlock.')
        }
        const session = await VaultSession.unlock(state.vaultId, password, { repository })
        setState({ status: 'unlocked', session })
      },
      lock() {
        if (state.status !== 'unlocked') return
        state.session.lock()
        setState({ status: 'locked', vaultId: state.session.vaultId })
      },
      forgetVault() {
        clearActiveVaultId()
        setState({ status: 'no-vault' })
      },
    }),
    [state],
  )

  return <VaultContext.Provider value={value}>{children}</VaultContext.Provider>
}

export function useVault(): VaultContextValue {
  const ctx = useContext(VaultContext)
  if (!ctx) throw new Error('useVault must be used within a VaultProvider.')
  return ctx
}
