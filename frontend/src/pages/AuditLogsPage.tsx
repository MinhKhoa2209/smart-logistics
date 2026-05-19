import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Pagination, Modal, LoadingSpinner, ErrorAlert, JSONDiffViewer } from '@/components';
import * as auditApi from '@/api/auditLogs';

const actionVariant: Record<string, string> = { INSERT: 'success', UPDATE: 'default', DELETE: 'destructive' };

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<auditApi.AuditLog[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tableName, setTableName] = useState('');
  const [action, setAction] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState<auditApi.AuditLog | null>(null);

  useEffect(() => { loadLogs(); }, [pagination.page, tableName, action, startDate, endDate]);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await auditApi.getAuditLogs({ page: pagination.page, pageSize: 20, table_name: tableName || undefined, action: action || undefined, start_date: startDate || undefined, end_date: endDate || undefined });
      setLogs(res.data); setPagination(res.pagination); setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit Logs</h1>

      <div className="flex flex-wrap gap-3">
        <Select value={tableName} onChange={(e) => { setTableName(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40">
          <option value="">All Tables</option>
          <option value="products">products</option>
          <option value="inventory">inventory</option>
          <option value="warehouses">warehouses</option>
          <option value="purchase_orders">purchase_orders</option>
          <option value="shipments">shipments</option>
        </Select>
        <Select value={action} onChange={(e) => { setAction(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-36">
          <option value="">All Actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
      </div>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Timestamp</TableHead><TableHead>User</TableHead><TableHead>Action</TableHead>
              <TableHead>Table</TableHead><TableHead>Record</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {logs.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit logs</TableCell></TableRow> :
              logs.map((log) => (
                <TableRow key={log.log_id}>
                  <TableCell className="text-muted-foreground text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                  <TableCell>{log.username}</TableCell>
                  <TableCell><Badge variant={actionVariant[log.action] as any || 'outline'}>{log.action}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                  <TableCell className="font-mono">#{log.record_id}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>Diff</Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}

      {selectedLog && <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title={`Audit #${selectedLog.log_id} — ${selectedLog.action} on ${selectedLog.table_name}`} size="xl">
        <JSONDiffViewer oldValue={selectedLog.old_value} newValue={selectedLog.new_value} />
      </Modal>}
    </div>
  );
}
