import sodiumInit from "libsodium-wrappers-sumo";

let readyPromise: Promise<typeof sodiumInit> | null = null;

/**
 * Uses the "sumo" build because the standard libsodium-wrappers build omits
 * crypto_pwhash (Argon2id) to save bundle size. libsodium-wrappers-sumo
 * loads its WASM module asynchronously. Every crypto operation in this
 * package must await this before touching `sodium.*`.
 */
export function getSodium(): Promise<typeof sodiumInit> {
  if (!readyPromise) {
    readyPromise = sodiumInit.ready.then(() => sodiumInit);
  }
  return readyPromise;
}
