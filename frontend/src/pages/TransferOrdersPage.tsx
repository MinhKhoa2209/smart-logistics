import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Plus } from 'lucide-react';
import * as transfersApi from '@/api/transfers';

export default function TransferOrdersPage() {
  const [transfers, setTransfers] = useState<transfersApi.Transfer[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadTransfers(); }, [pagination.page]);

  async function loadTransfers() {
    setLoading(true);
    try { const res = await transfersApi.getTransfers({ page: pagination.page, pageSize: 20 }); setTransfers(res.data); setPagination(res.pagination); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Transfer Orders</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Transfer</Button>
      </div>
      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Product</TableHead><TableHead>From</TableHead>
              <TableHead>To</TableHead><TableHead className="text-right">Qty</TableHead>
              <TableHead>Status</TableHead><TableHead>Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {transfers.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transfers</TableCell></TableRow> :
              transfers.map((t) => (
                <TableRow key={t.transfer_id}>
                  <TableCell className="font-mono">#{t.transfer_id}</TableCell>
                  <TableCell className="font-medium">{t.product_name}</TableCell>
                  <TableCell>{t.from_warehouse_name}</TableCell>
                  <TableCell>{t.to_warehouse_name}</TableCell>
                  <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                  <TableCell><Badge variant={t.status === 'completed' ? 'success' : t.status === 'failed' ? 'destructive' : 'warning'}>{t.status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Transfer" size="md">
        <TransferForm onSuccess={() => { setShowCreate(false); loadTransfers(); }} onError={setError} />
      </Modal>
    </div>
  );
}

function TransferForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [form, setForm] = useState({ product_id: '', from_warehouse_id: '', to_warehouse_id: '', quantity: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await transfersApi.createTransfer({ product_id: Number(form.product_id), from_warehouse_id: Number(form.from_warehouse_id), to_warehouse_id: Number(form.to_warehouse_id), quantity: Number(form.quantity) });
      onSuccess();
    } catch (e: any) { onError(e.message.includes('lock') || e.message.includes('timeout') ? 'Lock timeout — another transfer in progress. Try again.' : e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium mb-1.5">Product ID</label><Input required type="number" value={form.product_id} onChange={(e) => setForm(f => ({ ...f, product_id: e.target.value }))} /></div>
      <div><label className="block text-sm font-medium mb-1.5">From Warehouse ID</label><Input required type="number" value={form.from_warehouse_id} onChange={(e) => setForm(f => ({ ...f, from_warehouse_id: e.target.value }))} /></div>
      <div><label className="block text-sm font-medium mb-1.5">To Warehouse ID</label><Input required type="number" value={form.to_warehouse_id} onChange={(e) => setForm(f => ({ ...f, to_warehouse_id: e.target.value }))} /></div>
      <div><label className="block text-sm font-medium mb-1.5">Quantity</label><Input required type="number" min="1" value={form.quantity} onChange={(e) => setForm(f => ({ ...f, quantity: e.target.value }))} /></div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Transferring...' : 'Create Transfer'}</Button>
    </form>
  );
}
