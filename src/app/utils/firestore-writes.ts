/**
 * Firestore only resolves a write once the server confirms it, which never
 * happens offline. The offline cache applies the write locally straight away
 * and syncs it when the connection returns, so callers don't wait on it. The
 * only failure left is the server rejecting it (e.g. security rules), which is
 * logged.
 */
export function queueWrite(write: Promise<void>): void {
  write.catch((error) => console.error("Firestore write failed", error));
}
