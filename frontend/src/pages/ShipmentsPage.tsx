import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Plus } from 'lucide-react';
import * as shipmentsApi from '@/api/shipments';

const statusVariant: Record<string, string> = { pending: 'warning', in_transit: 'default', delivered: 'success', failed: 'destructive', returned: 'secondary' };
const transitions: Record<string, string[]> = { pending: ['in_transit', 'failed'], in_transit: ['delivered'], delivered: ['returned'] };

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<shipmentsApi.Shipment[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadShipments(); }, [pagination.page]);

  async function loadShipments() {
    setLoading(true);
    try { const res = await shipmentsApi.getShipments({ page: pagination.page, pageSize: 20 }); setShipments(res.data); setPagination(res.pagination); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleStatus(id: number, status: string) {
    try { await shipmentsApi.updateShipmentStatus(id, status); loadShipments(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create Shipment</Button>
      </div>
      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Origin</TableHead><TableHead>Destination</TableHead>
              <TableHead>Carrier</TableHead><TableHead>Status</TableHead><TableHead>Created</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {shipments.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No shipments</TableCell></TableRow> :
              shipments.map((s) => (
                <TableRow key={s.shipment_id}>
                  <TableCell className="font-mono">#{s.shipment_id}</TableCell>
                  <TableCell className="font-medium">{s.origin_warehouse_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.destination_address}</TableCell>
                  <TableCell>{s.carrier}</TableCell>
                  <TableCell><Badge variant={statusVariant[s.status] as any || 'outline'}>{s.status.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">{(transitions[s.status] || []).map(t => <Button key={t} variant="ghost" size="sm" onClick={() => handleStatus(s.shipment_id, t)}>{t.replace('_', ' ')}</Button>)}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Shipment" size="lg">
        <ShipmentForm onSuccess={() => { setShowCreate(false); loadShipments(); }} onError={setError} />
      </Modal>
    </div>
  );
}

function ShipmentForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [form, setForm] = useState({ warehouse_id: '', destination_address: '', carrier: '' });
  const [items, setItems] = useState([{ product_id: '', quantity: '' }]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await shipmentsApi.createShipment({ warehouse_id: Number(form.warehouse_id), destination_address: form.destination_address, carrier: form.carrier, items: items.map(i => ({ product_id: Number(i.product_id), quantity: Number(i.quantity) })) });
      onSuccess();
    } catch (e: any) { onError(e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium mb-1.5">Origin Warehouse ID</label><Input required type="number" value={form.warehouse_id} onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))} /></div>
      <div><label className="block text-sm font-medium mb-1.5">Destination Address</label><Input required value={form.destination_address} onChange={(e) => setForm(f => ({ ...f, destination_address: e.target.value }))} /></div>
      <div><label className="block text-sm font-medium mb-1.5">Carrier</label><Input required value={form.carrier} onChange={(e) => setForm(f => ({ ...f, carrier: e.target.value }))} /></div>
      <div>
        <label className="block text-sm font-medium mb-2">Items</label>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-2 gap-2 mb-2">
            <Input placeholder="Product ID" type="number" value={item.product_id} onChange={(e) => { const n = [...items]; n[idx].product_id = e.target.value; setItems(n); }} required />
            <Input placeholder="Quantity" type="number" value={item.quantity} onChange={(e) => { const n = [...items]; n[idx].quantity = e.target.value; setItems(n); }} required />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { product_id: '', quantity: '' }])}>+ Add Item</Button>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Creating...' : 'Create Shipment'}</Button>
    </form>
  );
}
