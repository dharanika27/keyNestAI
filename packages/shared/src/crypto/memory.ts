import { getSodium } from "./sodium.js";

/**
 * Best-effort zeroing of a key buffer after use (docs/crypto-design.md §8).
 * This does NOT guarantee the underlying memory is unrecoverable — JS
 * engines may have made copies (string interning, JIT temporaries, GC moves)
 * outside this function's control. Callers must not rely on this as a
 * memory-forensics guarantee, only as defense in depth.
 */
export async function wipe(buffer: Uint8Array): Promise<void> {
  const sodium = await getSodium();
  sodium.memzero(buffer);
}
