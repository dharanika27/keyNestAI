import { useVault } from './vault/VaultContext'
import { CreateVaultScreen } from './screens/CreateVaultScreen'
import { UnlockScreen } from './screens/UnlockScreen'
import { DashboardScreen } from './screens/DashboardScreen'

export default function App() {
  const { state, createVault, unlock, lock, forgetVault } = useVault()

  switch (state.status) {
    case 'loading':
      return (
        <main className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-slate-500" aria-live="polite">
            Loading your vault…
          </p>
        </main>
      )
    case 'no-vault':
      return <CreateVaultScreen onCreate={createVault} />
    case 'locked':
      return <UnlockScreen onUnlock={unlock} onForget={forgetVault} />
    case 'unlocked':
      return <DashboardScreen session={state.session} onLock={lock} />
  }
}
