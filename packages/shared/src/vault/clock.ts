/**
 * Time seam. VaultSession never reads the wall clock directly — every
 * inactivity decision is a pure function of an injected Clock, so timeout
 * behavior is deterministic and testable without real timers (fake clocks
 * in tests advance time explicitly).
 */
export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
