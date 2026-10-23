import type { Clock } from "../clock.js";

/** Test-only clock with no relation to wall time — advanced explicitly so
 * inactivity-timeout tests are deterministic. */
export class FakeClock implements Clock {
  private current: number;

  constructor(startAt = 0) {
    this.current = startAt;
  }

  now(): number {
    return this.current;
  }

  advanceBy(ms: number): void {
    this.current += ms;
  }
}

/**
 * Test-only clock that counts its own `now()` invocations since the last
 * `reset()`, and can fire a callback as a side effect of a specific call
 * index. Used to land a `lock()` call deterministically between two
 * internal `clock.now()` call sites inside the same VaultSession method —
 * e.g. between a method's final read and its final write — without
 * guessing at microtask timing. See the "rejects an update if the vault is
 * locked strictly between its own final read and its compare-and-swap
 * write" test in vaultSession.test.ts for how the target call index is
 * determined empirically (via a no-op dry run) rather than hardcoded.
 */
export class InstrumentedClock implements Clock {
  private current = 0;
  private callCount = 0;
  private trigger: { afterCalls: number; onTrigger: () => void } | null = null;

  now(): number {
    this.callCount += 1;
    this.current += 1;
    if (this.trigger && this.callCount === this.trigger.afterCalls) {
      this.trigger.onTrigger();
    }
    return this.current;
  }

  get callsSinceReset(): number {
    return this.callCount;
  }

  /** Zeroes the call counter without affecting the monotonically
   * increasing timestamp returned by `now()`. */
  reset(): void {
    this.callCount = 0;
  }

  triggerAfter(afterCalls: number, onTrigger: () => void): void {
    this.trigger = { afterCalls, onTrigger };
  }
}
