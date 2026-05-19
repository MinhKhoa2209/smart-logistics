import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner, ErrorAlert, SQLViewer } from '@/components';
import { Play, RotateCcw } from 'lucide-react';
import * as pgApi from '@/api/pgFeatures';

type Tab = 'transactions' | 'locking' | 'triggers' | 'stored-procs' | 'partial-indexes' | 'materialized-views' | 'audit' | 'pgvector' | 'rls' | 'partitioning';

const tabs: { id: Tab; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'locking', label: 'Locking' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'stored-procs', label: 'Stored Procs' },
  { id: 'partial-indexes', label: 'Partial Indexes' },
  { id: 'materialized-views', label: 'MV' },
  { id: 'audit', label: 'Audit' },
  { id: 'pgvector', label: 'pgvector' },
  { id: 'rls', label: 'RLS' },
  { id: 'partitioning', label: 'Partitioning' },
];

export default function PGFeaturesPage() {
  const [activeTab, setActiveTab] = useState<Tab>('transactions');
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (!confirm('Reset demo data?')) return;
    setResetting(true);
    try { await pgApi.resetDemoData(); } catch { /* ignore */ }
    setResetting(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">PostgreSQL Features Demo</h1>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={resetting}>
          <RotateCcw className="h-3.5 w-3.5" /> Reset Data
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 border-b">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{tab.label}</button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {activeTab === 'transactions' && <TransactionsDemo />}
          {activeTab === 'locking' && <SimpleDemo title="SELECT ... FOR UPDATE" desc="Simulates concurrent transfers. Transfer B waits for A to release the lock." run={() => pgApi.lockingDemo().then(r => r.steps)} />}
          {activeTab === 'triggers' && <SimpleDemo title="Auto Purchase Order Trigger" desc="Inserts a movement that reduces inventory to reorder_point → trigger creates PO." run={() => pgApi.triggersDemo().then(r => r.steps)} />}
          {activeTab === 'stored-procs' && <StoredProcsDemo />}
          {activeTab === 'partial-indexes' && <PartialIndexesDemo />}
          {activeTab === 'materialized-views' && <MVDemo />}
          {activeTab === 'audit' && <SimpleDemo title="Audit Logging" desc="Performs UPDATE → captures old/new values as JSONB in audit_logs." run={() => pgApi.auditDemo().then(r => r.steps)} />}
          {activeTab === 'pgvector' && <PgvectorDemo />}
          {activeTab === 'rls' && <RLSDemo />}
          {activeTab === 'partitioning' && <PartitioningDemo />}
        </CardContent>
      </Card>
    </div>
  );
}

