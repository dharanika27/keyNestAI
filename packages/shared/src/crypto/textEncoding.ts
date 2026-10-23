/**
 * UTF-8 encodes `value`, always returning a freshly-constructed Uint8Array
 * rather than whatever `TextEncoder.prototype.encode()` itself returns.
 *
 * Some runtimes inject a `TextEncoder` that was defined in a different
 * realm than the module calling it — notably jsdom-based test
 * environments, which fall back to Node's native TextEncoder on jsdom's
 * `window` global. Its output's prototype then belongs to the *other*
 * realm's Uint8Array, which fails the strict `instanceof Uint8Array`
 * checks libsodium (and other consumers) perform, even though the bytes
 * are byte-for-byte identical. Re-wrapping via `new Uint8Array(...)`
 * forces the result to be constructed with whatever Uint8Array is in
 * scope at this call site. This is a no-op copy of a few dozen bytes in
 * any single-realm environment — every real browser, and Node outside a
 * jsdom vm context — so it has no effect on production behavior.
 */
export function encodeUtf8(value: string): Uint8Array {
  return new Uint8Array(new TextEncoder().encode(value));
}

/** Decodes UTF-8 bytes to a string. Paired with encodeUtf8 for symmetry;
 * TextDecoder's input handling has not been observed to have the same
 * cross-realm issue, but routing through one helper keeps both encode and
 * decode paths easy to re-audit together if that ever changes. */
export function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
