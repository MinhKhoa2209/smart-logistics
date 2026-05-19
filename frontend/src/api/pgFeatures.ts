import apiClient from './client';

export interface DemoExecutionResult {
  sql: string;
  result: any;
  executionTimeMs: number;
  error?: string;
}

export async function transactionsDemo(sessionId?: string): Promise<{ sessionId: string; steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post('/pg-features/transactions/demo', { sessionId });
  return data;
}

export async function commitTransaction(sessionId: string): Promise<DemoExecutionResult> {
  const { data } = await apiClient.post('/pg-features/transactions/commit', { sessionId });
  return data;
}

export async function rollbackTransaction(sessionId: string): Promise<DemoExecutionResult> {
  const { data } = await apiClient.post('/pg-features/transactions/rollback', { sessionId });
  return data;
}

export async function lockingDemo(params?: { product_id?: number; warehouse_id?: number }): Promise<{ steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post('/pg-features/locking/demo', params || {});
  return data;
}

export async function triggersDemo(): Promise<{ steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post('/pg-features/triggers/demo');
  return data;
}

export async function storedProcedureDemo(name: string, params: Record<string, any>): Promise<{ steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post(`/pg-features/stored-procedures/${name}`, params);
  return data;
}

export async function partialIndexesDemo(): Promise<any> {
  const { data } = await apiClient.post('/pg-features/partial-indexes/demo');
  return data;
}

export async function refreshMaterializedView(): Promise<DemoExecutionResult> {
  const { data } = await apiClient.post('/pg-features/materialized-views/refresh');
  return data;
}

export async function compareMaterializedView(): Promise<any> {
  const { data } = await apiClient.get('/pg-features/materialized-views/compare');
  return data;
}

export async function auditDemo(): Promise<{ steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post('/pg-features/audit/demo');
  return data;
}

export async function pgvectorDemo(query: string): Promise<{ steps: DemoExecutionResult[] }> {
  const { data } = await apiClient.post('/pg-features/pgvector/demo', { query });
  return data;
}

export async function rlsDemo(): Promise<any> {
  const { data } = await apiClient.get('/pg-features/rls/demo');
  return data;
}

export async function partitioningDemo(): Promise<any> {
  const { data } = await apiClient.get('/pg-features/partitioning/demo');
  return data;
}

export async function resetDemoData(): Promise<DemoExecutionResult> {
  const { data } = await apiClient.post('/pg-features/reset-demo-data');
  return data;
}
