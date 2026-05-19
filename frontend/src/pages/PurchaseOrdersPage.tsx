import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Plus } from 'lucide-react';
import * as poApi from '@/api/purchaseOrders';

const statusVariant: Record<string, string> = {
  pending: 'warning', ordered: 'default', partially_received: 'secondary', received: 'success', cancelled: 'destructive',
};

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<poApi.PurchaseOrder[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showReceive, setShowReceive] = useState<poApi.PurchaseOrder | null>(null);

  useEffect(() => { loadOrders(); }, [pagination.page]);

  async function loadOrders() {
    setLoading(true);
    try { const res = await poApi.getPurchaseOrders({ page: pagination.page, pageSize: 20 }); setOrders(res.data); setPagination(res.pagination); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Create PO</Button>
      </div>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>ID</TableHead><TableHead>Supplier</TableHead><TableHead>Warehouse</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead>
                <TableHead>Created</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow> :
                orders.map((o) => (
                  <TableRow key={o.order_id}>
                    <TableCell className="font-mono">#{o.order_id}</TableCell>
                    <TableCell className="font-medium">{o.supplier_name}</TableCell>
                    <TableCell>{o.warehouse_name}</TableCell>
                    <TableCell><Badge variant={statusVariant[o.status] as any || 'outline'}>{o.status}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{Number(o.total_amount).toLocaleString()}đ</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{o.status !== 'received' && o.status !== 'cancelled' && <Button variant="ghost" size="sm" onClick={() => setShowReceive(o)}>Receive</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Purchase Order" size="lg">
        <POCreateForm onSuccess={() => { setShowCreate(false); loadOrders(); }} onError={setError} />
      </Modal>
      {showReceive && <Modal isOpen={!!showReceive} onClose={() => setShowReceive(null)} title={`Receive PO #${showReceive.order_id}`} size="lg">
        <ReceiveForm po={showReceive} onSuccess={() => { setShowReceive(null); loadOrders(); }} onError={setError} />
      </Modal>}
    </div>
  );
}

function POCreateForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [form, setForm] = useState({ supplier_id: '', warehouse_id: '', note: '' });
  const [items, setItems] = useState([{ product_id: '', ordered_quantity: '', unit_cost: '' }]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      await poApi.createPurchaseOrder({ supplier_id: Number(form.supplier_id), warehouse_id: Number(form.warehouse_id), note: form.note || undefined, items: items.map(i => ({ product_id: Number(i.product_id), ordered_quantity: Number(i.ordered_quantity), unit_cost: Number(i.unit_cost) })) });
      onSuccess();
    } catch (e: any) { onError(e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div><label className="block text-sm font-medium mb-1.5">Supplier ID</label><Input required type="number" value={form.supplier_id} onChange={(e) => setForm(f => ({ ...f, supplier_id: e.target.value }))} /></div>
        <div><label className="block text-sm font-medium mb-1.5">Warehouse ID</label><Input required type="number" value={form.warehouse_id} onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))} /></div>
      </div>
      <div><label className="block text-sm font-medium mb-1.5">Note</label><Input value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} /></div>
      <div>
        <label className="block text-sm font-medium mb-2">Items</label>
        {items.map((item, idx) => (
          <div key={idx} className="grid grid-cols-3 gap-2 mb-2">
            <Input placeholder="Product ID" type="number" value={item.product_id} onChange={(e) => { const n = [...items]; n[idx].product_id = e.target.value; setItems(n); }} required />
            <Input placeholder="Quantity" type="number" value={item.ordered_quantity} onChange={(e) => { const n = [...items]; n[idx].ordered_quantity = e.target.value; setItems(n); }} required />
            <Input placeholder="Unit Cost" type="number" step="0.01" value={item.unit_cost} onChange={(e) => { const n = [...items]; n[idx].unit_cost = e.target.value; setItems(n); }} required />
          </div>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { product_id: '', ordered_quantity: '', unit_cost: '' }])}>+ Add Item</Button>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Creating...' : 'Create PO'}</Button>
    </form>
  );
}

function ReceiveForm({ po, onSuccess, onError }: { po: poApi.PurchaseOrder; onSuccess: () => void; onError: (msg: string) => void }) {
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try {
      const items = Object.entries(quantities).filter(([, v]) => Number(v) > 0).map(([id, qty]) => ({ order_item_id: Number(id), received_quantity: Number(qty) }));
      await poApi.receivePurchaseOrder(po.order_id, { items });
      onSuccess();
    } catch (e: any) { onError(e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {po.items?.map((item) => (
        <div key={item.order_item_id} className="flex items-center gap-4 p-3 rounded-lg border">
          <div className="flex-1">
            <p className="font-medium text-sm">{item.product_name}</p>
            <p className="text-xs text-muted-foreground">Ordered: {item.ordered_quantity} | Received: {item.received_quantity}</p>
          </div>
          <Input type="number" min="0" max={item.ordered_quantity - item.received_quantity} placeholder="Qty" value={quantities[item.order_item_id] || ''} onChange={(e) => setQuantities(q => ({ ...q, [item.order_item_id]: e.target.value }))} className="w-24" />
        </div>
      )) || <p className="text-sm text-muted-foreground">No items available</p>}
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Receiving...' : 'Receive Items'}</Button>
    </form>
  );
}
