/**
 * Current blob/key-wrap format. See docs/crypto-design.md §9 — bumped on any
 * breaking change to the primitives or encoding below, never reused.
 */
export const CURRENT_FORMAT_VERSION = 1;

export const SUPPORTED_FORMAT_VERSIONS: readonly number[] = [1];

/**
 * KDF parameter tiers, named by device class rather than by raw numbers, so
 * the tier actually used travels with the wrapped key (docs/crypto-design.md
 * §3) instead of being guessed at decrypt time.
 */
export type KdfParamsTier = "desktop_moderate" | "mobile_constrained";

export const DEFAULT_KDF_TIER: KdfParamsTier = "desktop_moderate";
