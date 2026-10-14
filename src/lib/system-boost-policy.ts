/**
 * Report only a decrease derived from two valid observed memory measurements.
 * Missing measurements stay unknown instead of being converted into a fake zero.
 */
export function observedMemoryDecrease(beforeMB: number | null, afterMB: number | null): number | null {
  if (beforeMB === null || afterMB === null || !Number.isFinite(beforeMB) || !Number.isFinite(afterMB)) {
    return null;
  }
  return Math.max(0, beforeMB - afterMB);
}
