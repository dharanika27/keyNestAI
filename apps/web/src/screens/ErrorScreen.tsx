interface ErrorScreenProps {
  message: string
  onRetry: () => void
}

/** Shown when startup initialization fails (e.g. local storage is
 * unavailable or blocked) instead of leaving the app on an unending
 * loading state with no way forward. */
export function ErrorScreen({ message, onRetry }: ErrorScreenProps) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          KeyNest AI could not access this device's local vault storage. No vault data was lost — your
          master password and vault contents never leave this device regardless.
        </p>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
      >
        Try again
      </button>
    </main>
  )
}
