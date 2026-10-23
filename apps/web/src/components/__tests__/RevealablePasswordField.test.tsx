import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RevealablePasswordField } from '../RevealablePasswordField'

// @testing-library/user-event installs a real (in-memory) async Clipboard
// implementation once userEvent.setup() runs, so these tests exercise the
// actual Clipboard API surface rather than a hand-rolled mock of it. Its
// readText() throws if the clipboard has no "text/plain" entry at all —
// which is exactly what writeText('') produces — so an empty clipboard is
// represented as a read failure, not an empty string.
async function readClipboardTextOrEmpty(): Promise<string> {
  try {
    return await navigator.clipboard.readText()
  } catch {
    return ''
  }
}

describe('RevealablePasswordField — clipboard clearing', () => {
  it('clears the clipboard immediately on unmount instead of silently cancelling the scheduled clear', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<RevealablePasswordField label="Password" value="synthetic-secret" />)

    await user.click(screen.getByRole('button', { name: /^copy$/i }))
    expect(await navigator.clipboard.readText()).toBe('synthetic-secret')

    // Tear down well before the scheduled 20s delay would otherwise fire
    // — e.g. the user closed the record-detail dialog right after copying.
    unmount()

    await waitFor(async () => {
      expect(await readClipboardTextOrEmpty()).toBe('')
    })
  })

  it('does not clear the clipboard on unmount if its contents no longer match what this field copied', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<RevealablePasswordField label="Password" value="synthetic-secret" />)

    await user.click(screen.getByRole('button', { name: /^copy$/i }))

    // Something else (another copy, another app in a real browser) wrote
    // to the clipboard before this field was torn down.
    await navigator.clipboard.writeText('something-else-entirely')
    unmount()

    // Give the unmount cleanup's async clear a chance to run if it were
    // going to — it must not, since the clipboard no longer holds what
    // this field copied.
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(await navigator.clipboard.readText()).toBe('something-else-entirely')
  })

  it('still clears the clipboard via the normal scheduled timer when the field stays mounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const user = userEvent.setup({ delay: null })
      render(<RevealablePasswordField label="Password" value="synthetic-secret" />)

      await user.click(screen.getByRole('button', { name: /^copy$/i }))
      expect(await navigator.clipboard.readText()).toBe('synthetic-secret')

      await vi.advanceTimersByTimeAsync(20_000)

      expect(await readClipboardTextOrEmpty()).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })
})
