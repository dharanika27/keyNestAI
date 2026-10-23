/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: false,
    server: {
      deps: {
        // Without this, externalized node_modules packages (libsodium,
        // idb, fake-indexeddb) run via Node's native loader in a separate
        // realm from the jsdom window the test file executes in. Typed
        // arrays (Uint8Array) constructed in one realm then fail
        // `instanceof`/strict-type checks performed by code in the other
        // — observed as libsodium rejecting valid AAD bytes with
        // "unsupported input type for additional_data", and IndexedDB
        // round-trips failing `toEqual` despite identical byte content.
        // Inlining forces every dependency through Vite's own transform
        // so everything shares jsdom's realm. This is a test-environment
        // accommodation only — a real browser has no such split.
        inline: true,
      },
    },
  },
})
