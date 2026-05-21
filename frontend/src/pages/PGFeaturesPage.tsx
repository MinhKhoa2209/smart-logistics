import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, ErrorAlert, SQLViewer } from '@/components';
import { Play, RotateCcw, Database, Zap, GitBranch, Code2, Search, Shield, Layers, Eye, FileText } from 'lucide-react';
import * as pgApi from '@/api/pgFeatures';

// ─── Tab definitions ──────────────────────────────────────────────────────────
type Tab = 'transactions' | 'locking' | 'triggers' | 'stored-procs' | 'partial-indexes' | 'materialized-views' | 'audit' | 'pgvector' | 'rls' | 'partitioning';

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const TABS: TabDef[] = [
  { id: 'transactions',       label: 'Transactions',      icon: <Database className="h-4 w-4" />,  color: 'text-blue-600' },
  { id: 'locking',            label: 'Row Locking',        icon: <Zap className="h-4 w-4" />,       color: 'text-yellow-600' },
  { id: 'triggers',           label: 'Triggers',           icon: <GitBranch className="h-4 w-4" />, color: 'text-green-600' },
  { id: 'stored-procs',       label: 'Stored Functions',   icon: <Code2 className="h-4 w-4" />,     color: 'text-purple-600' },
  { id: 'partial-indexes',    label: 'Partial Indexes',    icon: <Layers className="h-4 w-4" />,    color: 'text-orange-600' },
  { id: 'materialized-views', label: 'Materialized Views', icon: <Eye className="h-4 w-4" />,       color: 'text-cyan-600' },
  { id: 'audit',              label: 'Audit Logging',      icon: <FileText className="h-4 w-4" />,  color: 'text-red-600' },
  { id: 'pgvector',           label: 'pgvector',           icon: <Search className="h-4 w-4" />,    color: 'text-indigo-600' },
  { id: 'rls',                label: 'Row Level Security', icon: <Shield className="h-4 w-4" />,    color: 'text-pink-600' },
  { id: 'partitioning',       label: 'Partitioning',       icon: <Layers className="h-4 w-4" />,    color: 'text-teal-600' },
];

