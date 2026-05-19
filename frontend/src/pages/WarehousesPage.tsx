import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Modal, LoadingSpinner, ErrorAlert } from '@/components';
import { Plus } from 'lucide-react';
import * as warehousesApi from '@/api/warehouses';

const typeColors: Record<string, string> = {
  distribution_center: 'default',
  cold_storage: 'default',
  returns: 'warning',
  retail: 'success',
  fulfillment: 'secondary',
};

export default function WarehousesPage() {
  const [warehouses, setWarehouses] = useState<warehousesApi.Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<warehousesApi.Warehouse | null>(null);
  const [inventory, setInventory] = useState<warehousesApi.WarehouseInventory[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadWarehouses(); }, []);

  async function loadWarehouses() {
    setLoading(true);
    try { setWarehouses(await warehousesApi.getWarehouses()); setError(''); }
    catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  async function viewWarehouse(wh: warehousesApi.Warehouse) {
    setSelected(wh);
    setInvLoading(true);
    try { setInventory(await warehousesApi.getWarehouseInventory(wh.warehouse_id)); }
    catch (e: any) { setError(e.message); }
    setInvLoading(false);
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Warehouse</Button>
      </div>

      {error && <ErrorAlert message={error} />}

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead className="text-right">Capacity</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {warehouses.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No warehouses</TableCell></TableRow>
              ) : warehouses.map((w) => (
                <TableRow key={w.warehouse_id} className="cursor-pointer" onClick={() => viewWarehouse(w)}>
                  <TableCell className="font-medium">{w.name}</TableCell>
                  <TableCell><Badge variant={typeColors[w.warehouse_type] as any || 'outline'}>{w.warehouse_type.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{w.location || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{w.capacity?.toLocaleString() || '-'}</TableCell>
                  <TableCell>{w.manager_name || '-'}</TableCell>
                  <TableCell>{w.is_active ? <Badge variant="success">Active</Badge> : <Badge variant="destructive">Inactive</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Inventory detail modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={`${selected?.name} — Inventory`} size="xl">
        {invLoading ? <LoadingSpinner /> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Lot</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Reorder</TableHead>
                <TableHead className="text-right">Max</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No inventory in this warehouse</TableCell></TableRow>
              ) : inventory.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.product_name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-muted-foreground">{item.lot_number || '-'}</TableCell>
                  <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono">{item.reorder_point}</TableCell>
                  <TableCell className="text-right font-mono">{item.max_stock_level}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Modal>

      {/* Create warehouse modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Warehouse" size="md">
        <WarehouseForm
          onSuccess={() => { setShowCreate(false); loadWarehouses(); }}
          onError={setError}
        />
      </Modal>
    </div>
  );
}

function WarehouseForm({ onSuccess, onError }: { onSuccess: () => void; onError: (msg: string) => void }) {
  const [form, setForm] = useState({ name: '', warehouse_type: 'distribution_center', location: '', capacity: '', manager_id: '' });
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await warehousesApi.createWarehouse({
        name: form.name,
        warehouse_type: form.warehouse_type,
        location: form.location || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        manager_id: form.manager_id ? Number(form.manager_id) : null,
      });
      onSuccess();
    } catch (e: any) { onError(e.message); }
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5">Name</label>
        <Input required value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Kho Hà Nội" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Type</label>
        <Select value={form.warehouse_type} onChange={(e) => setForm(f => ({ ...f, warehouse_type: e.target.value }))}>
          <option value="distribution_center">Distribution Center</option>
          <option value="cold_storage">Cold Storage</option>
          <option value="retail">Retail</option>
          <option value="fulfillment">Fulfillment</option>
          <option value="returns">Returns</option>
        </Select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1.5">Location <span className="text-muted-foreground font-normal">(optional)</span></label>
        <Input value={form.location} onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. KCN Thăng Long, Hà Nội" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5">Capacity <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input type="number" min="1" value={form.capacity} onChange={(e) => setForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 50000" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5">Manager ID <span className="text-muted-foreground font-normal">(optional)</span></label>
          <Input type="number" min="1" value={form.manager_id} onChange={(e) => setForm(f => ({ ...f, manager_id: e.target.value }))} placeholder="User ID" />
        </div>
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>{submitting ? 'Creating...' : 'Create Warehouse'}</Button>
    </form>
  );
}
