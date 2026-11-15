// Pure helper for the audit log's one-line summary (no React Native, so it is unit-tested).

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A short, readable summary of what changed. The server's before/after can be anything JSON, so check the shape first. */
export function auditDetail(entry: { before?: unknown; after?: unknown }): string | null {
  const a = isRecord(entry.after) ? entry.after : null;
  const b = isRecord(entry.before) ? entry.before : null;
  if (a && b && 'role' in a && 'role' in b) return `${String(b.role)} → ${String(a.role)}`;
  if (a && typeof a.reason === 'string') return `“${a.reason}”`;
  if (a && 'can_manage_all_content' in a) return a.can_manage_all_content ? 'can manage all content' : 'no longer manages all content';
  return null;
}