// ─── Shared: Feature info card ────────────────────────────────────────────────
function FeatureInfo({ description, objects }: { title: string; description: string; objects: string[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      <div className="lg:col-span-2 bg-muted/40 rounded-xl p-4 border">
        <p className="text-sm leading-relaxed">{description}</p>
      </div>
      <div className="bg-muted/40 rounded-xl p-4 border">
        <h3 className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2">Database Objects</h3>
        <div className="flex flex-wrap gap-1.5">
          {objects.map(obj => (
            <code key={obj} className="text-xs bg-background border rounded px-2 py-0.5 font-mono">{obj}</code>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared: Demo result steps ────────────────────────────────────────────────
function DemoSteps({ steps }: { steps: pgApi.DemoExecutionResult[] }) {
  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Execution Steps</h4>
      {steps.map((step, i) => (
        <div key={i} className="rounded-xl border overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
            <div className="flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">{i + 1}</span>
              <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            </div>
            <Badge variant="outline" className="text-xs font-mono">{step.executionTimeMs}ms</Badge>
          </div>
          <div className="p-4 space-y-3">
            <SQLViewer sql={step.sql} />
            {step.error && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                <span className="font-bold shrink-0">Error:</span>
                <span>{step.error}</span>
              </div>
            )}
            {step.result && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Result</p>
                <pre className="text-xs bg-muted/50 border p-3 rounded-lg overflow-auto max-h-48 font-mono">
                  {JSON.stringify(step.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function compactStep(step: pgApi.DemoExecutionResult | undefined | null): pgApi.DemoExecutionResult[] {
  return step ? [step] : [];
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PGFeaturesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!confirm('Reset all demo data? This will clean up demo-specific records.')) return;
    setResetting(true);
    try { await pgApi.resetDemoData(); alert('Demo data reset successfully.'); }
    catch (e: any) { alert(e.message); }
    setResetting(false);
  }

  const activeTabDef = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">PostgreSQL Features Demo</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interactive demonstrations of advanced PostgreSQL capabilities used in this system.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="h-3.5 w-3.5" />
          {resetting ? 'Resetting...' : 'Reset Demo Data'}
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-1 border-b border-border pb-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            <span className={activeTab === tab.id ? tab.color : ''}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <Card className="rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className={activeTabDef.color}>{activeTabDef.icon}</span>
            {activeTabDef.label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeTab === 'transactions'       && <TransactionsDemo />}
          {activeTab === 'locking'            && <LockingDemo />}
          {activeTab === 'triggers'           && <TriggersDemo />}
          {activeTab === 'stored-procs'       && <StoredProcsDemo />}
          {activeTab === 'partial-indexes'    && <PartialIndexesDemo />}
          {activeTab === 'materialized-views' && <MVDemo />}
          {activeTab === 'audit'              && <AuditDemo />}
          {activeTab === 'pgvector'           && <PgvectorDemo />}
          {activeTab === 'rls'                && <RLSDemo />}
          {activeTab === 'partitioning'       && <PartitioningDemo />}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Demo Components ──────────────────────────────────────────────────────────

function TransactionsDemo() {
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() { setLoading(true); setError(''); try { const r = await pgApi.transactionsDemo(sessionId || undefined); setResults(r.steps); setSessionId(r.sessionId); } catch (e: any) { setError(e.message); } setLoading(false); }
  async function commit() { try { const r = await pgApi.commitTransaction(sessionId); setResults(p => [...p, r]); setSessionId(''); } catch (e: any) { setError(e.message); } }
  async function rollback() { try { const r = await pgApi.rollbackTransaction(sessionId); setResults(p => [...p, r]); setSessionId(''); } catch (e: any) { setError(e.message); } }

  return (
    <div>
      <FeatureInfo title="Transactions" description="A transaction groups multiple SQL statements into a single atomic unit. Either ALL statements succeed (COMMIT) or ALL are undone (ROLLBACK). This demo shows a Purchase Order receiving operation kept open so you can choose to commit or rollback." objects={['BEGIN', 'COMMIT', 'ROLLBACK', 'purchase_orders', 'order_items', 'stock_movements']} />
      <div className="flex flex-wrap gap-2">
        <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Run Demo</Button>
        {sessionId && <><Button variant="outline" onClick={commit} className="border-green-300 text-green-700 hover:bg-green-50">✓ COMMIT — Save changes</Button><Button variant="outline" onClick={rollback} className="border-red-300 text-red-700 hover:bg-red-50">✗ ROLLBACK — Discard changes</Button></>}
      </div>
      {sessionId && <p className="mt-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⏳ Transaction is open. Click COMMIT to save or ROLLBACK to discard.</p>}
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function LockingDemo() {
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { const r = await pgApi.lockingDemo(); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="SELECT ... FOR UPDATE (Pessimistic Locking)" description="When two transfers happen simultaneously on the same inventory row, SELECT FOR UPDATE acquires an exclusive row lock. Transfer B must wait until Transfer A releases the lock. This prevents race conditions and double-spending of inventory." objects={['SELECT ... FOR UPDATE', 'inventory', 'move_stock_advanced()']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Simulate Concurrent Transfers</Button>
      {loading && <div className="mt-3"><LoadingSpinner /><p className="text-sm text-center text-muted-foreground">Simulating two concurrent connections...</p></div>}
      {error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function TriggersDemo() {
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { const r = await pgApi.triggersDemo(); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="Automatic Triggers" description="Triggers are functions that PostgreSQL executes automatically when data changes. This demo inserts a stock movement that reduces inventory to the reorder point. Two triggers fire: (1) trg_sync_inventory updates inventory quantity, (2) trg_check_reorder detects low stock and auto-creates a Purchase Order." objects={['trg_sync_inventory_after_movement', 'trg_check_reorder_after_inventory_change', 'stock_movements', 'inventory', 'purchase_orders']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Trigger Auto-PO Demo</Button>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function StoredProcsDemo() {
  const [proc, setProc] = useState('calculate_distance');
  const [params, setParams] = useState<Record<string, string>>({ lat1: '10.8231', lon1: '106.6297', lat2: '21.0285', lon2: '105.8542' });
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const procDefs: Record<string, { params: string[]; defaults: Record<string, string>; description: string }> = {
    calculate_distance: { params: ['lat1', 'lon1', 'lat2', 'lon2'], defaults: { lat1: '10.8231', lon1: '106.6297', lat2: '21.0285', lon2: '105.8542' }, description: 'Calculates the Haversine distance (km) between two geographic coordinates. Used to find the nearest warehouse to a delivery address.' },
    suggest_smart_warehouse: { params: ['product_id', 'required_quantity', 'latitude', 'longitude'], defaults: { product_id: '1', required_quantity: '10', latitude: '10.8231', longitude: '106.6297' }, description: 'Finds the optimal warehouse to fulfill an order based on: (1) sufficient stock, (2) geographic proximity to the delivery location.' },
    move_stock_advanced: { params: ['product_id', 'from_warehouse_id', 'to_warehouse_id', 'quantity'], defaults: { product_id: '1', from_warehouse_id: '1', to_warehouse_id: '2', quantity: '5' }, description: 'Transfers stock between warehouses using SELECT FOR UPDATE to prevent concurrent conflicts. Creates paired transfer_in/transfer_out movements atomically.' },
  };

  function changeProc(p: string) { setProc(p); setParams(procDefs[p].defaults); setResults([]); }
  async function execute() { setLoading(true); setError(''); try { const numP: Record<string, number> = {}; Object.entries(params).forEach(([k, v]) => { numP[k] = Number(v); }); const r = await pgApi.storedProcedureDemo(proc, numP); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }

  return (
    <div>
      <FeatureInfo title="Stored Functions / Procedures" description="Stored functions encapsulate complex business logic inside PostgreSQL, reducing round-trips and ensuring consistency. They run with full ACID guarantees and can use row-level locking." objects={['calculate_distance()', 'suggest_smart_warehouse()', 'move_stock_advanced()']} />
      <div className="space-y-4">
        <div><label className="block text-sm font-medium mb-1.5">Select Function</label>
          <Select value={proc} onChange={(e) => changeProc(e.target.value)} className="w-80">
            <option value="calculate_distance">calculate_distance — Haversine distance</option>
            <option value="suggest_smart_warehouse">suggest_smart_warehouse — Find nearest warehouse</option>
            <option value="move_stock_advanced">move_stock_advanced — Transfer with locking</option>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 border">{procDefs[proc].description}</p>
        <div className="grid grid-cols-2 gap-3">{procDefs[proc].params.map((p) => (<div key={p}><label className="block text-xs font-medium text-muted-foreground mb-1">{p}</label><Input value={params[p] || ''} onChange={(e) => setParams(prev => ({ ...prev, [p]: e.target.value }))} /></div>))}</div>
        <Button onClick={execute} disabled={loading}><Play className="h-3.5 w-3.5" /> Execute Function</Button>
      </div>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function PartialIndexesDemo() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { setResult(await pgApi.partialIndexesDemo()); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="Partial Indexes" description="A partial index only indexes rows matching a WHERE condition. The idx_inventory_low_stock index only covers rows where quantity <= reorder_point — a small subset of all inventory. This makes low-stock queries extremely fast while using minimal storage." objects={['idx_inventory_low_stock', 'idx_product_lots_expiry', 'EXPLAIN ANALYZE']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Compare With vs Without Index</Button>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4 space-y-4">
          <DemoSteps steps={[result.withIndex, result.withoutIndex, result.indexMetadata]} />
          <div className="grid grid-cols-2 gap-4">
            {/* With Index */}
            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-4">
              <h4 className="font-semibold text-sm text-green-800 dark:text-green-400 mb-3">✓ With Partial Index</h4>
              <p className="text-xs text-green-700 dark:text-green-500 mb-3">
                Scan: <code>{result.comparison.withIndex.scanType}</code>
              </p>
              {/* Row bar */}
              <p className="text-xs font-medium text-green-800 dark:text-green-400 mb-1">
                Rows read: <strong>{result.comparison.withIndex.rowsScanned}</strong> / {result.comparison.totalRows}
              </p>
              <div className="w-full bg-green-100 dark:bg-green-900/40 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-500 h-3 rounded-full transition-all"
                  style={{ width: `${(result.comparison.withIndex.rowsScanned / result.comparison.totalRows) * 100}%` }}
                />
              </div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                Only reads rows matching <code>quantity &lt;= reorder_point</code>
              </p>
            </div>

            {/* Without Index */}
            <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4">
              <h4 className="font-semibold text-sm text-red-800 dark:text-red-400 mb-3">✗ Without Index (Seq Scan)</h4>
              <p className="text-xs text-red-700 dark:text-red-500 mb-3">
                Scan: <code>{result.comparison.withoutIndex.scanType}</code>
              </p>
              {/* Row bar — always full */}
              <p className="text-xs font-medium text-red-800 dark:text-red-400 mb-1">
                Rows read: <strong>{result.comparison.totalRows}</strong> / {result.comparison.totalRows}
              </p>
              <div className="w-full bg-red-100 dark:bg-red-900/40 rounded-full h-3 overflow-hidden">
                <div className="bg-red-500 h-3 rounded-full w-full" />
              </div>
              <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                Must scan every row in the table to find matches
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <p className="text-sm font-semibold text-primary mb-1">
              Index reads {result.comparison.withIndex.rowsScanned} rows — Seq Scan reads all {result.comparison.totalRows} rows
            </p>
            <p className="text-xs text-muted-foreground">
              At production scale (millions of rows), the index jumps directly to matching rows while Seq Scan reads every single row — the performance gap grows proportionally with table size.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function MVDemo() {
  const [refreshResult, setRefreshResult] = useState<pgApi.DemoExecutionResult | null>(null);
  const [compareResult, setCompareResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <div>
      <FeatureInfo title="Materialized Views" description="A materialized view stores the result of a complex query as a physical table. Reads are instant (no JOIN computation). The view is refreshed with REFRESH MATERIALIZED VIEW CONCURRENTLY — which allows reads during refresh without locking." objects={['mv_inventory_summary', 'REFRESH MATERIALIZED VIEW CONCURRENTLY', 'EXPLAIN ANALYZE']} />
      <div className="flex gap-2">
        <Button onClick={async () => { setLoading(true); try { setRefreshResult(await pgApi.refreshMaterializedView()); } catch (e: any) { setError(e.message); } setLoading(false); }} disabled={loading}><RotateCcw className="h-3.5 w-3.5" /> Refresh MV</Button>
        <Button variant="outline" onClick={async () => { setLoading(true); try { setCompareResult(await pgApi.compareMaterializedView()); } catch (e: any) { setError(e.message); } setLoading(false); }} disabled={loading}><Play className="h-3.5 w-3.5" /> Compare Performance</Button>
      </div>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}
      {refreshResult && (
        <div className="mt-4 space-y-4">
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 rounded-xl p-4"><p className="text-sm font-medium text-green-800 dark:text-green-400">✓ Refreshed in <strong>{refreshResult.executionTimeMs}ms</strong> — reads unblocked (CONCURRENTLY)</p></div>
          <DemoSteps steps={compactStep(refreshResult)} />
        </div>
      )}
      {compareResult && (
        <div className="mt-4 space-y-4">
          <DemoSteps steps={[compareResult.mvQuery, compareResult.baseQuery]} />
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-4"><h4 className="font-semibold text-sm text-green-800 dark:text-green-400 mb-1">✓ Materialized View</h4><p className="text-2xl font-bold text-green-700 dark:text-green-400">{compareResult.comparison.mvExecutionTimeMs}ms</p><p className="text-xs text-green-600 dark:text-green-500">{compareResult.comparison.mvScanType}</p></div>
            <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 p-4"><h4 className="font-semibold text-sm text-red-800 dark:text-red-400 mb-1">✗ Base Table Query</h4><p className="text-2xl font-bold text-red-700 dark:text-red-400">{compareResult.comparison.baseExecutionTimeMs}ms</p><p className="text-xs text-red-600 dark:text-red-500">{compareResult.comparison.baseScanType}</p></div>
            <div className="col-span-2 bg-primary/5 border border-primary/20 rounded-xl p-3 text-center"><p className="font-bold text-primary">{compareResult.comparison.speedup}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}

function AuditDemo() {
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { const r = await pgApi.auditDemo(); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="Audit Logging with JSONB" description="An audit trigger fires on every INSERT, UPDATE, DELETE on critical tables. It captures the old and new row values as JSONB, along with the user ID (from session variable app.current_user_id), timestamp, and action type. This creates a complete, tamper-evident audit trail." objects={['audit_logs', 'trg_audit_log', 'app.current_user_id', 'JSONB old_value / new_value']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Run Audit Demo</Button>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function PgvectorDemo() {
  const [query, setQuery] = useState('electronic devices for office');
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { if (query.length < 2) return; setLoading(true); setError(''); try { const r = await pgApi.pgvectorDemo(query); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="pgvector — Semantic Search" description="pgvector adds vector storage and similarity search to PostgreSQL. Each product has an embedding (768-dimensional vector) generated by Ollama's nomic-embed-text model. The <=> operator computes cosine distance between vectors — finding products semantically similar to the query, even without exact keyword matches." objects={['products.embedding (vector(768))', '<=> cosine distance operator', 'IVFFlat index', 'Ollama nomic-embed-text']} />
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Describe what you're looking for in natural language..." className="flex-1" onKeyDown={(e) => e.key === 'Enter' && run()} />
        <Button onClick={run} disabled={loading || query.length < 2}><Search className="h-3.5 w-3.5" /> Search</Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">Try: "cold storage food", "office furniture", "packaging materials"</p>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}{results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function RLSDemo() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { setResult(await pgApi.rlsDemo()); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="Row Level Security (RLS)" description="RLS policies restrict which rows a user can see or modify based on their role. Staff can only see inventory in their assigned warehouse. Warehouse managers see their managed warehouses. Admins see everything. The policy is enforced at the database level — the application cannot bypass it." objects={['inventory_select_policy', 'inventory_insert_policy', 'get_current_app_user()', 'app.current_user_id']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Compare Role Visibility</Button>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{result.explanation}</p>
          <DemoSteps steps={[
            result.policies,
            ...(result.roles || []).map((r: any) => ({
              sql: r.sql,
              result: {
                role: r.role,
                userId: r.userId,
                visibleRows: r.rowCount,
                sampleRows: r.sampleRows,
              },
              executionTimeMs: r.executionTimeMs,
            })),
          ]} />
          <div className="grid grid-cols-3 gap-4">
            {result.roles?.map((r: any) => (
              <div key={r.role} className="rounded-xl border p-4 text-center">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 capitalize">{r.role.replace('_', ' ')}</p>
                <p className="text-3xl font-bold text-primary">{r.rowCount}</p>
                <p className="text-xs text-muted-foreground mt-1">visible rows</p>
              </div>
            ))}
          </div>
          {result.policies?.result?.rows?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Active RLS Policies</p>
              <div className="space-y-1">{result.policies.result.rows.map((p: any, i: number) => (<div key={i} className="flex items-center gap-2 text-xs bg-muted/40 rounded-lg px-3 py-2 border"><Badge variant="outline" className="shrink-0">{p.command}</Badge><code className="font-mono">{p.policy_name}</code></div>))}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PartitioningDemo() {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function run() { setLoading(true); setError(''); try { setResult(await pgApi.partitioningDemo()); } catch (e: any) { setError(e.message); } setLoading(false); }
  return (
    <div>
      <FeatureInfo title="Table Partitioning" description="The stock_movements table is range-partitioned by year (2024, 2025, 2026, default). When a query includes a date filter, PostgreSQL's partition pruning skips irrelevant partitions entirely — scanning only the relevant year's data. This dramatically improves performance for time-series queries." objects={['stock_movements (partitioned)', 'stock_movements_2024', 'stock_movements_2025', 'stock_movements_2026', 'EXPLAIN ANALYZE']} />
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Show Partition Pruning</Button>
      {loading && <LoadingSpinner />}{error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{result.explanation}</p>
          <DemoSteps steps={[result.partitions, result.queryPlan]} />
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 p-4">
              <h4 className="font-semibold text-sm text-green-800 dark:text-green-400 mb-2">✓ Scanned Partitions</h4>
              <div className="flex flex-wrap gap-1">{result.partitionPruning.scannedPartitions.map((p: string) => <Badge key={p} variant="success">{p}</Badge>)}</div>
            </div>
            <div className="rounded-xl border p-4">
              <h4 className="font-semibold text-sm text-muted-foreground mb-2">✗ Pruned (Skipped)</h4>
              <div className="flex flex-wrap gap-1">{result.partitionPruning.prunedPartitions.map((p: string) => <Badge key={p} variant="outline">{p}</Badge>)}</div>
            </div>
          </div>
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-sm font-medium">Execution: <strong>{result.partitionPruning.executionTimeMs}ms</strong> — Date filter: 2025-01-01 → 2026-01-01</p>
          </div>
        </div>
      )}
    </div>
  );
}
