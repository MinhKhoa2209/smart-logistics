import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import * as ordersApi from '@/api/customerOrders';

const statusVariant: Record<string, string> = {
  pending: 'warning', confirmed: 'default', processing: 'default',
  shipped: 'secondary', delivered: 'success', cancelled: 'destructive', refunded: 'outline',
};

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<ordersApi.CustomerOrder[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPayment, setShowPayment] = useState<ordersApi.CustomerOrder | null>(null);

  useEffect(() => { loadOrders(); }, [pagination.page]);

  async function loadOrders() {
    setLoading(true);
    try { const res = await ordersApi.getCustomerOrders({ page: pagination.page, pageSize: 20 }); setOrders(res.data); setPagination(res.pagination); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleStatus(id: number, status: string) {
    try { await ordersApi.updateOrderStatus(id, status); loadOrders(); }
    catch (e: any) { setError(e.message); }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Customer Orders</h1>
      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card><CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>ID</TableHead><TableHead>Customer</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead><TableHead>Payment</TableHead>
              <TableHead>Date</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {orders.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No orders</TableCell></TableRow> :
              orders.map((o) => (
                <TableRow key={o.order_id}>
                  <TableCell className="font-mono">#{o.customer_order_id}</TableCell>
                  <TableCell className="font-medium">{o.customer_name}</TableCell>
                  <TableCell><Badge variant={statusVariant[o.status] as any}>{o.status}</Badge></TableCell>
                  <TableCell className="text-right font-mono">{Number(o.total_amount).toLocaleString()}đ</TableCell>
                  <TableCell><Badge variant={o.payment_status === 'paid' ? 'success' : 'warning'}>{o.payment_status}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {o.status === 'pending' && <Button variant="ghost" size="sm" onClick={() => handleStatus(o.customer_order_id, 'confirmed')}>Confirm</Button>}
                      {o.status === 'confirmed' && <Button variant="ghost" size="sm" onClick={() => handleStatus(o.customer_order_id, 'processing')}>Process</Button>}
                      {o.status === 'processing' && <Button variant="ghost" size="sm" onClick={() => handleStatus(o.customer_order_id, 'shipped')}>Ship</Button>}
                      <Button variant="ghost" size="sm" onClick={() => setShowPayment(o)}>Pay</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}
      {showPayment && <Modal isOpen={!!showPayment} onClose={() => setShowPayment(null)} title={`Payment — Order #${showPayment.customer_order_id}`} size="sm">
        <PaymentForm orderId={showPayment.customer_order_id} onSuccess={() => { setShowPayment(null); loadOrders(); }} onError={setError} />
      </Modal>}
    </div>
  );
}

function PaymentForm({ orderId, onSuccess, onError }: { orderId: number; onSuccess: () => void; onError: (msg: string) => void }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('credit_card');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setSubmitting(true);
    try { await ordersApi.recordPayment(orderId, { amount: Number(amount), payment_method: method }); onSuccess(); }
    catch (e: any) { onError(e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div><label className="block text-sm font-medium mb-1.5">Amount</label><Input required type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
      <div><label className="block text-sm font-medium mb-1.5">Payment Method</label>
        <Select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="credit_card">Credit Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="e_wallet">E-Wallet</option>
          <option value="other">Other</option>
        </Select>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Recording...' : 'Record Payment'}</Button>
    </form>
  );
}
