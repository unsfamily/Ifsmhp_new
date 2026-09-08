/**
 * Renders a byte count at a precision a reader can act on — whole kilobytes
 * once the number gets long, two decimals for small megabyte files so a 1.05 MB
 * attachment is not rounded into looking identical to a 1.4 MB one.
 */
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb >= 100 ? 0 : 1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}
