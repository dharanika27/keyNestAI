import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Real IndexedDB behavior in tests (not a mock of our own code), per
// docs/security-test-plan.md's integration-test expectations — the same
// IndexedDbVaultRepository code path used in the browser runs here against
// an in-memory, spec-conformant IndexedDB engine.
afterEach(() => {
  cleanup()
})

// jsdom does not implement these; Radix UI's Dialog (focus scope /
// dismissable layer) calls them during normal open/close interaction in a
// real browser. Stubbing them is a test-environment accommodation, not a
// change to any application behavior under test. Some test files (e.g.
// the repository layer, which never touches the DOM) override to the
// `node` environment and have no `window`/`Element` at all — skip entirely
// there rather than guarding every line.
if (typeof window !== 'undefined') {
  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }
  if (typeof Element.prototype.hasPointerCapture === 'undefined') {
    Element.prototype.hasPointerCapture = () => false
  }
  if (typeof Element.prototype.setPointerCapture === 'undefined') {
    Element.prototype.setPointerCapture = () => {}
  }
  if (typeof Element.prototype.releasePointerCapture === 'undefined') {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (typeof Element.prototype.scrollIntoView === 'undefined') {
    Element.prototype.scrollIntoView = () => {}
  }
}