function DemoSteps({ steps }: { steps: pgApi.DemoExecutionResult[] }) {
  return (
    <div className="space-y-3 mt-4">
      {steps.map((step, i) => (
        <div key={i} className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
            <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            <Badge variant="outline" className="text-xs">{step.executionTimeMs}ms</Badge>
          </div>
          <div className="p-3 space-y-2">
            <SQLViewer sql={step.sql} />
            {step.error && <div className="text-sm text-destructive bg-destructive/10 p-2 rounded">{step.error}</div>}
            {step.result && <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">{JSON.stringify(step.result, null, 2)}</pre>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SimpleDemo({ title, desc, run }: { title: string; desc: string; run: () => Promise<pgApi.DemoExecutionResult[]> }) {
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function execute() { setLoading(true); setError(''); try { setResults(await run()); } catch (e: any) { setError(e.message); } setLoading(false); }

  return (
    <div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">{desc}</p>
      <Button onClick={execute} disabled={loading}><Play className="h-3.5 w-3.5" /> Run Demo</Button>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

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
      <h3 className="text-lg font-semibold">Transaction Demo</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">PO receiving within an open transaction. COMMIT or ROLLBACK to finalize.</p>
      <div className="flex gap-2">
        <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Run</Button>
        {sessionId && <Button variant="outline" onClick={commit} className="text-green-600 border-green-200">COMMIT</Button>}
        {sessionId && <Button variant="outline" onClick={rollback} className="text-red-600 border-red-200">ROLLBACK</Button>}
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {results.length > 0 && <DemoSteps steps={results} />}
    </div>
  );
}

function StoredProcsDemo() {
  const [proc, setProc] = useState('calculate_distance');
  const [params, setParams] = useState<Record<string, string>>({ lat1: '10.8231', lon1: '106.6297', lat2: '21.0285', lon2: '105.8542' });
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const procParams: Record<string, string[]> = { calculate_distance: ['lat1', 'lon1', 'lat2', 'lon2'], suggest_smart_warehouse: ['product_id', 'required_quantity', 'latitude', 'longitude'], move_stock_advanced: ['product_id', 'from_warehouse_id', 'to_warehouse_id', 'quantity'] };
  const defaults: Record<string, Record<string, string>> = { calculate_distance: { lat1: '10.8231', lon1: '106.6297', lat2: '21.0285', lon2: '105.8542' }, suggest_smart_warehouse: { product_id: '1', required_quantity: '10', latitude: '10.8231', longitude: '106.6297' }, move_stock_advanced: { product_id: '1', from_warehouse_id: '1', to_warehouse_id: '2', quantity: '5' } };

  function changeProc(p: string) { setProc(p); setParams(defaults[p] || {}); setResults([]); }

  async function execute() { setLoading(true); setError(''); try { const numP: Record<string, number> = {}; Object.entries(params).forEach(([k, v]) => { numP[k] = Number(v); }); const r = await pgApi.storedProcedureDemo(proc, numP); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }

  return (
    <div>
      <h3 className="text-lg font-semibold">Stored Functions</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Execute stored functions with parameters.</p>
      <div className="space-y-3">
        <Select value={proc} onChange={(e) => changeProc(e.target.value)} className="w-64">
          <option value="calculate_distance">calculate_distance</option>
          <option value="suggest_smart_warehouse">suggest_smart_warehouse</option>
          <option value="move_stock_advanced">move_stock_advanced</option>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          {procParams[proc]?.map((p) => (
            <div key={p}><label className="block text-xs font-medium text-muted-foreground mb-1">{p}</label><Input value={params[p] || ''} onChange={(e) => setParams(prev => ({ ...prev, [p]: e.target.value }))} /></div>
          ))}
        </div>
        <Button onClick={execute} disabled={loading}><Play className="h-3.5 w-3.5" /> Execute</Button>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {results.length > 0 && <DemoSteps steps={results} />}
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
      <h3 className="text-lg font-semibold">Partial Indexes</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">EXPLAIN ANALYZE comparison with/without idx_inventory_low_stock.</p>
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Compare</Button>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Card className="border-green-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">With Index</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{result.comparison.withIndex.scanType}</p><p className="text-lg font-bold">{result.comparison.withIndex.executionTimeMs}ms</p></CardContent></Card>
          <Card className="border-red-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-red-700">Without Index (Seq Scan)</CardTitle></CardHeader><CardContent><p className="text-xs text-muted-foreground">{result.comparison.withoutIndex.scanType}</p><p className="text-lg font-bold">{result.comparison.withoutIndex.executionTimeMs}ms</p></CardContent></Card>
        </div>
      )}
      {result && <div className="mt-3"><Badge variant="default">{result.comparison.speedup}</Badge></div>}
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
      <h3 className="text-lg font-semibold">Materialized Views</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Refresh MV and compare performance vs base table.</p>
      <div className="flex gap-2">
        <Button onClick={async () => { setLoading(true); try { setRefreshResult(await pgApi.refreshMaterializedView()); } catch (e: any) { setError(e.message); } setLoading(false); }} disabled={loading}>Refresh MV</Button>
        <Button variant="outline" onClick={async () => { setLoading(true); try { setCompareResult(await pgApi.compareMaterializedView()); } catch (e: any) { setError(e.message); } setLoading(false); }} disabled={loading}>Compare</Button>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {refreshResult && <p className="mt-3 text-sm text-green-600">Refreshed in {refreshResult.executionTimeMs}ms</p>}
      {compareResult && <div className="mt-3 text-sm"><p>MV: {compareResult.comparison.mvExecutionTimeMs}ms | Base: {compareResult.comparison.baseExecutionTimeMs}ms</p><Badge>{compareResult.comparison.speedup}</Badge></div>}
    </div>
  );
}

function PgvectorDemo() {
  const [query, setQuery] = useState('electronic devices');
  const [results, setResults] = useState<pgApi.DemoExecutionResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function run() { if (query.length < 2) return; setLoading(true); setError(''); try { const r = await pgApi.pgvectorDemo(query); setResults(r.steps); } catch (e: any) { setError(e.message); } setLoading(false); }

  return (
    <div>
      <h3 className="text-lg font-semibold">pgvector — Semantic Search</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Cosine distance operator {'<=>'} for similarity search.</p>
      <div className="flex gap-2">
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Describe what you're looking for..." className="flex-1" />
        <Button onClick={run} disabled={loading || query.length < 2}><Play className="h-3.5 w-3.5" /> Search</Button>
      </div>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {results.length > 0 && <DemoSteps steps={results} />}
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
      <h3 className="text-lg font-semibold">Row Level Security</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">Compares inventory visibility across roles.</p>
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Run Demo</Button>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4">
          <p className="text-sm mb-3">{result.explanation}</p>
          <div className="grid grid-cols-3 gap-4">
            {result.roles?.map((r: any) => (
              <Card key={r.role}><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground capitalize">{r.role}</p><p className="text-2xl font-bold text-primary">{r.rowCount}</p><p className="text-xs text-muted-foreground">visible rows</p></CardContent></Card>
            ))}
          </div>
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
      <h3 className="text-lg font-semibold">Table Partitioning</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">EXPLAIN ANALYZE showing partition pruning on date-filtered queries.</p>
      <Button onClick={run} disabled={loading}><Play className="h-3.5 w-3.5" /> Run Demo</Button>
      {loading && <LoadingSpinner />}
      {error && <ErrorAlert message={error} />}
      {result && (
        <div className="mt-4 space-y-3">
          <p className="text-sm">{result.explanation}</p>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-green-200"><CardHeader className="pb-2"><CardTitle className="text-sm text-green-700">Scanned</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-1">{result.partitionPruning.scannedPartitions.map((p: string) => <Badge key={p} variant="success">{p}</Badge>)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Pruned</CardTitle></CardHeader><CardContent><div className="flex flex-wrap gap-1">{result.partitionPruning.prunedPartitions.map((p: string) => <Badge key={p} variant="outline">{p}</Badge>)}</div></CardContent></Card>
          </div>
          <p className="text-sm text-muted-foreground">Execution: {result.partitionPruning.executionTimeMs}ms</p>
        </div>
      )}
    </div>
  );
}
