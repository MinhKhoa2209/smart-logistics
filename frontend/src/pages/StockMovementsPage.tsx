import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Pencil, Plus } from 'lucide-react';
import * as movementsApi from '@/api/stockMovements';
import * as productsApi from '@/api/products';
import * as productLotsApi from '@/api/productLots';
import * as warehousesApi from '@/api/warehouses';

const typeColors: Record<string, string> = {
  inbound: 'success', outbound: 'destructive', transfer_in: 'default',
  transfer_out: 'secondary', adjustment: 'warning', return: 'outline', damaged: 'destructive',
};

export default function StockMovementsPage() {
  const [movements, setMovements] = useState<movementsApi.StockMovement[]>([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [movementType, setMovementType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<movementsApi.StockMovement | null>(null);

  useEffect(() => { loadMovements(); }, [pagination.page, movementType, startDate, endDate]);

  async function loadMovements() {
    setLoading(true);
    try {
      const res = await movementsApi.getStockMovements({ page: pagination.page, pageSize: 20, movement_type: movementType || undefined, start_date: startDate || undefined, end_date: endDate || undefined });
      setMovements(res.data);
      setPagination(res.pagination);
      setError('');
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function handleCreate(input: movementsApi.StockMovementInput) {
    await movementsApi.createStockMovement(input);
    setShowCreate(false);
    setPagination(p => ({ ...p, page: 1 }));
    loadMovements();
  }

  async function handleUpdate(input: Partial<movementsApi.StockMovementInput>) {
    if (!showEdit) return;
    await movementsApi.updateStockMovement(showEdit.movement_id, input);
    setShowEdit(null);
    loadMovements();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Stock Movements</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Movement</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={movementType} onChange={(e) => { setMovementType(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-44">
          <option value="">All Types</option>
          <option value="inbound">Inbound</option>
          <option value="outbound">Outbound</option>
          <option value="transfer_in">Transfer In</option>
          <option value="transfer_out">Transfer Out</option>
          <option value="adjustment">Adjustment</option>
          <option value="return">Return</option>
          <option value="damaged">Damaged</option>
        </Select>
        <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
        <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPagination(p => ({ ...p, page: 1 })); }} className="w-40" />
      </div>

      {error && <ErrorAlert message={error} />}
      {loading ? <LoadingSpinner /> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No stock movements found</TableCell></TableRow>
                ) : movements.map((m) => (
                  <TableRow key={m.movement_id}>
                    <TableCell className="font-medium">{m.product_name}</TableCell>
                    <TableCell>{m.warehouse_name}</TableCell>
                    <TableCell className={`text-right font-mono ${m.change_amount > 0 ? 'text-green-600' : 'text-red-600'}`}>{m.change_amount > 0 ? '+' : ''}{m.change_amount}</TableCell>
                    <TableCell><Badge variant={typeColors[m.movement_type] as any || 'outline'}>{m.movement_type.replace('_', ' ')}</Badge></TableCell>
                    <TableCell className="text-muted-foreground text-xs">{m.reference_type || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{new Date(m.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setShowEdit(m)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination page={pagination.page} totalPages={pagination.totalPages} total={pagination.total} pageSize={pagination.pageSize} onPageChange={(p) => setPagination(prev => ({ ...prev, page: p }))} />
        </Card>
      )}

      <StockMovementFormModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSubmit={handleCreate} title="Add Stock Movement" />
      {showEdit && (
        <StockMovementFormModal
          isOpen={!!showEdit}
          onClose={() => setShowEdit(null)}
          onSubmit={handleUpdate}
          title="Edit Stock Movement"
          initial={showEdit}
        />
      )}
    </div>
  );
}

function StockMovementFormModal({
  isOpen,
  onClose,
  onSubmit,
  title,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: movementsApi.StockMovementInput) => Promise<void>;
  title: string;
  initial?: movementsApi.StockMovement;
}) {
  const [form, setForm] = useState({
    product_id: initial?.product_id?.toString() || '',
    warehouse_id: initial?.warehouse_id?.toString() || '',
    change_amount: initial?.change_amount?.toString() || '',
    movement_type: initial?.movement_type || 'adjustment',
    lot_id: initial?.lot_id?.toString() || '',
    unit_cost: initial?.unit_cost?.toString() || '',
    reference_id: initial?.reference_id?.toString() || '',
    reference_type: initial?.reference_type || '',
    note: initial?.note || '',
    created_by: initial?.created_by?.toString() || '1',
  });
  const [products, setProducts] = useState<productsApi.Product[]>([]);
  const [warehouses, setWarehouses] = useState<warehousesApi.Warehouse[]>([]);
  const [lots, setLots] = useState<productLotsApi.ProductLot[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoadingOptions(true);
    Promise.all([
      productsApi.getProducts({ page: 1, pageSize: 100 }),
      warehousesApi.getWarehouses(),
      productLotsApi.getProductLots({ page: 1, pageSize: 100 }),
    ])
      .then(([productRes, warehouseRes, lotRes]) => {
        setProducts(productRes.data);
        setWarehouses(warehouseRes);
        setLots(lotRes.data);
      })
      .catch((e: any) => setErr(e.message))
      .finally(() => setLoadingOptions(false));
  }, [isOpen]);

  const selectedProductId = form.product_id ? Number(form.product_id) : undefined;
  const filteredLots = selectedProductId ? lots.filter(l => l.product_id === selectedProductId) : lots;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErr('');
    try {
      await onSubmit({
        product_id: Number(form.product_id),
        warehouse_id: Number(form.warehouse_id),
        change_amount: Number(form.change_amount),
        movement_type: form.movement_type,
        lot_id: form.lot_id ? Number(form.lot_id) : null,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        reference_id: form.reference_id ? Number(form.reference_id) : null,
        reference_type: form.reference_type || null,
        note: form.note || null,
        created_by: form.created_by ? Number(form.created_by) : null,
      });
    } catch (e: any) {
      setErr(e.message);
    }
    setSubmitting(false);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg" footer={
      <>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button form="stock-movement-form" type="submit" disabled={submitting || loadingOptions}>{submitting ? 'Saving...' : 'Save'}</Button>
      </>
    }>
      {err && <ErrorAlert message={err} />}
      {loadingOptions ? <LoadingSpinner /> : (
        <form id="stock-movement-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Product</label>
            <Select required value={form.product_id} onChange={(e) => setForm(f => ({ ...f, product_id: e.target.value, lot_id: '' }))}>
              <option value="">Select product</option>
              {products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Warehouse</label>
            <Select required value={form.warehouse_id} onChange={(e) => setForm(f => ({ ...f, warehouse_id: e.target.value }))}>
              <option value="">Select warehouse</option>
              {warehouses.map(w => <option key={w.warehouse_id} value={w.warehouse_id}>{w.name}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Type</label>
            <Select value={form.movement_type} onChange={(e) => setForm(f => ({ ...f, movement_type: e.target.value }))}>
              <option value="inbound">Inbound</option>
              <option value="outbound">Outbound</option>
              <option value="transfer_in">Transfer In</option>
              <option value="transfer_out">Transfer Out</option>
              <option value="adjustment">Adjustment</option>
              <option value="return">Return</option>
              <option value="damaged">Damaged</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Amount</label>
            <Input required type="number" step="1" value={form.change_amount} onChange={(e) => setForm(f => ({ ...f, change_amount: e.target.value }))} placeholder="Use negative for stock out" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Lot <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Select value={form.lot_id} onChange={(e) => setForm(f => ({ ...f, lot_id: e.target.value }))}>
              <option value="">No lot</option>
              {filteredLots.map(l => <option key={l.lot_id} value={l.lot_id}>{l.lot_number}</option>)}
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Unit Cost <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reference Type <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input maxLength={30} value={form.reference_type} onChange={(e) => setForm(f => ({ ...f, reference_type: e.target.value }))} placeholder="manual_adjustment" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Reference ID <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input type="number" min="1" value={form.reference_id} onChange={(e) => setForm(f => ({ ...f, reference_id: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-sm font-medium mb-1.5">Note <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} />
          </div>
        </form>
      )}
    </Modal>
  );
}
