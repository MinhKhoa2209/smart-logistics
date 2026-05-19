import { cn } from '@/lib/utils';

interface SQLViewerProps {
  sql: string;
  executionTimeMs?: number;
  title?: string;
  className?: string;
}

function highlightSQL(sql: string): string {
  const keywords = ['SELECT','FROM','WHERE','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','ALTER','DROP','TABLE','INDEX','VIEW','JOIN','LEFT','RIGHT','INNER','OUTER','ON','AND','OR','NOT','IN','EXISTS','BETWEEN','LIKE','IS','NULL','ORDER','BY','GROUP','HAVING','LIMIT','OFFSET','ASC','DESC','AS','DISTINCT','COUNT','SUM','AVG','MIN','MAX','BEGIN','COMMIT','ROLLBACK','WITH','RECURSIVE','UNION','ALL','CASE','WHEN','THEN','ELSE','END','FOR','LOCK','SHARE','NOWAIT','EXPLAIN','ANALYZE','REFRESH','MATERIALIZED','CONCURRENTLY','RETURNING','TRUE','FALSE','DEFAULT','CASCADE','PARTITION','TRIGGER','FUNCTION','PROCEDURE','GRANT','REVOKE','POLICY','ENABLE','DISABLE','ROW','LEVEL','SECURITY','LOCAL','SESSION','COALESCE','CURRENT_DATE','CURRENT_TIMESTAMP','INTERVAL','EXTRACT'];

  let r = sql.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  r = r.replace(/'([^']*)'/g, '<span style="color:#a3e635">\'$1\'</span>');
  r = r.replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#fb923c">$1</span>');
  for (const kw of keywords) {
    r = r.replace(new RegExp(`\\b(${kw})\\b`, 'gi'), '<span style="color:#818cf8;font-weight:600">$1</span>');
  }
  r = r.replace(/(--[^\n]*)/g, '<span style="color:#6b7280;font-style:italic">$1</span>');
  r = r.replace(/(&lt;=&gt;)/g, '<span style="color:#f472b6;font-weight:700">$1</span>');
  return r;
}

export function SQLViewer({ sql, executionTimeMs, title, className = '' }: SQLViewerProps) {
  return (
    <div className={cn('rounded-xl overflow-hidden border border-zinc-800 dark:border-zinc-700', className)}>
      {(title || executionTimeMs != null) && (
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800">
          {title && <span className="text-xs font-medium text-zinc-400">{title}</span>}
          {executionTimeMs != null && (
            <span className="text-xs font-mono text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded-md">{executionTimeMs.toFixed(2)}ms</span>
          )}
        </div>
      )}
      <pre className="p-4 bg-zinc-950 overflow-x-auto text-xs leading-relaxed">
        <code className="font-mono text-zinc-200" dangerouslySetInnerHTML={{ __html: highlightSQL(sql) }} />
      </pre>
    </div>
  );
}
