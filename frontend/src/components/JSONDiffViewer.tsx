interface JSONDiffViewerProps {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  className?: string;
}

interface DiffEntry {
  key: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  oldVal?: unknown;
  newVal?: unknown;
}

function computeDiff(
  oldObj: Record<string, unknown> | null,
  newObj: Record<string, unknown> | null
): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const allKeys = new Set<string>();

  if (oldObj) Object.keys(oldObj).forEach((k) => allKeys.add(k));
  if (newObj) Object.keys(newObj).forEach((k) => allKeys.add(k));

  const sortedKeys = [...allKeys].sort();

  for (const key of sortedKeys) {
    const inOld = oldObj != null && key in oldObj;
    const inNew = newObj != null && key in newObj;

    if (inOld && !inNew) {
      entries.push({ key, type: 'removed', oldVal: oldObj![key] });
    } else if (!inOld && inNew) {
      entries.push({ key, type: 'added', newVal: newObj![key] });
    } else if (inOld && inNew) {
      const oldVal = oldObj![key];
      const newVal = newObj![key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        entries.push({ key, type: 'modified', oldVal, newVal });
      } else {
        entries.push({ key, type: 'unchanged', oldVal, newVal });
      }
    }
  }

  return entries;
}

function formatValue(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  return String(val);
}

export function JSONDiffViewer({
  oldValue,
  newValue,
  className = '',
}: JSONDiffViewerProps) {
  const diff = computeDiff(oldValue, newValue);

  if (diff.length === 0) {
    return (
      <div className={`p-4 text-sm text-gray-500 italic ${className}`}>
        No differences found
      </div>
    );
  }

  const changedEntries = diff.filter((d) => d.type !== 'unchanged');
  const unchangedEntries = diff.filter((d) => d.type === 'unchanged');

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      <div className="divide-y divide-gray-100">
        {changedEntries.map((entry) => (
          <div
            key={entry.key}
            className={`px-4 py-2 text-sm ${
              entry.type === 'added'
                ? 'bg-green-50'
                : entry.type === 'removed'
                ? 'bg-red-50'
                : 'bg-yellow-50'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold flex-shrink-0 mt-0.5 ${
                  entry.type === 'added'
                    ? 'bg-green-200 text-green-800'
                    : entry.type === 'removed'
                    ? 'bg-red-200 text-red-800'
                    : 'bg-yellow-200 text-yellow-800'
                }`}
              >
                {entry.type === 'added' ? '+' : entry.type === 'removed' ? '−' : '~'}
              </span>

              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900">{entry.key}</span>

                {entry.type === 'added' && (
                  <div className="mt-1">
                    <span className="font-mono text-green-700 break-all">
                      {formatValue(entry.newVal)}
                    </span>
                  </div>
                )}

                {entry.type === 'removed' && (
                  <div className="mt-1">
                    <span className="font-mono text-red-700 line-through break-all">
                      {formatValue(entry.oldVal)}
                    </span>
                  </div>
                )}

                {entry.type === 'modified' && (
                  <div className="mt-1 space-y-1">
                    <div>
                      <span className="text-xs text-gray-500 mr-1">old:</span>
                      <span className="font-mono text-red-700 line-through break-all">
                        {formatValue(entry.oldVal)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-gray-500 mr-1">new:</span>
                      <span className="font-mono text-green-700 break-all">
                        {formatValue(entry.newVal)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {unchangedEntries.length > 0 && (
          <details className="group">
            <summary className="px-4 py-2 text-xs text-gray-500 cursor-pointer hover:bg-gray-50">
              {unchangedEntries.length} unchanged field{unchangedEntries.length !== 1 ? 's' : ''}
            </summary>
            <div className="divide-y divide-gray-50">
              {unchangedEntries.map((entry) => (
                <div key={entry.key} className="px-4 py-1.5 text-sm text-gray-600">
                  <span className="font-medium">{entry.key}:</span>{' '}
                  <span className="font-mono text-gray-500 break-all">
                    {formatValue(entry.oldVal)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
