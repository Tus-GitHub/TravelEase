// Preserve the original error class/status while carrying a proof that this
// request's new upload was never committed. Never infer this from a later read:
// a lost COMMIT acknowledgement or another editor can make that read misleading.
const rolledBack = new WeakSet<object>();

export function markUploadRolledBack(error: unknown): void {
  if (error !== null && (typeof error === "object" || typeof error === "function")) rolledBack.add(error);
}

export function uploadWasRolledBack(error: unknown): boolean {
  return error !== null && (typeof error === "object" || typeof error === "function") && rolledBack.has(error);
}
