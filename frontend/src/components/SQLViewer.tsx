interface SQLViewerProps {
  sql: string;
  executionTimeMs?: number;
  title?: string;
  className?: string;
}

// Simple SQL keyword highlighting
function highlightSQL(sql: string): string {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET',
    'DELETE', 'CREATE', 'ALTER', 'DROP', 'TABLE', 'INDEX', 'VIEW',
    'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'ON',
    'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE', 'IS', 'NULL',
    'ORDER', 'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'ASC', 'DESC',
    'AS', 'DISTINCT', 'COUNT', 'SUM', 'AVG', 'MIN', 'MAX',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION',
    'WITH', 'RECURSIVE', 'UNION', 'ALL', 'EXCEPT', 'INTERSECT',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
    'FOR', 'LOCK', 'SHARE', 'NOWAIT', 'SKIP', 'LOCKED',
    'EXPLAIN', 'ANALYZE', 'REFRESH', 'MATERIALIZED', 'CONCURRENTLY',
    'RETURNING', 'CONFLICT', 'DO', 'NOTHING',
    'TRUE', 'FALSE', 'DEFAULT', 'CASCADE',
    'PARTITION', 'RANGE', 'LIST', 'HASH',
    'TRIGGER', 'FUNCTION', 'PROCEDURE', 'CALL',
    'GRANT', 'REVOKE', 'ROLE', 'POLICY',
    'ENABLE', 'DISABLE', 'ROW', 'LEVEL', 'SECURITY',
    'LOCAL', 'SESSION', 'CURRENT_TIMESTAMP',
  ];

  let result = sql;

  // Escape HTML
  result = result
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Highlight strings (single-quoted)
  result = result.replace(
    /'([^']*)'/g,
    '<span class="text-green-600">\'$1\'</span>'
  );

  // Highlight numbers
  result = result.replace(
    /\b(\d+\.?\d*)\b/g,
    '<span class="text-amber-600">$1</span>'
  );

  // Highlight keywords (case-insensitive, word boundary)
  for (const keyword of keywords) {
    const regex = new RegExp(`\\b(${keyword})\\b`, 'gi');
    result = result.replace(
      regex,
      '<span class="text-blue-600 font-semibold">$1</span>'
    );
  }

  // Highlight comments
  result = result.replace(
    /(--[^\n]*)/g,
    '<span class="text-gray-400 italic">$1</span>'
  );

  // Highlight operators like <=>
  result = result.replace(
    /(&lt;=&gt;)/g,
    '<span class="text-purple-600 font-bold">$1</span>'
  );

  return result;
}

export function SQLViewer({
  sql,
  executionTimeMs,
  title,
  className = '',
}: SQLViewerProps) {
  const highlighted = highlightSQL(sql);

  return (
    <div className={`rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {(title || executionTimeMs != null) && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          {title && (
            <span className="text-sm font-medium text-gray-300">{title}</span>
          )}
          {executionTimeMs != null && (
            <span className="text-xs font-mono text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
              {executionTimeMs.toFixed(2)} ms
            </span>
          )}
        </div>
      )}
      <pre className="p-4 bg-gray-900 overflow-x-auto text-sm leading-relaxed">
        <code
          className="font-mono text-gray-100"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}
